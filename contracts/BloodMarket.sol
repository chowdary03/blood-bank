// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BloodRegistry.sol";

contract BloodMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        uint256 id;
        address seller;       
        uint256 tokenId;      
        uint256 amount;       
        uint256 pricePerUnit; 
        bool active;
    }

    IERC20 public immutable yoda;
    BloodRegistry public immutable registry;
    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;
    
    uint256 public constant P2P_FEE_BPS = 500; // 5%

    event ListingCreated(
        uint256 indexed id,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 pricePerUnit
    );
    event ListingFilled(
        uint256 indexed id,
        address indexed buyer,
        uint256 amount,
        uint256 totalPaid
    );
    event ListingCancelled(uint256 indexed id, address indexed seller);

    constructor(address yoda_, address registry_) Ownable(msg.sender) {
        yoda = IERC20(yoda_);
        registry = BloodRegistry(registry_);
    }

    /// @notice List blood tokens for sale.
    /// @dev Tokens are transferred INTO this contract (escrow) to prevent double-listing.
    ///      The seller must have called registry.setApprovalForAll(market, true) first.
    function createListing(uint256 tokenId, uint256 amount, uint256 pricePerUnit) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(pricePerUnit > 0, "Price must be > 0");
        require(registry.balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");

        // Lock tokens in escrow — prevents the same tokens being listed twice
        registry.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing(listingId, msg.sender, tokenId, amount, pricePerUnit, true);
        emit ListingCreated(listingId, msg.sender, tokenId, amount, pricePerUnit);
    }

    /// @notice Seller can cancel their listing and reclaim escrowed tokens.
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "Listing not active");
        require(l.seller == msg.sender, "Not your listing");

        l.active = false;
        // Return escrowed tokens to seller
        registry.safeTransferFrom(address(this), l.seller, l.tokenId, l.amount, "");
        emit ListingCancelled(listingId, msg.sender);
    }

    function buy(uint256 listingId, uint256 amount) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active && amount <= l.amount, "Listing not active or amount too high");

        uint256 totalCost = amount * l.pricePerUnit;

        if (l.seller == owner()) {
            // PATH A: PLATFORM SALE — admin sells donated blood, gets 100%
            yoda.safeTransferFrom(msg.sender, owner(), totalCost);
        } else {
            // PATH B: P2P SALE — seller gets 95%, admin gets 5% fee
            uint256 fee = (totalCost * P2P_FEE_BPS) / 10_000;
            uint256 sellerProceeds = totalCost - fee;
            yoda.safeTransferFrom(msg.sender, l.seller, sellerProceeds);
            yoda.safeTransferFrom(msg.sender, owner(), fee);
        }

        // Release escrowed tokens from this contract to the buyer
        registry.safeTransferFrom(address(this), msg.sender, l.tokenId, amount, "");

        l.amount -= amount;
        if (l.amount == 0) {
            l.active = false;
        }
        emit ListingFilled(listingId, msg.sender, amount, totalCost);
    }

    /// @notice Required so this contract can receive ERC-1155 tokens (escrow).
    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }
}
