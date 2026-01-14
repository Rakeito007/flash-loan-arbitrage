// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OwnCapitalArb
 * @dev Simple arbitrage contract using own capital (no flash loans needed)
 * Works on Base Sepolia - trades on Moonwell
 */
interface IMoonwellRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

interface IPriceOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}

contract OwnCapitalArb is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IMoonwellRouter public moonwellRouter;
    IPriceOracle public oracle;

    uint256 public maxGasPrice;
    uint256 public minProfitUSD;
    uint256 public maxTradeAmount; // Maximum trade size

    // Events
    event TradeExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 profitUSD,
        bool success
    );
    event RiskParamsUpdated(uint256 maxGasPrice, uint256 minProfitUSD, uint256 maxTradeAmount);

    constructor(
        address _moonwellRouter,
        address _oracle
    ) Ownable(msg.sender) {
        moonwellRouter = IMoonwellRouter(_moonwellRouter);
        oracle = IPriceOracle(_oracle);
        maxGasPrice = 2 gwei;
        minProfitUSD = 2e8; // $2 (8 decimals)
        maxTradeAmount = 10 ether; // 10 ETH max per trade
    }

    /**
     * @dev Execute arbitrage trade with own capital
     * @param tokenIn Token to sell
     * @param tokenOut Token to buy
     * @param amountIn Amount to trade
     * @param minAmountOut Minimum output (slippage protection)
     */
    function executeTrade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external onlyOwner nonReentrant returns (uint256 profit, uint256 profitUSD) {
        require(tx.gasprice <= maxGasPrice, "GAS_TOO_HIGH");
        require(amountIn > 0, "ZERO_AMOUNT");
        require(amountIn <= maxTradeAmount, "EXCEEDS_MAX_TRADE");
        
        // Check balance
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        require(balance >= amountIn, "INSUFFICIENT_BALANCE");

        // Prepare swap path
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        // Get expected output
        uint256[] memory expectedAmounts = moonwellRouter.getAmountsOut(amountIn, path);
        uint256 expectedOut = expectedAmounts[1];
        
        require(expectedOut >= minAmountOut, "SLIPPAGE_TOO_HIGH");

        // Approve router
        IERC20(tokenIn).approve(address(moonwellRouter), amountIn);

        // Execute swap
        uint256[] memory amounts = moonwellRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 amountOut = amounts[1];
        require(amountOut > 0, "SWAP_FAILED");

        // Calculate profit (simplified - assumes we're buying back the same token)
        // In real arbitrage, you'd swap back to original token
        // For now, we'll calculate profit based on output vs input value
        if (amountOut > amountIn) {
            profit = amountOut - amountIn;
        } else {
            profit = 0;
        }

        // Check profit in USD
        profitUSD = _profitUSD(tokenIn, profit);
        require(profitUSD >= minProfitUSD, "LOW_PROFIT");

        emit TradeExecuted(tokenIn, tokenOut, amountIn, amountOut, profit, profitUSD, true);

        return (profit, profitUSD);
    }

    /**
     * @dev Execute multi-hop arbitrage (e.g., tokenA -> tokenB -> tokenA)
     * @param path Swap path (must end with original token for arbitrage)
     * @param amountIn Amount to trade
     * @param minAmountOut Minimum final output
     */
    function executeMultiHopArb(
        address[] calldata path,
        uint256 amountIn,
        uint256 minAmountOut
    ) external onlyOwner nonReentrant returns (uint256 profit, uint256 profitUSD) {
        require(tx.gasprice <= maxGasPrice, "GAS_TOO_HIGH");
        require(amountIn > 0, "ZERO_AMOUNT");
        require(amountIn <= maxTradeAmount, "EXCEEDS_MAX_TRADE");
        require(path.length >= 2, "INVALID_PATH");
        
        // Check balance
        address tokenIn = path[0];
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        require(balance >= amountIn, "INSUFFICIENT_BALANCE");

        // Get expected output
        uint256[] memory expectedAmounts = moonwellRouter.getAmountsOut(amountIn, path);
        uint256 expectedOut = expectedAmounts[expectedAmounts.length - 1];
        
        require(expectedOut >= minAmountOut, "SLIPPAGE_TOO_HIGH");

        // Approve router
        IERC20(tokenIn).approve(address(moonwellRouter), amountIn);

        // Execute swap
        uint256[] memory amounts = moonwellRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 finalAmount = amounts[amounts.length - 1];
        require(finalAmount > 0, "SWAP_FAILED");

        // Calculate profit (final amount - initial amount)
        if (finalAmount > amountIn) {
            profit = finalAmount - amountIn;
        } else {
            profit = 0;
        }

        // Check profit in USD
        profitUSD = _profitUSD(tokenIn, profit);
        require(profitUSD >= minProfitUSD, "LOW_PROFIT");

        emit TradeExecuted(
            tokenIn, 
            path[path.length - 1], 
            amountIn, 
            finalAmount, 
            profit, 
            profitUSD, 
            true
        );

        return (profit, profitUSD);
    }

    /**
     * @dev Estimate trade profit (view function)
     */
    function estimateProfit(
        address[] calldata path,
        uint256 amountIn
    ) external view returns (uint256 expectedOut, uint256 profit, uint256 profitUSD) {
        uint256[] memory amounts = moonwellRouter.getAmountsOut(amountIn, path);
        expectedOut = amounts[amounts.length - 1];
        
        if (expectedOut > amountIn) {
            profit = expectedOut - amountIn;
            profitUSD = _profitUSD(path[0], profit);
        } else {
            profit = 0;
            profitUSD = 0;
        }
    }

    /**
     * @dev Update risk parameters
     */
    function updateRiskParams(
        uint256 gasCap,
        uint256 profit,
        uint256 maxTrade
    ) external onlyOwner {
        require(gasCap > 0, "INVALID_GAS");
        require(profit > 0, "INVALID_PROFIT");
        
        maxGasPrice = gasCap;
        minProfitUSD = profit;
        maxTradeAmount = maxTrade;
        
        emit RiskParamsUpdated(gasCap, profit, maxTrade);
    }

    /**
     * @dev Calculate profit in USD using oracle
     */
    function _profitUSD(address asset, uint256 amount) internal view returns (uint256) {
        if (amount == 0) return 0;
        try oracle.getAssetPrice(asset) returns (uint256 price) {
            return (amount * price) / 1e18;
        } catch {
            // Fallback if oracle fails
            return 0;
        }
    }

    /**
     * @dev Deposit tokens to contract for trading
     */
    function deposit(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    /**
     * @dev Withdraw tokens from contract
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @dev Emergency withdraw all tokens
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner(), balance);
    }

    /**
     * @dev Get contract balance
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    receive() external payable {}
}
