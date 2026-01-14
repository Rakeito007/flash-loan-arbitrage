// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAavePool
 * @dev Interface for Aave pool swap operations
 */
interface IAavePool {
    function swap(
        address asset,
        uint256 amount,
        uint256 minAmountOut,
        address to
    ) external returns (uint256);
}
