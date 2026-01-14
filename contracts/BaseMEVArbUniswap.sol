// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BaseMEVArbUniswap
 * @dev Flash swap arbitrage using Uniswap V3 (works on Base Sepolia)
 * Uses Uniswap V3 flash swaps instead of Aave flash loans
 */
interface IUniswapV3Pool {
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
    
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

interface ISwapRouter {
    function exactInputSingle(
        ISwapRouter.ExactInputSingleParams calldata params
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
}

interface IMoonwellRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IPriceOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}

contract BaseMEVArbUniswap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ISwapRouter public uniswapRouter;
    IMoonwellRouter public moonwellRouter;
    IPriceOracle public oracle;

    uint256 public maxGasPrice;
    uint256 public minProfitUSD;
    uint256 public bufferUSD;

    // Events
    event FlashSwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amount,
        uint256 profit,
        uint256 profitUSD,
        bool success
    );

    constructor(
        address _uniswapRouter,
        address _moonwellRouter,
        address _oracle
    ) Ownable(msg.sender) {
        uniswapRouter = ISwapRouter(_uniswapRouter);
        moonwellRouter = IMoonwellRouter(_moonwellRouter);
        oracle = IPriceOracle(_oracle);
        maxGasPrice = 2 gwei;
        minProfitUSD = 2e8; // $2
        bufferUSD = 80e6; // $0.80
    }

    /**
     * @dev Execute flash swap arbitrage
     * Borrows from Uniswap V3 pool, trades on Moonwell, repays Uniswap
     */
    function executeFlashSwap(
        address pool,
        uint256 amount0,
        uint256 amount1,
        address tokenToBuy,
        address[] calldata moonwellPath,
        uint256 minOut
    ) external onlyOwner nonReentrant {
        require(tx.gasprice <= maxGasPrice, "GAS_TOO_HIGH");
        
        IUniswapV3Pool(pool).flash(
            address(this),
            amount0,
            amount1,
            abi.encode(tokenToBuy, moonwellPath, minOut)
        );
    }

    /**
     * @dev Uniswap V3 flash callback
     */
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external {
        (
            address tokenToBuy,
            address[] memory moonwellPath,
            uint256 minOut
        ) = abi.decode(data, (address, address[], uint256));

        // Determine which token we borrowed
        IUniswapV3Pool pool = IUniswapV3Pool(msg.sender);
        address token0 = pool.token0();
        address token1 = pool.token1();
        
        uint256 borrowedAmount;
        uint256 fee;
        address borrowedToken;
        
        if (fee0 > 0) {
            borrowedAmount = fee0;
            fee = fee0;
            borrowedToken = token0;
        } else {
            borrowedAmount = fee1;
            fee = fee1;
            borrowedToken = token1;
        }

        // Calculate trade amount (60-75% of borrowed amount)
        uint256 tradePercent = 65; // Can be parameterized
        uint256 tradeAmount = (borrowedAmount * tradePercent) / 100;

        // Approve Moonwell
        IERC20(borrowedToken).approve(address(moonwellRouter), tradeAmount);

        // Swap on Moonwell
        uint256[] memory amounts = moonwellRouter.swapExactTokensForTokens(
            tradeAmount,
            minOut,
            moonwellPath,
            address(this),
            block.timestamp + 300
        );

        uint256 received = amounts[amounts.length - 1];
        require(received > 0, "SWAP_FAILED");

        // Calculate repayment
        uint256 repay = borrowedAmount + fee;
        uint256 finalBalance = IERC20(borrowedToken).balanceOf(address(this));
        require(finalBalance >= repay, "CANNOT_REPAY");

        // Calculate profit
        uint256 profit = finalBalance > repay ? finalBalance - repay : 0;
        uint256 profitUSD = _profitUSD(borrowedToken, profit);
        require(profitUSD >= minProfitUSD, "LOW_PROFIT");

        // Repay Uniswap
        IERC20(borrowedToken).approve(msg.sender, repay);

        emit FlashSwapExecuted(borrowedToken, tokenToBuy, borrowedAmount, profit, profitUSD, true);
    }

    /**
     * @dev Execute with own capital (fallback)
     */
    function executeOwnCapitalTrade(
        address asset,
        uint256 amount,
        address[] calldata path,
        uint256 minOut
    ) external onlyOwner nonReentrant {
        require(IERC20(asset).balanceOf(address(this)) >= amount, "INSUFFICIENT_BALANCE");
        
        IERC20(asset).approve(address(moonwellRouter), amount);
        
        uint256[] memory amounts = moonwellRouter.swapExactTokensForTokens(
            amount,
            minOut,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 received = amounts[amounts.length - 1];
        require(received > amount, "NO_PROFIT");

        uint256 profit = received - amount;
        uint256 profitUSD = _profitUSD(asset, profit);
        require(profitUSD >= minProfitUSD, "LOW_PROFIT");

        emit FlashSwapExecuted(asset, path[path.length - 1], amount, profit, profitUSD, true);
    }

    function _profitUSD(address asset, uint256 amount) internal view returns (uint256) {
        if (amount == 0) return 0;
        uint256 price = oracle.getAssetPrice(asset);
        return (amount * price) / 1e18;
    }

    function updateRiskParams(
        uint256 gasCap,
        uint256 profit,
        uint256 buffer
    ) external onlyOwner {
        maxGasPrice = gasCap;
        minProfitUSD = profit;
        bufferUSD = buffer;
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    receive() external payable {}
}
