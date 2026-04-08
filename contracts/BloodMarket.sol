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
        address seller;       // current owner of the blood tokens
        uint256 tokenId;      // BloodRegistry token ID
        uint256 amount;       // units available for sale
        uint256 pricePerUnit; // YODA wei per unit
        uint64  createdAt;
        bool    active;
    }

    // ──────────────────────────── State ────────────────────────────

    IERC20 public immutable yoda;
    BloodRegistry public immutable registry;

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    /// @notice Protocol fee in basis points (100 = 1%). Max 10 000 (100%).
    uint16 public protocolFeeBps;

    /// @notice Address that receives protocol fees.
    address public feeRecipient;

    // ──────────────────────────── Events ───────────────────────────

    event ListingCreated(
        uint256 indexed id,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 pricePerUnit
    );
    event ListingUpdated(uint256 indexed id, uint256 newAmount);
    event ListingCancelled(uint256 indexed id);
    event ListingFilled(
        uint256 indexed id,
        address indexed buyer,
        uint256 amount,
        uint256 totalPaid
    );

    // ──────────────────────────── Constructor ──────────────────────

    /// @param yoda_     Address of the deployed YodaToken contract.
    /// @param registry_ Address of the deployed BloodRegistry contract.
    constructor(address yoda_, address registry_) Ownable(msg.sender) {
        require(yoda_ != address(0), "BloodMarket: zero yoda address");
        require(registry_ != address(0), "BloodMarket: zero registry address");
        yoda = IERC20(yoda_);
        registry = BloodRegistry(registry_);
    }

    // ──────────────────────────── Admin ────────────────────────────

    /// @notice Configures the protocol fee and recipient. Only callable by the owner.
    /// @param protocolFeeBps_ Fee in basis points (max 10 000).
    /// @param feeRecipient_   Address that receives collected fees.
    function setFees(uint16 protocolFeeBps_, address feeRecipient_) external onlyOwner {
        require(protocolFeeBps_ <= 10_000, "BloodMarket: fee exceeds 100%");
        if (protocolFeeBps_ > 0) {
            require(feeRecipient_ != address(0), "BloodMarket: zero fee recipient");
        }
        protocolFeeBps = protocolFeeBps_;
        feeRecipient = feeRecipient_;
    }

    // ──────────────────────────── Listings ─────────────────────────

    /// @notice Creates a new listing for blood tokens. Seller must have already called
    ///         `BloodRegistry.setApprovalForAll(thisContract, true)`.
    /// @param tokenId      BloodRegistry token ID to list.
    /// @param amount       Number of units to sell.
    /// @param pricePerUnit Price in YODA wei per unit.
    /// @return listingId   The newly assigned listing ID.
    function createListing(
        uint256 tokenId,
        uint256 amount,
        uint256 pricePerUnit
    ) external nonReentrant returns (uint256 listingId) {
        require(amount > 0, "BloodMarket: amount must be > 0");
        require(pricePerUnit > 0, "BloodMarket: price must be > 0");
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
        l.createdAt    = uint64(block.timestamp);
        l.active       = true;

        emit ListingCreated(listingId, msg.sender, tokenId, amount, pricePerUnit);
    }

    /// @notice Cancels an active listing. Only the original seller can cancel.
    /// @param listingId ID of the listing to cancel.
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "BloodMarket: listing not active");
        require(msg.sender == l.seller, "BloodMarket: not the seller");

        l.active = false;
        emit ListingCancelled(listingId);
    }

    /// @notice Purchases blood tokens from an active listing.
    /// @dev Buyer must have approved this contract to spend sufficient YODA beforehand.
    /// @param listingId ID of the listing to buy from.
    /// @param amount    Number of units to purchase (can be partial).
    function buy(uint256 listingId, uint256 amount) external nonReentrant {
        Listing storage l = listings[listingId];

        require(amount > 0, "BloodMarket: amount must be > 0");
        require(l.active, "BloodMarket: listing not active");
        require(amount <= l.amount, "BloodMarket: exceeds listed amount");
        require(!registry.isExpired(l.tokenId), "BloodMarket: blood token expired");

        // ── Payment calculation ──
        uint256 total = amount * l.pricePerUnit;
        uint256 fee = (total * protocolFeeBps) / 10_000;
        uint256 sellerAmount = total - fee;

        // ── YODA transfers (checks-effects-interactions: state updated after) ──
        yoda.safeTransferFrom(msg.sender, l.seller, sellerAmount);
        if (fee > 0) {
            yoda.safeTransferFrom(msg.sender, feeRecipient, fee);
        }

        // ── Blood token transfer ──
        registry.safeTransferFrom(l.seller, msg.sender, l.tokenId, amount, "");

        // ── Update listing state ──
        l.amount -= amount;
        if (l.amount == 0) {
            l.active = false;
        }

        // ── Optional: mark token as Sold in the registry ──
        // Only update if the full listing amount was consumed to avoid noise.
        if (!l.active) {
            registry.updateStatus(l.tokenId, BloodRegistry.Status.Sold);
        }

        emit ListingFilled(listingId, msg.sender, amount, total);
    }
}
