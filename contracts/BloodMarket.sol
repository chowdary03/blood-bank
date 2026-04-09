// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BloodRegistry.sol";

/// @title BloodMarket
/// @notice Marketplace for listing and purchasing tokenized blood units using YODA tokens.
contract BloodMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────── Structs ──────────────────────────

    struct Listing {
        uint256 id;
        address seller;       
        uint256 tokenId;      
        uint256 amount;       
        uint256 pricePerUnit; 
        uint256 regionCode;   // Numeric identifier for location (Zip, Geohash, etc)
        uint64  createdAt;
        bool    active;
    }

    // ──────────────────────────── State ────────────────────────────

    IERC20 public immutable yoda;
    BloodRegistry public immutable registry;

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    uint16 public protocolFeeBps;
    address public feeRecipient;

    // ──────────────────────────── Events ───────────────────────────

    event ListingCreated(
        uint256 indexed id,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 pricePerUnit,
        uint256 regionCode
    );
    
    /// @notice Specialized event for off-chain indexers to filter by location.
    event RegionalListing(uint256 indexed region, uint256 indexed listingId, uint256 tokenId);

    event ListingUpdated(uint256 indexed id, uint256 newAmount);
    event ListingCancelled(uint256 indexed id);
    event ListingFilled(
        uint256 indexed id,
        address indexed buyer,
        uint256 amount,
        uint256 totalPaid
    );

    // ──────────────────────────── Constructor ──────────────────────

    constructor(address yoda_, address registry_) Ownable(msg.sender) {
        require(yoda_ != address(0), "BloodMarket: zero yoda address");
        require(registry_ != address(0), "BloodMarket: zero registry address");
        yoda = IERC20(yoda_);
        registry = BloodRegistry(registry_);
    }

    // ──────────────────────────── Admin ────────────────────────────

    function setFees(uint16 protocolFeeBps_, address feeRecipient_) external onlyOwner {
        require(protocolFeeBps_ <= 10_000, "BloodMarket: fee exceeds 100%");
        if (protocolFeeBps_ > 0) {
            require(feeRecipient_ != address(0), "BloodMarket: zero fee recipient");
        }
        protocolFeeBps = protocolFeeBps_;
        feeRecipient = feeRecipient_;
    }

    // ──────────────────────────── Listings ─────────────────────────

    /**
     * @notice Creates a new listing for blood tokens.
     * @param tokenId The ERC-1155 token ID from the BloodRegistry.
     * @param amount Units to sell.
     * @param pricePerUnit Price in YODA (wei) per unit.
     * @param regionCode Numeric code for regional discovery (e.g. Geohash or Zip).
     */
    function createListing(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerUnit,
        uint256 regionCode
    ) external nonReentrant returns (uint256 listingId) {
        require(amount > 0, "BloodMarket: amount must be > 0");
        require(pricePerUnit > 0, "BloodMarket: price must be > 0");
        require(!registry.isExpired(tokenId), "BloodMarket: blood unit expired");
        require(
            registry.balanceOf(msg.sender, tokenId) >= amount,
            "BloodMarket: insufficient blood token balance"
        );

        listingId = nextListingId++;

        Listing storage l = listings[listingId];
        l.id           = listingId;
        l.seller       = msg.sender;
        l.tokenId      = tokenId;
        l.amount       = amount;
        l.pricePerUnit = pricePerUnit;
        l.regionCode   = regionCode;
        l.createdAt    = uint64(block.timestamp);
        l.active       = true;

        emit ListingCreated(listingId, msg.sender, tokenId, amount, pricePerUnit, regionCode);
        
        // This event allows your UI to say "Show me blood within 50 miles of me"
        emit RegionalListing(regionCode, listingId, tokenId);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "BloodMarket: listing not active");
        require(msg.sender == l.seller, "BloodMarket: not the seller");

        l.active = false;
        emit ListingCancelled(listingId);
    }

    /**
     * @notice Atomic purchase: YODA goes to seller, Blood goes to buyer.
     */
    function buy(uint256 listingId, uint256 amount) external nonReentrant {
        Listing storage l = listings[listingId];

        require(amount > 0, "BloodMarket: amount must be > 0");
        require(l.active, "Market: listing not active");
        require(amount <= l.amount, "Market: exceeds listed amount");
        require(!registry.isExpired(l.tokenId), "Market: blood unit expired");

        uint256 total = amount * l.pricePerUnit;
        uint256 fee = (total * protocolFeeBps) / 10_000;
        uint256 sellerAmount = total - fee;

        // 1. Update State (Checks-Effects)
        l.amount -= amount;
        if (l.amount == 0) {
            l.active = false;
        }

        // 2. YODA Payment (Interactions)
        yoda.safeTransferFrom(msg.sender, l.seller, sellerAmount);
        if (fee > 0) {
            yoda.safeTransferFrom(msg.sender, feeRecipient, fee);
        }

        // 3. Blood Token Transfer (Interactions)
        registry.safeTransferFrom(l.seller, msg.sender, l.tokenId, amount, "");

        // 4. Update status in Registry if the whole listing is consumed
        if (!l.active) {
            registry.updateStatus(l.tokenId, BloodRegistry.Status.Sold);
        }

        emit ListingFilled(listingId, msg.sender, amount, total);
    }
}
