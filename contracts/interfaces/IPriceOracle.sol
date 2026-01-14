// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPriceOracle
 * @dev Interface for price oracles (Chainlink, etc.)
 */
interface IPriceOracle {
    function getAssetPrice(address asset) external view returns (uint256);
    
    function getAssetPrices(address[] calldata assets) 
        external 
        view 
        returns (uint256[] memory);
}
