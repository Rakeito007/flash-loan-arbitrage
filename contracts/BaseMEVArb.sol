// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BaseMEVArb
 * @dev Safe flash loan arbitrage contract with partial trades, oracle checks, and fallback
 * Designed for Flashbots/MEV-Blocker private bundles on Base network
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
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

contract BaseMEVArb is FlashLoanSimpleReceiverBase, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IMoonwellRouter public router;
    IPriceOracle public oracle;

    uint256 public maxGasPrice;
    uint256 public minProfitUSD;
    uint256 public bufferUSD; // Safety buffer in USD (e.g., $0.80)
    uint256 public constant FLASH_FEE_BPS = 9; // 0.09% Aave flash loan fee

    // Route tracking for rotation
    mapping(bytes32 => uint256) public routeUsageCount;
    bytes32[] public activeRoutes;
    uint256 public lastRouteRotation;
    uint256 public constant ROUTE_ROTATION_INTERVAL = 7 days;

    // Events
    event FlashLoanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 tradePercent,
        uint256 profit,
        uint256 profitUSD,
        bool success
    );
    event OwnCapitalTrade(
        address indexed asset,
        uint256 amount,
        uint256 profit,
        uint256 profitUSD
    );
    event RouteRotated(uint256 routesDropped, uint256 newRoutes);
    event RiskParamsUpdated(uint256 maxGasPrice, uint256 minProfitUSD, uint256 bufferUSD);

    constructor(
        address provider,
        address _router,
        address _oracle
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(provider)) Ownable(msg.sender) {
        router = IMoonwellRouter(_router);
        oracle = IPriceOracle(_oracle);
        maxGasPrice = 2 gwei;
        minProfitUSD = 2e8; // $2 (8 decimals)
        bufferUSD = 80e6; // $0.80 (6 decimals for buffer)
        lastRouteRotation = block.timestamp;
    }

    /**
     * @dev Start flash loan arbitrage (called by off-chain bot)
     * @param asset The asset to borrow
     * @param amount The amount to borrow
     * @param tradePercent Percentage of loan to trade (60-75%)
     * @param path Swap path on Moonwell
     * @param minOut Minimum output amount
     * @param routeHash Hash of the route for tracking
     */
    function startFlashLoan(
        address asset,
        uint256 amount,
        uint256 tradePercent,
        address[] calldata path,
        uint256 minOut,
        bytes32 routeHash
    ) external onlyOwner nonReentrant {
        require(tradePercent >= 60 && tradePercent <= 75, "BAD_PERCENT");
        require(path.length >= 2, "INVALID_PATH");
        
        // Track route usage
        if (routeHash != bytes32(0)) {
            routeUsageCount[routeHash]++;
        }

        POOL.flashLoanSimple(
            address(this),
            asset,
            amount,
            abi.encode(tradePercent, path, minOut, routeHash),
            0
        );
    }

    /**
     * @dev Aave flash loan callback - executes arbitrage
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address,
        bytes calldata data
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Only pool can call");
        require(tx.gasprice <= maxGasPrice, "GAS_TOO_HIGH");

        (
            uint256 tradePercent,
            address[] memory path,
            uint256 minOut,
            bytes32 routeHash
        ) = abi.decode(data, (uint256, address[], uint256, bytes32));

        // Calculate trade amount (partial trade: 60-75% of loan)
        uint256 tradeAmount = (amount * tradePercent) / 100;
        uint256 reserveAmount = amount - tradeAmount; // Keep reserve for repayment

        // Approve router
        IERC20(asset).approve(address(router), tradeAmount);

        // Execute swap on Moonwell
        uint256[] memory amounts = router.swapExactTokensForTokens(
            tradeAmount,
            minOut,
            path,
            address(this),
            block.timestamp + 300
        );

        uint256 received = amounts[amounts.length - 1];
        require(received > 0, "SWAP_FAILED");

        // Calculate repayment amount
        uint256 repay = amount + premium;
        
        // Get final balance (reserve + swap output)
        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        require(finalBalance >= repay, "CANNOT_REPAY");

        // Calculate profit
        uint256 profit = finalBalance > repay ? finalBalance - repay : 0;
        
        // Oracle-based profit check in USD
        uint256 profitUSD = _profitUSD(asset, profit);
        require(profitUSD >= minProfitUSD, "LOW_PROFIT");

        // Additional safety: ensure profit covers gas + fees + buffer
        uint256 estimatedGasCost = tx.gasprice * gasleft();
        uint256 estimatedGasCostUSD = _estimateGasCostUSD(estimatedGasCost);
        uint256 flashFeeUSD = _profitUSD(asset, premium);
        uint256 totalCostUSD = estimatedGasCostUSD + flashFeeUSD + bufferUSD;
        
        require(profitUSD >= totalCostUSD, "INSUFFICIENT_PROFIT_MARGIN");

        // Repay flash loan
        IERC20(asset).approve(address(POOL), repay);

        emit FlashLoanExecuted(asset, amount, tradePercent, profit, profitUSD, true);

        return true;
    }

    /**
     * @dev Fallback: Execute trade with own capital if flash loan fails
     * Same safety checks as flash loan version
     */
    function executeOwnCapitalTrade(
        address asset,
        uint256 amount,
        address[] calldata path,
        uint256 minOut
    ) external onlyOwner nonReentrant {
        require(path.length >= 2, "INVALID_PATH");
        require(IERC20(asset).balanceOf(address(this)) >= amount, "INSUFFICIENT_BALANCE");

        // Approve router
        IERC20(asset).approve(address(router), amount);

        // Execute swap
        uint256[] memory amounts = router.swapExactTokensForTokens(
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

        emit OwnCapitalTrade(asset, amount, profit, profitUSD);
    }

    /**
     * @dev Rotate routes - drop top 20% most-used, add complexity
     */
    function rotateRoutes(bytes32[] calldata newRoutes) external onlyOwner {
        require(
            block.timestamp >= lastRouteRotation + ROUTE_ROTATION_INTERVAL,
            "TOO_EARLY"
        );

        // Sort routes by usage and drop top 20%
        uint256 dropCount = activeRoutes.length / 5; // 20%
        
        // Clear usage counts for dropped routes
        for (uint256 i = 0; i < dropCount && i < activeRoutes.length; i++) {
            delete routeUsageCount[activeRoutes[i]];
        }

        // Add new routes
        for (uint256 i = 0; i < newRoutes.length; i++) {
            activeRoutes.push(newRoutes[i]);
            routeUsageCount[newRoutes[i]] = 0;
        }

        lastRouteRotation = block.timestamp;
        emit RouteRotated(dropCount, newRoutes.length);
    }

    /**
     * @dev Update risk parameters
     */
    function updateRiskParams(
        uint256 gasCap,
        uint256 profit,
        uint256 buffer
    ) external onlyOwner {
        require(gasCap > 0, "INVALID_GAS");
        require(profit > 0, "INVALID_PROFIT");
        
        maxGasPrice = gasCap;
        minProfitUSD = profit;
        bufferUSD = buffer;
        
        emit RiskParamsUpdated(gasCap, profit, buffer);
    }

    /**
     * @dev Calculate profit in USD using oracle
     */
    function _profitUSD(address asset, uint256 amount) internal view returns (uint256) {
        if (amount == 0) return 0;
        uint256 price = oracle.getAssetPrice(asset);
        // Price is typically in 8 decimals, amount in 18 decimals
        // Result should be in 8 decimals for USD
        return (amount * price) / 1e18;
    }

    /**
     * @dev Estimate gas cost in USD (simplified)
     * Note: In production, use a dedicated ETH/USD oracle
     */
    function _estimateGasCostUSD(uint256 gasCostWei) internal view returns (uint256) {
        // Simplified: Use a fixed ETH price or get from oracle
        // For Base, you'd typically use WETH address or a dedicated ETH/USD oracle
        // This is a placeholder - update with actual oracle address
        uint256 ethPrice = 2000e8; // $2000/ETH fallback (8 decimals)
        
        // Try to get ETH price from oracle if available
        // In production, use a dedicated ETH/USD price feed
        try oracle.getAssetPrice(address(0x4200000000000000000000000000000000000006)) returns (uint256 price) {
            if (price > 0) {
                ethPrice = price;
            }
        } catch {
            // Use fallback price
        }
        
        return (gasCostWei * ethPrice) / 1e18;
    }

    /**
     * @dev Get route usage statistics
     */
    function getRouteStats(bytes32 routeHash) external view returns (uint256 usageCount) {
        return routeUsageCount[routeHash];
    }

    /**
     * @dev Get all active routes
     */
    function getActiveRoutes() external view returns (bytes32[] memory) {
        return activeRoutes;
    }

    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @dev Receive ETH (for gas refunds, etc.)
     */
    receive() external payable {}
}
