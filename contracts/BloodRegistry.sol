// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BloodRegistry
/// @notice ERC-1155 contract that tokenizes blood units with decentralized verification and expiry management.
contract BloodRegistry is ERC1155, AccessControl {
    using SafeERC20 for IERC20;

    // ──────────────────────────── Roles ─────────────────────────────
    
    bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

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

    struct BloodInfo {
        uint8   bloodGroup;      // 0:A, 1:B, 2:AB, 3:O
        bool    rhPositive;      // true = Rh+, false = Rh-
        uint8   component;       // 0:Whole, 1:PRBC, 2:Platelets, 3:Plasma
        uint16  volumeMl;        
        uint64  collectionTime;  
        uint64  expiryTime;      
        string  storageDetails;  
        uint8   priority;        // 0-255 urgency
        Status  status;          
        address donor;           
        bool    isScreened;      // B. Verification Feature
        address verifier;        // Address of the lab that screened the unit
    }

    // ──────────────────────────── State ────────────────────────────

    uint256 public nextTokenId;
    mapping(uint256 => BloodInfo) public bloodInfo;

    address public market;
    IERC20 public yoda;
    uint256 public constant EXPIRY_BOUNTY = 1 * 10**18; // Example: 1 YODA

    // ──────────────────────────── Events ───────────────────────────

    event UnitRegistered(uint256 indexed tokenId, address indexed donor);
    event StatusUpdated(uint256 indexed tokenId, Status current);
    event UnitVerified(uint256 indexed tokenId, address indexed lab);
    event ExpiryFlagged(uint256 indexed tokenId, address indexed flagger, uint256 bountyPaid);
    event UnitConsumed(uint256 indexed tokenId, address indexed medicalFacility, uint256 amount);

    // ──────────────────────────── Modifiers ────────────────────────

    modifier onlyValid(uint256 tokenId) {
        require(!isExpired(tokenId), "BloodRegistry: unit has expired");
        require(bloodInfo[tokenId].status != Status.Discarded, "BloodRegistry: unit discarded");
        _;
    }

    // ──────────────────────────── Constructor ──────────────────────

    constructor(string memory uri_, address yoda_) ERC1155(uri_) {
        _grantRole(ADMIN_ROLE, msg.sender);
        yoda = IERC20(yoda_);
    }

    // ──────────────────────────── Admin ────────────────────────────

    function setMarket(address market_) external onlyRole(ADMIN_ROLE) {
        require(market_ != address(0), "Zero address");
        market = market_;
    }

    // ──────────────────────────── Core ─────────────────────────────

    /**
     * @notice Registers a new blood donation.
     * @dev Added expiry checks and initial screening status.
     */
    function registerUnit(
        uint8   bloodGroup,
        bool    rhPositive,
        uint8   component,
        uint16  volumeMl,
        uint64  expiryTime,
        string calldata storageDetails,
        uint8   priority,
        uint256 amount
    ) external returns (uint256 tokenId) {
        require(amount > 0, "Amount > 0");
        require(expiryTime > block.timestamp, "Expiry must be in future");

        tokenId = nextTokenId++;

        bloodInfo[tokenId] = BloodInfo({
            bloodGroup: bloodGroup,
            rhPositive: rhPositive,
            component: component,
            volumeMl: volumeMl,
            collectionTime: uint64(block.timestamp),
            expiryTime: expiryTime,
            storageDetails: storageDetails,
            priority: priority,
            status: Status.Available,
            donor: msg.sender,
            isScreened: false,
            verifier: address(0)
        });

        _mint(msg.sender, tokenId, amount, "");
        emit UnitRegistered(tokenId, msg.sender);
    }

    /**
     * @notice B. Verification "Attestations"
     * @dev Only verified labs can certify that blood is screened and safe.
     */
    function verifyScreening(uint256 tokenId) external onlyRole(LAB_ROLE) onlyValid(tokenId) {
        BloodInfo storage info = bloodInfo[tokenId];
        info.isScreened = true;
        info.verifier = msg.sender;
        
        emit UnitVerified(tokenId, msg.sender);
    }

    /**
     * @notice C. The "Burn-on-Transfusion"
     * @dev Removes the token from circulation once used by a medical facility.
     */
    function consumeUnit(uint256 tokenId, uint256 amount) external onlyValid(tokenId) {
        require(balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
        
        _burn(msg.sender, tokenId, amount);
        
        // If all units of this ID are consumed, update global status
        if (totalSupply(tokenId) == 0) {
            bloodInfo[tokenId].status = Status.Transfused;
        }

        emit UnitConsumed(tokenId, msg.sender, amount);
    }

    /**
     * @notice A. Automated Expiry Management (Incentive)
     * @dev Anyone can flag an expired unit to clean the registry and earn a reward.
     */
    function flagExpired(uint256 tokenId) external {
        require(isExpired(tokenId), "Not yet expired");
        require(bloodInfo[tokenId].status != Status.Expired, "Already marked");

        bloodInfo[tokenId].status = Status.Expired;

        // Optional: Transfer bounty from a protocol reserve to the flagger
        if (yoda.balanceOf(address(this)) >= EXPIRY_BOUNTY) {
            yoda.safeTransfer(msg.sender, EXPIRY_BOUNTY);
        }

        emit ExpiryFlagged(tokenId, msg.sender, EXPIRY_BOUNTY);
    }

    // ──────────────────────────── View/Overrides ────────────────────

    function updateStatus(uint256 tokenId, Status newStatus) external onlyValid(tokenId) {
        require(
            msg.sender == market || balanceOf(msg.sender, tokenId) > 0,
            "Not authorized"
        );
        bloodInfo[tokenId].status = newStatus;
        emit StatusUpdated(tokenId, newStatus);
    }

    function isExpired(uint256 tokenId) public view returns (bool) {
        return block.timestamp > bloodInfo[tokenId].expiryTime;
    }

    /**
     * @dev A. Added automated expiry check to standard transfers.
     */
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        for (uint256 i = 0; i < ids.length; i++) {
            require(!isExpired(ids[i]), "BloodRegistry: cannot transfer expired unit");
        }
        super._update(from, to, ids, values);
    }

    // Necessary override for AccessControl + ERC1155
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
