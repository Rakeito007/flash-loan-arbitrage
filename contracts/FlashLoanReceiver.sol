// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title FlashLoanReceiver
 * @dev Low-risk flash loan receiver with safety mechanisms
 * Integrates with Aave V3 for flash loans
 * Note: This is the original contract - BaseMEVArb.sol is the advanced version
 */

contract FlashLoanReceiver is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IPoolAddressesProvider public immutable addressesProvider;
    IPool public immutable pool;

    // Safety parameters
    uint256 public maxLoanAmount; // Maximum loan amount per transaction
    uint256 public minProfitThreshold; // Minimum profit required (in basis points, e.g., 50 = 0.5%)
    uint256 public maxSlippageBps; // Maximum acceptable slippage (in basis points)
    
    // DEX addresses
    address public aaveSwapRouter; // Aave swap router address
    address public moonwellRouter; // Moonwell router address
    
    // Events
    event FlashLoanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 profit,
        bool success
    );
    event SafetyParamsUpdated(
        uint256 maxLoanAmount,
        uint256 minProfitThreshold,
        uint256 maxSlippageBps
    );
    event ArbitrageExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit
    );
    event RoutersUpdated(address aaveRouter, address moonwellRouter);

    constructor(
        address _addressesProvider,
        address _aaveSwapRouter,
        address _moonwellRouter,
        uint256 _maxLoanAmount,
        uint256 _minProfitThreshold,
        uint256 _maxSlippageBps
    ) Ownable(msg.sender) {
        addressesProvider = IPoolAddressesProvider(_addressesProvider);
        pool = IPool(addressesProvider.getPool());
        aaveSwapRouter = _aaveSwapRouter;
        moonwellRouter = _moonwellRouter;
        maxLoanAmount = _maxLoanAmount;
        minProfitThreshold = _minProfitThreshold;
        maxSlippageBps = _maxSlippageBps;
    }

    /**
     * @dev Execute flash loan with safety checks
     * @param asset The address of the asset to borrow
     * @param amount The amount to borrow
     * @param params Additional parameters for the operation
     */
    function executeFlashLoan(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= maxLoanAmount, "Amount exceeds maximum loan limit");
        
        // Store initial balance for profit calculation
        uint256 initialBalance = IERC20(asset).balanceOf(address(this));
        
        // Execute flash loan
        pool.flashLoanSimple(
            address(this),
            asset,
            amount,
            params,
            0 // referral code
        );
    }

    /**
     * @dev Aave flash loan callback
     * This function executes the arbitrage: Buy on Aave, Sell on Moonwell
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == address(pool), "Only pool can call this");
        
        // Decode arbitrage parameters
        (
            address tokenToBuy,      // Token to buy on Aave
            address tokenToSell,      // Token to sell on Moonwell (usually same as tokenToBuy)
            uint256 minAmountOutAave, // Minimum amount out from Aave swap
            uint256 minAmountOutMoonwell // Minimum amount out from Moonwell swap
        ) = abi.decode(params, (address, address, uint256, uint256));

        // Calculate total amount to repay (loan + premium)
        uint256 amountOwed = amount + premium;
        
        // Store initial balance of the asset we borrowed
        uint256 initialBalance = IERC20(asset).balanceOf(address(this));
        require(initialBalance >= amount, "Insufficient flash loan received");

        // ============================================
        // STEP 1: Buy tokenToBuy on Aave using flash loaned asset
        // ============================================
        IERC20(asset).approve(aaveSwapRouter, amount);
        
        // Prepare swap path: [asset] -> [tokenToBuy]
        address[] memory aavePath = new address[](2);
        aavePath[0] = asset;
        aavePath[1] = tokenToBuy;
        
        // Get expected output from Aave (for slippage check)
        uint256[] memory aaveAmountsOut = ISwapRouter(aaveSwapRouter).getAmountsOut(amount, aavePath);
        uint256 expectedAaveOut = aaveAmountsOut[1];
        
        // Apply slippage protection
        uint256 minAaveOut = minAmountOutAave > 0 
            ? minAmountOutAave 
            : (expectedAaveOut * (10000 - maxSlippageBps)) / 10000;
        
        require(expectedAaveOut >= minAaveOut, "Aave slippage too high");
        
        // Execute swap on Aave
        uint256[] memory aaveAmounts = ISwapRouter(aaveSwapRouter).swapExactTokensForTokens(
            amount,
            minAaveOut,
            aavePath,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        );
        
        uint256 tokensBought = aaveAmounts[1];
        require(tokensBought > 0, "Aave swap failed");

        // ============================================
        // STEP 2: Sell tokenToSell on Moonwell
        // ============================================
        IERC20(tokenToSell).approve(moonwellRouter, tokensBought);
        
        // Prepare swap path: [tokenToSell] -> [asset] (back to original asset)
        address[] memory moonwellPath = new address[](2);
        moonwellPath[0] = tokenToSell;
        moonwellPath[1] = asset;
        
        // Get expected output from Moonwell
        uint256[] memory moonwellAmountsOut = ISwapRouter(moonwellRouter).getAmountsOut(
            tokensBought, 
            moonwellPath
        );
        uint256 expectedMoonwellOut = moonwellAmountsOut[1];
        
        // Apply slippage protection
        uint256 minMoonwellOut = minAmountOutMoonwell > 0
            ? minAmountOutMoonwell
            : (expectedMoonwellOut * (10000 - maxSlippageBps)) / 10000;
        
        require(expectedMoonwellOut >= minMoonwellOut, "Moonwell slippage too high");
        
        // Execute swap on Moonwell
        uint256[] memory moonwellAmounts = ISwapRouter(moonwellRouter).swapExactTokensForTokens(
            tokensBought,
            minMoonwellOut,
            moonwellPath,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        );
        
        uint256 tokensReceived = moonwellAmounts[1];
        require(tokensReceived > 0, "Moonwell swap failed");

        // ============================================
        // STEP 3: Calculate profit and verify
        // ============================================
        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        require(finalBalance >= amountOwed, "Insufficient balance to repay loan");
        
        // Calculate profit (final balance - amount owed)
        uint256 profit = finalBalance > amountOwed 
            ? finalBalance - amountOwed 
            : 0;
        
        // Safety check: ensure minimum profit threshold is met
        if (profit > 0) {
            uint256 profitBps = (profit * 10000) / amount;
            require(profitBps >= minProfitThreshold, "Profit below minimum threshold");
        } else {
            revert("Arbitrage not profitable");
        }
        
        // ============================================
        // STEP 4: Repay the flash loan + premium
        // ============================================
        IERC20(asset).approve(address(pool), amountOwed);
        
        emit ArbitrageExecuted(asset, tokenToBuy, amount, tokensReceived, profit);
        emit FlashLoanExecuted(asset, amount, profit, true);
        
        return true;
    }

    /**
     * @dev Update safety parameters (only owner)
     */
    function updateSafetyParams(
        uint256 _maxLoanAmount,
        uint256 _minProfitThreshold,
        uint256 _maxSlippageBps
    ) external onlyOwner {
        require(_minProfitThreshold <= 1000, "Profit threshold too high"); // Max 10%
        require(_maxSlippageBps <= 1000, "Slippage too high"); // Max 10%
        
        maxLoanAmount = _maxLoanAmount;
        minProfitThreshold = _minProfitThreshold;
        maxSlippageBps = _maxSlippageBps;
        
        emit SafetyParamsUpdated(_maxLoanAmount, _minProfitThreshold, _maxSlippageBps);
    }

    /**
     * @dev Emergency function to withdraw tokens (only owner)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @dev Update router addresses (only owner)
     */
    function updateRouters(address _aaveRouter, address _moonwellRouter) external onlyOwner {
        require(_aaveRouter != address(0), "Invalid Aave router");
        require(_moonwellRouter != address(0), "Invalid Moonwell router");
        aaveSwapRouter = _aaveRouter;
        moonwellRouter = _moonwellRouter;
        emit RoutersUpdated(_aaveRouter, _moonwellRouter);
    }

    /**
     * @dev Get current safety parameters
     */
    function getSafetyParams() external view returns (
        uint256 _maxLoanAmount,
        uint256 _minProfitThreshold,
        uint256 _maxSlippageBps
    ) {
        return (maxLoanAmount, minProfitThreshold, maxSlippageBps);
    }

    /**
     * @dev Get router addresses
     */
    function getRouters() external view returns (address _aaveRouter, address _moonwellRouter) {
        return (aaveSwapRouter, moonwellRouter);
    }

    /**
     * @dev Estimate arbitrage profit (view function, doesn't execute)
     * @param asset The asset to flash loan
     * @param amount The amount to borrow
     * @param tokenToBuy The token to buy on Aave
     * @param tokenToSell The token to sell on Moonwell
     * @return estimatedProfit Estimated profit in asset tokens
     * @return premium Flash loan premium
     */
    function estimateArbitrageProfit(
        address asset,
        uint256 amount,
        address tokenToBuy,
        address tokenToSell
    ) external view returns (uint256 estimatedProfit, uint256 premium) {
        // Estimate premium (typically 0.09% for Aave)
        premium = (amount * 9) / 10000;
        
        // Get Aave swap output
        address[] memory aavePath = new address[](2);
        aavePath[0] = asset;
        aavePath[1] = tokenToBuy;
        uint256[] memory aaveAmounts = ISwapRouter(aaveSwapRouter).getAmountsOut(amount, aavePath);
        uint256 tokensFromAave = aaveAmounts[1];
        
        // Get Moonwell swap output
        address[] memory moonwellPath = new address[](2);
        moonwellPath[0] = tokenToSell;
        moonwellPath[1] = asset;
        uint256[] memory moonwellAmounts = ISwapRouter(moonwellRouter).getAmountsOut(
            tokensFromAave, 
            moonwellPath
        );
        uint256 tokensFromMoonwell = moonwellAmounts[1];
        
        // Calculate profit
        uint256 amountOwed = amount + premium;
        if (tokensFromMoonwell > amountOwed) {
            estimatedProfit = tokensFromMoonwell - amountOwed;
        } else {
            estimatedProfit = 0;
        }
    }
}
