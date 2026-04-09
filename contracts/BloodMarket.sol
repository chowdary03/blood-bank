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

    constructor(address yoda_, address registry_) Ownable(msg.sender) {
        yoda = IERC20(yoda_);
        registry = BloodRegistry(registry_);
    }

    function createListing(uint256 tokenId, uint256 amount, uint256 pricePerUnit) external nonReentrant {
        require(registry.balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
        
        uint256 listingId = nextListingId++;
        listings[listingId] = Listing(listingId, msg.sender, tokenId, amount, pricePerUnit, true);
    }

    function buy(uint256 listingId, uint256 amount) external nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active && amount <= l.amount, "Listing not active or amount too high");

        uint256 totalCost = amount * l.pricePerUnit;

        if (l.seller == owner()) {
            /** * PATH A: PLATFORM SALE (Admin sells donated blood)
             * Admin gets 100% of the funds.
             */
            yoda.safeTransferFrom(msg.sender, owner(), totalCost);
        } else {
            /** * PATH B: P2P SALE (User sells to User)
             * Admin gets 5% fee, Seller gets 95%.
             */
            uint256 fee = (totalCost * P2P_FEE_BPS) / 10_000;
            uint256 sellerProceeds = totalCost - fee;

            yoda.safeTransferFrom(msg.sender, l.seller, sellerProceeds);
            yoda.safeTransferFrom(msg.sender, owner(), fee);
        }

        // Move the Blood Unit
        registry.safeTransferFrom(l.seller, msg.sender, l.tokenId, amount, "");

        l.amount -= amount;
        if (l.amount == 0) {
            l.active = false;
            registry.updateStatus(l.tokenId, BloodRegistry.Status.Sold);
        }
    }
}
