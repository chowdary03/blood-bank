// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title YodaToken
/// @notice ERC-20 fungible token used as the settlement currency in the Blood Marketplace.
contract YodaToken is ERC20, Ownable {
    /// @notice Deploys the token with a name, symbol, and optional initial supply.
    /// @param initialSupply Amount (in whole tokens) minted to the deployer. Pass 0 to start with no supply.
    constructor(uint256 initialSupply) ERC20("YODA", "YODA") Ownable(msg.sender) {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply * 10 ** decimals());
        }
    }

    /// @notice Allows the owner to mint additional YODA tokens.
    /// @param to Recipient address.
    /// @param amount Amount in wei (smallest unit).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
