// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BloodRegistry.sol";

/// @title BloodDonation
/// @notice Handles altruistic blood donations.
/// @dev Flow:
///   1. Donor calls `donate(...)` with blood details.
///   2. Blood tokens are minted to the ADMIN (owner), not the donor.
///   3. Donor receives a small YODA appreciation reward from this contract's balance.
///   4. Admin later lists donated blood on BloodMarket at a FLAT RATE (cheaper
///      than P2P sellers) — since seller == owner, BloodMarket PATH A gives
///      admin 100% of sale proceeds.
///
///   This contract needs MINTER_ROLE on BloodRegistry so it can mint to admin.
///   Admin must pre-fund this contract with YODA for appreciation payouts.
contract BloodDonation is Ownable {
    using SafeERC20 for IERC20;

    // ──────────────────────────── State ────────────────────────────

    BloodRegistry public immutable registry;
    IERC20 public immutable yoda;

    /// @notice YODA reward paid to each altruistic donor (in wei).
    uint256 public appreciationReward;

    // ──────────────────────────── Events ───────────────────────────

    event Donated(
        uint256 indexed tokenId,
        address indexed donor,
        address indexed mintedTo,
        uint256 amount,
        uint256 rewardPaid
    );
    event RewardUpdated(uint256 oldReward, uint256 newReward);

    // ──────────────────────────── Constructor ──────────────────────

    /// @param registry_          Address of BloodRegistry.
    /// @param yoda_              Address of YodaToken.
    /// @param appreciationReward_ Initial YODA reward per donation (in wei, e.g. 5 * 10^18 = 5 YODA).
    constructor(
        address registry_,
        address yoda_,
        uint256 appreciationReward_
    ) Ownable(msg.sender) {
        require(registry_ != address(0), "Zero registry");
        require(yoda_ != address(0), "Zero yoda");
        registry = BloodRegistry(registry_);
        yoda = IERC20(yoda_);
        appreciationReward = appreciationReward_;
    }

    // ──────────────────────────── Admin ────────────────────────────

    /// @notice Admin adjusts the appreciation reward amount.
    function setReward(uint256 newReward) external onlyOwner {
        emit RewardUpdated(appreciationReward, newReward);
        appreciationReward = newReward;
    }

    /// @notice Admin withdraws excess YODA from this contract.
    function withdrawYoda(uint256 amount) external onlyOwner {
        yoda.safeTransfer(msg.sender, amount);
    }

    // ──────────────────────────── Core ─────────────────────────────

    /// @notice Altruistic donor registers blood. Tokens go to admin, donor gets YODA reward.
    /// @param bloodGroup   0:A, 1:B, 2:AB, 3:O
    /// @param rhPositive   Rh factor
    /// @param component    0:Whole, 1:PRBC, 2:Platelets, 3:Plasma
    /// @param expiryTime   Expiry unix timestamp
    /// @param metadataHash keccak256 of the full off-chain metadata JSON
    /// @param amount       Number of units
    /// @return tokenId     Newly minted token ID
    function donate(
        uint8   bloodGroup,
        bool    rhPositive,
        uint8   component,
        uint64  expiryTime,
        bytes32 metadataHash,
        uint256 amount
    ) external returns (uint256 tokenId) {
        // Mint blood tokens to the admin (owner), not the donor.
        // This contract must hold MINTER_ROLE on BloodRegistry.
        tokenId = registry.registerUnit(
            owner(),        // recipient = admin
            bloodGroup,
            rhPositive,
            component,
            expiryTime,
            metadataHash,
            amount,
            msg.sender      // actualDonor = the real human who called donate()
        );

        // Pay appreciation reward to donor (if contract has enough YODA)
        uint256 rewardPaid = 0;
        if (appreciationReward > 0 && yoda.balanceOf(address(this)) >= appreciationReward) {
            rewardPaid = appreciationReward;
            yoda.safeTransfer(msg.sender, rewardPaid);
        }

        emit Donated(tokenId, msg.sender, owner(), amount, rewardPaid);
    }
}
