// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BloodRegistry
/// @notice ERC-1155 contract that tokenizes blood units.
/// @dev Heavy metadata (volumeMl, storageDetails, priority, donor profile, etc.)
///      lives OFF-CHAIN in your database / IPFS.  Only data the contract *enforces*
///      or that buyers absolutely need for on-chain filtering is stored here.
///      A keccak256 hash of the full off-chain JSON is stored as `metadataHash`
///      so anyone can verify the off-chain record hasn't been tampered with.
contract BloodRegistry is ERC1155, AccessControl {
    using SafeERC20 for IERC20;

    // ──────────────────────────── Roles ─────────────────────────────

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ──────────────────────────── Enums ────────────────────────────

    enum Status {
        Available,
        Reserved,
        Sold,
        Transfused,
        Expired,
        Discarded
    }

    // ──────────────────────────── Structs ──────────────────────────

    /// @notice Lean on-chain record.  Only fields the contract logic *uses*
    ///         or that are essential for buyer-side filtering live here.
    /// @dev Gas-optimised packing (single slot for the small fields):
    ///      bloodGroup(1) + rhPositive(1) + component(1) + status(1) = 4 bytes
    ///      collectionTime(8) + expiryTime(8) = 16 bytes   → fits in slot 1
    ///      donor(20 bytes)                                 → slot 2
    ///      metadataHash(32 bytes)                          → slot 3
    struct BloodInfo {
        uint8   bloodGroup;     // 0:A, 1:B, 2:AB, 3:O
        bool    rhPositive;     // true = Rh+
        uint8   component;      // 0:Whole, 1:PRBC, 2:Platelets, 3:Plasma
        Status  status;
        uint64  collectionTime;
        uint64  expiryTime;
        address donor;          // original registrant
        bytes32 metadataHash;   // keccak256 of full off-chain JSON
    }

    // ──────────────────────────── State ────────────────────────────

    uint256 public nextTokenId;
    mapping(uint256 => BloodInfo) public bloodInfo;

    address public market;
    IERC20 public yoda;
    uint256 public constant EXPIRY_BOUNTY = 1 * 10 ** 18;

    // ──────────────────────────── Events ───────────────────────────

    event UnitRegistered(
        uint256 indexed tokenId,
        address indexed donor,
        address indexed recipient,
        bytes32 metadataHash
    );
    event StatusUpdated(uint256 indexed tokenId, Status current);
    event ExpiryFlagged(uint256 indexed tokenId, address indexed flagger, uint256 bountyPaid);
    event UnitConsumed(uint256 indexed tokenId, address indexed facility, uint256 amount);

    // ──────────────────────────── Modifiers ────────────────────────

    modifier onlyValid(uint256 tokenId) {
        require(!isExpired(tokenId), "BloodRegistry: unit has expired");
        require(bloodInfo[tokenId].status != Status.Discarded, "BloodRegistry: unit discarded");
        _;
    }

    // ──────────────────────────── Constructor ──────────────────────

    /// @param uri_  Metadata URI template  (e.g. "https://api.example.com/blood/{id}.json")
    /// @param yoda_ Address of the YodaToken contract (for expiry bounty payouts)
    constructor(string memory uri_, address yoda_) ERC1155(uri_) {
        _grantRole(ADMIN_ROLE, msg.sender);
        yoda = IERC20(yoda_);
    }

    // ──────────────────────────── Admin ────────────────────────────

    /// @notice Links the BloodMarket and grants it MINTER_ROLE.
    function setMarket(address market_) external onlyRole(ADMIN_ROLE) {
        require(market_ != address(0), "Zero address");
        market = market_;
        _grantRole(MINTER_ROLE, market_);
    }

    // ──────────────────────────── Core ─────────────────────────────

    /// @notice Registers a blood unit.  Heavy metadata is stored off-chain;
    ///         only the hash is committed on-chain for tamper-proofing.
    /// @param recipient    Wallet receiving the tokens (donor for P2P, admin for donations).
    /// @param bloodGroup   0:A, 1:B, 2:AB, 3:O
    /// @param rhPositive   Rh factor
    /// @param component    0:Whole, 1:PRBC, 2:Platelets, 3:Plasma
    /// @param expiryTime   Unix timestamp – must be in the future
    /// @param metadataHash keccak256 of the full off-chain JSON blob
    /// @param amount       Number of fungible units to mint
    /// @param actualDonor  Real human donor address. Pass address(0) to default to msg.sender.
    ///                     Used when a contract (e.g. BloodDonation) calls on behalf of a human.
    function registerUnit(
        address recipient,
        uint8   bloodGroup,
        bool    rhPositive,
        uint8   component,
        uint64  expiryTime,
        bytes32 metadataHash,
        uint256 amount,
        address actualDonor
    ) external returns (uint256 tokenId) {
        if (recipient != msg.sender) {
            require(
                hasRole(MINTER_ROLE, msg.sender),
                "BloodRegistry: caller not authorized to mint to others"
            );
        }
        require(amount > 0, "Amount > 0");
        require(expiryTime > block.timestamp, "Expiry must be in future");

        address donorAddress = (actualDonor != address(0)) ? actualDonor : msg.sender;

        tokenId = nextTokenId++;

        bloodInfo[tokenId] = BloodInfo({
            bloodGroup:     bloodGroup,
            rhPositive:     rhPositive,
            component:      component,
            status:         Status.Available,
            collectionTime: uint64(block.timestamp),
            expiryTime:     expiryTime,
            donor:          donorAddress,
            metadataHash:   metadataHash
        });

        _mint(recipient, tokenId, amount, "");
        emit UnitRegistered(tokenId, donorAddress, recipient, metadataHash);
    }

    // ──────────────────────────── Lifecycle ────────────────────────

    /// @notice Burn units after transfusion / consumption.
    function consumeUnit(uint256 tokenId, uint256 amount) external onlyValid(tokenId) {
        require(balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
        _burn(msg.sender, tokenId, amount);
        emit UnitConsumed(tokenId, msg.sender, amount);
    }

    /// @notice Anyone can flag an expired unit and earn an EXPIRY_BOUNTY in YODA.
    function flagExpired(uint256 tokenId) external {
        require(isExpired(tokenId), "Not yet expired");
        require(bloodInfo[tokenId].status != Status.Expired, "Already marked");

        bloodInfo[tokenId].status = Status.Expired;

        uint256 bountyPaid = 0;
        if (yoda.balanceOf(address(this)) >= EXPIRY_BOUNTY) {
            bountyPaid = EXPIRY_BOUNTY;
            yoda.safeTransfer(msg.sender, bountyPaid);
        }
        emit ExpiryFlagged(tokenId, msg.sender, bountyPaid);
    }

    /// @notice Update status. Callable by market contract or current holder.
    function updateStatus(uint256 tokenId, Status newStatus) external onlyValid(tokenId) {
        require(
            msg.sender == market || balanceOf(msg.sender, tokenId) > 0,
            "Not authorized"
        );
        bloodInfo[tokenId].status = newStatus;
        emit StatusUpdated(tokenId, newStatus);
    }

    // ──────────────────────────── Views ────────────────────────────

    function isExpired(uint256 tokenId) public view returns (bool) {
        return block.timestamp > bloodInfo[tokenId].expiryTime;
    }

    // ──────────────────────────── Overrides ────────────────────────

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        for (uint256 i = 0; i < ids.length; i++) {
            require(!isExpired(ids[i]), "BloodRegistry: cannot transfer expired unit");
        }
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
