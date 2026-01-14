// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArbitrageUniswapMoonwell
 * @dev Arbitrage contract that buys on one DEX and sells on another
 * Supports: Uniswap V3 <-> Moonwell arbitrage
 */
interface IUniswapV3Router {
    function exactInputSingle(
        IUniswapV3Router.ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
    
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function getAmountOut(
        uint256 amountIn,
        address tokenIn,
        address tokenOut,
        uint24 fee
    ) external view returns (uint256 amountOut);
}

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

contract ArbitrageUniswapMoonwell is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IUniswapV3Router public uniswapRouter;
    IMoonwellRouter public moonwellRouter;
    IPriceOracle public oracle;

    uint256 public maxGasPrice;
    uint256 public minProfitUSD;
    uint256 public maxTradeAmount;

    // Events
    event ArbitrageExecuted(
        string dexBuy,
        string dexSell,
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
        address _uniswapRouter,
        address _moonwellRouter,
        address _oracle
    ) Ownable(msg.sender) {
        uniswapRouter = IUniswapV3Router(_uniswapRouter);
        moonwellRouter = IMoonwellRouter(_moonwellRouter);
        oracle = IPriceOracle(_oracle);
        maxGasPrice = 2 gwei;
        minProfitUSD = 2e8; // $2
        maxTradeAmount = 10 ether;
    }

