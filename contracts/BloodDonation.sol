// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/** * @dev Interface for the BloodRegistry contract to ensure 
 * the 9-argument registerUnit call is recognized.
 */
interface IBloodRegistry {
    function registerUnit(
        address recipient,
        uint8   bloodGroup,
        bool    rhPositive,
        uint8   component,
        uint16  volumeMl,
        uint64  expiryTime,
        string  calldata storageDetails,
        uint8   priority,
        uint256 amount
    ) external returns (uint256);
}

/// @title BloodDonation
/// @notice Handles the reward and ownership swap logic for blood donations.
contract BloodDonation is Ownable {
    using SafeERC20 for IERC20;

    IBloodRegistry public immutable registry;
    IERC20 public immutable yoda;

    // 0.01 YODA reward per pint (assuming 18 decimals)
    // 0.01 * 10^18 = 10,000,000,000,000,000 (1e16)
    uint256 public constant REWARD_PER_PINT = 1e16; 

    event BloodDonated(
        address indexed donor, 
        uint256 tokenId, 
        uint256 pints, 
        uint256 rewardPaid
    );

    constructor(address _registry, address _yoda) Ownable(msg.sender) {
        registry = IBloodRegistry(_registry);
        yoda = IERC20(_yoda);
    }

    /**
     * @notice Donor contributes blood.
     * @dev Mints the units directly to the ADMIN so the Market treats it as platform stock.
     * @param bloodGroup 0:A, 1:B, 2:AB, 3:O
     * @param rhPositive True for +, False for -
     * @param component 0:Whole, 1:PRBC, 2:Platelets, 3:Plasma
     * @param volumeMl Volume in milliliters (e.g., 473 for a pint)
     * @param expiryTime Unix timestamp for blood expiration
     * @param storageDetails String describing storage requirements
     * @param pintAmount Number of units/pints donated (multiplier for reward)
     */
    function donate(
        uint8   bloodGroup,
        bool    rhPositive,
        uint8   component,
        uint16  volumeMl,
        uint64  expiryTime,
        string  calldata storageDetails,
        uint256 pintAmount
    ) external {
        require(pintAmount > 0, "Must donate at least 1 pint");

        // 1. MINT TO ADMIN (The owner of this donation contract)
        // This ensures that in BloodMarket, (l.seller == owner()) will be true.
        uint256 tokenId = registry.registerUnit(
            owner(),         // Recipient is the ADMIN
            bloodGroup,
            rhPositive,
            component,
            volumeMl,
            expiryTime,
            storageDetails,
            1,               // Default Priority
            pintAmount       // Number of tokens (pints)
        );

        // 2. CALCULATE AND PAY REWARD
        uint256 totalReward = pintAmount * REWARD_PER_PINT;
        
        require(
            yoda.balanceOf(address(this)) >= totalReward, 
            "Reward pool empty, contact admin"
        );
        
        yoda.safeTransfer(msg.sender, totalReward);

        emit BloodDonated(msg.sender, tokenId, pintAmount, totalReward);
    }

    /**
     * @notice Allows Admin to fund the contract with YODA or withdraw tokens.
     */
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
