// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title BloodRegistry
/// @notice ERC-1155 contract that tokenizes blood donation units and stores their metadata.
contract BloodRegistry is ERC1155, Ownable {

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
        uint16  volumeMl;        // approximate volume in ml
        uint64  collectionTime;  // block.timestamp when registered
        uint64  expiryTime;      // donor-specified expiry
        string  storageDetails;  // free-form string (e.g. "Home freezer")
        uint8   priority;        // 0-255 urgency indicator
        Status  status;          // lifecycle status
        address donor;           // original registrant
    }

    // ──────────────────────────── State ────────────────────────────

    uint256 public nextTokenId;
    mapping(uint256 => BloodInfo) public bloodInfo;

    /// @notice Address of the BloodMarket contract, allowed to update status.
    address public market;

    // ──────────────────────────── Events ───────────────────────────

    event UnitRegistered(uint256 indexed tokenId, address indexed donor, BloodInfo info);
    event StatusUpdated(uint256 indexed tokenId, Status previous, Status current);

    // ──────────────────────────── Constructor ──────────────────────

    /// @param uri_ Metadata URI template (e.g. "https://api.example.com/blood/{id}.json").
    constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) {}

    // ──────────────────────────── Admin ────────────────────────────

    /// @notice Sets the marketplace contract address. Call once after deploying BloodMarket.
    /// @param market_ Address of the BloodMarket contract.
    function setMarket(address market_) external onlyOwner {
        require(market_ != address(0), "BloodRegistry: zero address");
        market = market_;
    }

    // ──────────────────────────── Core ─────────────────────────────

    /// @notice Registers a new blood donation and mints ERC-1155 tokens to the caller.
    /// @param bloodGroup   Blood group code (0:A, 1:B, 2:AB, 3:O).
    /// @param rhPositive   Rh factor (true = positive).
    /// @param component    Component code (0:Whole, 1:PRBC, 2:Platelets, 3:Plasma).
    /// @param volumeMl     Approximate volume in millilitres.
    /// @param expiryTime   Unix timestamp after which the unit is considered expired.
    /// @param storageDetails Free-form storage description.
    /// @param priority     Urgency indicator (0-255).
    /// @param amount       Number of fungible units to mint for this token ID.
    /// @return tokenId     The newly assigned token ID.
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
        require(amount > 0, "BloodRegistry: amount must be > 0");
        require(volumeMl > 0, "BloodRegistry: volumeMl must be > 0");
        require(expiryTime > block.timestamp, "BloodRegistry: expiry must be in the future");

        tokenId = nextTokenId++;

        BloodInfo storage info = bloodInfo[tokenId];
        info.bloodGroup     = bloodGroup;
        info.rhPositive     = rhPositive;
        info.component      = component;
        info.volumeMl       = volumeMl;
        info.collectionTime = uint64(block.timestamp);
        info.expiryTime     = expiryTime;
        info.storageDetails = storageDetails;
        info.priority       = priority;
        info.status         = Status.Available;
        info.donor          = msg.sender;

        _mint(msg.sender, tokenId, amount, "");

        emit UnitRegistered(tokenId, msg.sender, info);
    }

    /// @notice Updates the lifecycle status of a blood token.
    /// @dev Callable by the market contract or the current token holder.
    /// @param tokenId   Token ID to update.
    /// @param newStatus New status value.
    function updateStatus(uint256 tokenId, Status newStatus) external {
        require(
            msg.sender == market || balanceOf(msg.sender, tokenId) > 0,
            "BloodRegistry: not authorized"
        );
        Status previous = bloodInfo[tokenId].status;
        bloodInfo[tokenId].status = newStatus;
        emit StatusUpdated(tokenId, previous, newStatus);
    }

    /// @notice Checks whether a blood token has passed its expiry time.
    /// @param tokenId Token ID to check.
    /// @return True if the current block timestamp is past the token's expiryTime.
    function isExpired(uint256 tokenId) external view returns (bool) {
        return block.timestamp > bloodInfo[tokenId].expiryTime;
    }
}