    /**
     * @dev Execute arbitrage: Buy on Moonwell, Sell on Uniswap
     * @param tokenIn Token to start with
     * @param tokenOut Token to arbitrage with
     * @param amountIn Amount to trade
     * @param moonwellPath Path for Moonwell swap
     * @param uniswapFee Uniswap V3 pool fee (500, 3000, or 10000)
     * @param minAmountOut Minimum final output
     */
    function arbitrageMoonwellToUniswap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address[] calldata moonwellPath,
        uint24 uniswapFee,
        uint256 minAmountOut
    ) external onlyOwner nonReentrant returns (uint256 profit, uint256 profitUSD) {
        require(tx.gasprice <= maxGasPrice, "GAS_TOO_HIGH");
        require(amountIn > 0 && amountIn <= maxTradeAmount, "INVALID_AMOUNT");
        
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        require(balance >= amountIn, "INSUFFICIENT_BALANCE");

        // Step 1: Buy on Moonwell
        IERC20(tokenIn).approve(address(moonwellRouter), amountIn);
        
        uint256[] memory moonwellAmounts = moonwellRouter.swapExactTokensForTokens(
            amountIn,
            0, // Accept any output (we'll check after)
            moonwellPath,
            address(this),
            block.timestamp + 300
        );
        
        uint256 moonwellOut = moonwellAmounts[moonwellAmounts.length - 1];
        require(moonwellOut > 0, "MOONWELL_SWAP_FAILED");

        // Step 2: Sell on Uniswap
        IERC20(tokenOut).approve(address(uniswapRouter), moonwellOut);
        
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: tokenOut,
            tokenOut: tokenIn,
            fee: uniswapFee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: moonwellOut,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        uint256 uniswapOut = uniswapRouter.exactInputSingle(params);
        require(uniswapOut > 0, "UNISWAP_SWAP_FAILED");

        // Calculate profit
        if (uniswapOut > amountIn) {
            profit = uniswapOut - amountIn;
        } else {
            profit = 0;
        }

        profitUSD = _profitUSD(tokenIn, profit);
        require(profitUSD >= minProfitUSD, "LOW_PROFIT");

        emit ArbitrageExecuted(
            "Moonwell",
            "Uniswap",
            tokenIn,
            tokenOut,
            amountIn,
            uniswapOut,
            profit,
            profitUSD,
            true
        );

        return (profit, profitUSD);
    }

    /**
     * @dev Execute arbitrage: Buy on Uniswap, Sell on Moonwell
     * @param tokenIn Token to start with
     * @param tokenOut Token to arbitrage with
     * @param amountIn Amount to trade
     * @param uniswapFee Uniswap V3 pool fee
     * @param moonwellPath Path for Moonwell swap
     * @param minAmountOut Minimum final output
     */
    function arbitrageUniswapToMoonwell(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 uniswapFee,
        address[] calldata moonwellPath,
        uint256 minAmountOut
    ) external onlyOwner nonReentrant returns (uint256 profit, uint256 profitUSD) {
        require(tx.gasprice <= maxGasPrice, "GAS_TOO_HIGH");
        require(amountIn > 0 && amountIn <= maxTradeAmount, "INVALID_AMOUNT");
        
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        require(balance >= amountIn, "INSUFFICIENT_BALANCE");

        // Step 1: Buy on Uniswap
        IERC20(tokenIn).approve(address(uniswapRouter), amountIn);
        
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: uniswapFee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: 0, // Accept any output
            sqrtPriceLimitX96: 0
        });
        
        uint256 uniswapOut = uniswapRouter.exactInputSingle(params);
        require(uniswapOut > 0, "UNISWAP_SWAP_FAILED");

        // Step 2: Sell on Moonwell
        IERC20(tokenOut).approve(address(moonwellRouter), uniswapOut);
        
        uint256[] memory moonwellAmounts = moonwellRouter.swapExactTokensForTokens(
            uniswapOut,
            minAmountOut,
            moonwellPath,
            address(this),
            block.timestamp + 300
        );
        
        uint256 moonwellOut = moonwellAmounts[moonwellAmounts.length - 1];
        require(moonwellOut > 0, "MOONWELL_SWAP_FAILED");

        // Calculate profit
        if (moonwellOut > amountIn) {
            profit = moonwellOut - amountIn;
        } else {
            profit = 0;
        }

        profitUSD = _profitUSD(tokenIn, profit);
        require(profitUSD >= minProfitUSD, "LOW_PROFIT");

        emit ArbitrageExecuted(
            "Uniswap",
            "Moonwell",
            tokenIn,
            tokenOut,
            amountIn,
            moonwellOut,
            profit,
            profitUSD,
            true
        );

        return (profit, profitUSD);
    }

    /**
     * @dev Estimate arbitrage profit (view function)
     */
    function estimateArbitrageProfit(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address[] calldata moonwellPath,
        uint24 uniswapFee,
        bool buyOnMoonwell // true = buy Moonwell/sell Uniswap, false = buy Uniswap/sell Moonwell
    ) external view returns (uint256 expectedOut, uint256 profit, uint256 profitUSD) {
        if (buyOnMoonwell) {
            // Buy on Moonwell, sell on Uniswap
            uint256[] memory moonwellAmounts = moonwellRouter.getAmountsOut(amountIn, moonwellPath);
            uint256 moonwellOut = moonwellAmounts[moonwellAmounts.length - 1];
            
            try uniswapRouter.getAmountOut(moonwellOut, tokenOut, tokenIn, uniswapFee) returns (uint256 uniswapOut) {
                expectedOut = uniswapOut;
            } catch {
                expectedOut = 0;
            }
        } else {
            // Buy on Uniswap, sell on Moonwell
            try uniswapRouter.getAmountOut(amountIn, tokenIn, tokenOut, uniswapFee) returns (uint256 uniswapOut) {
                uint256[] memory moonwellAmounts = moonwellRouter.getAmountsOut(uniswapOut, moonwellPath);
                expectedOut = moonwellAmounts[moonwellAmounts.length - 1];
            } catch {
                expectedOut = 0;
            }
        }
        
        if (expectedOut > amountIn) {
            profit = expectedOut - amountIn;
            profitUSD = _profitUSD(tokenIn, profit);
        } else {
            profit = 0;
            profitUSD = 0;
        }
    }

    function _profitUSD(address asset, uint256 amount) internal view returns (uint256) {
        if (amount == 0) return 0;
        try oracle.getAssetPrice(asset) returns (uint256 price) {
            return (amount * price) / 1e18;
        } catch {
            return 0;
        }
    }

    function updateRiskParams(
        uint256 gasCap,
        uint256 profit,
        uint256 maxTrade
    ) external onlyOwner {
        maxGasPrice = gasCap;
        minProfitUSD = profit;
        maxTradeAmount = maxTrade;
        emit RiskParamsUpdated(gasCap, profit, maxTrade);
    }

    function deposit(address token, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    receive() external payable {}
}
