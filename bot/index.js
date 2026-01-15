import { ethers } from 'ethers';
import axios from 'axios';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'https://mainnet.base.org',
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  FLASHBOTS_RELAY: 'https://relay.flashbots.net',
  MEV_BLOCKER_RELAY: 'https://rpc.mevblocker.io',
  MIN_PROFIT_USD: parseFloat(process.env.MIN_PROFIT_USD || '2.0'),
  GAS_BUFFER: 1.25, // 25% buffer
  ROUTE_ROTATION_DAYS: 7,
};

// Contract ABI (simplified)
const CONTRACT_ABI = [
  "function startFlashLoan(address asset, uint256 amount, uint256 tradePercent, address[] calldata path, uint256 minOut, bytes32 routeHash) external",
  "function executeOwnCapitalTrade(address asset, uint256 amount, address[] calldata path, uint256 minOut) external",
  "function getRouteStats(bytes32 routeHash) external view returns (uint256)",
];

// Moonwell router addresses (Base network)
const MOONWELL_ROUTER = '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24';

// Common tokens on Base
const TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917E0D6E',
  USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
};

class FlashLoanBot {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, this.wallet);
    this.routes = new Map(); // routeHash -> route data
    this.routeUsage = new Map(); // routeHash -> usage count
    this.lastRotation = Date.now();
  }

  /**
   * Scan Moonwell for arbitrage opportunities
   */
  async scanMoonwellRoutes() {
    console.log('🔍 Scanning Moonwell routes...');
    const routes = [];

    // Generate potential routes (2-3 hop paths)
    const tokenList = Object.values(TOKENS);
    
    for (let i = 0; i < tokenList.length; i++) {
      for (let j = 0; j < tokenList.length; j++) {
        if (i === j) continue;
        
        // 2-hop route
        routes.push({
          path: [tokenList[i], tokenList[j]],
          hops: 2,
        });

        // 3-hop route (add intermediate token)
        for (let k = 0; k < tokenList.length; k++) {
          if (k === i || k === j) continue;
          routes.push({
            path: [tokenList[i], tokenList[k], tokenList[j]],
            hops: 3,
          });
        }
      }
    }

    console.log(`Found ${routes.length} potential routes`);
    return routes;
  }

  /**
   * Simulate arbitrage opportunity
   */
  async simulateRoute(route, flashLoanAmount) {
    try {
      // Get current prices from Moonwell router
      const router = new ethers.Contract(
        MOONWELL_ROUTER,
        [
          "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory)",
        ],
        this.provider
      );

      // Variable trade percentage (50-71%) to avoid bot tracking
      // Randomize to make pattern detection harder
      const minPercent = 50;
      const maxPercent = 71;
      const tradePercent = minPercent + Math.floor(Math.random() * (maxPercent - minPercent + 1));
      const tradeAmount = (flashLoanAmount * BigInt(tradePercent)) / 100n;

      // Get expected output
      const amounts = await router.getAmountsOut(tradeAmount, route.path);
      const output = amounts[amounts.length - 1];

      // Calculate profit
      const flashFee = (flashLoanAmount * 9n) / 10000n; // 0.09%
      const repayAmount = flashLoanAmount + flashFee;
      const profit = output > repayAmount ? output - repayAmount : 0n;

      // Estimate gas cost
      const gasPrice = await this.provider.getFeeData();
      const estimatedGas = 500000n; // Approximate gas for flash loan + swaps
      const gasCost = gasPrice.gasPrice * estimatedGas;

      // Calculate profit in USD (simplified - use oracle in production)
      const profitUSD = await this.estimateProfitUSD(route.path[0], profit);

      // Check if profitable
      const minProfit = ethers.parseUnits(CONFIG.MIN_PROFIT_USD.toString(), 8);
      const isProfitable = profitUSD >= minProfit;

      return {
        route,
        tradePercent,
        flashLoanAmount,
        tradeAmount,
        expectedOutput: output,
        profit,
        profitUSD,
        gasCost,
        isProfitable,
        minOut: (output * 95n) / 100n, // 5% slippage tolerance
      };
    } catch (error) {
      console.error(`Simulation error for route:`, error.message);
      return null;
    }
  }

  /**
   * Estimate profit in USD (simplified - use real oracle in production)
   */
  async estimateProfitUSD(tokenAddress, amount) {
    // In production, call the oracle contract
    // For now, use a simplified calculation
    // This should use the same oracle as the contract
    try {
      // Placeholder: assume $2000/ETH for WETH
      if (tokenAddress.toLowerCase() === TOKENS.WETH.toLowerCase()) {
        const ethPrice = 2000e8; // $2000 in 8 decimals
        return (amount * BigInt(ethPrice)) / ethers.parseEther('1');
      }
      // Add more token price mappings or use oracle
      return 0n;
    } catch (error) {
      console.error('Profit estimation error:', error.message);
      return 0n;
    }
  }

  /**
   * Generate route hash for tracking
   */
  generateRouteHash(path) {
    const pathStr = path.join(',');
    return ethers.id(pathStr);
  }

  /**
   * Execute flash loan arbitrage via Flashbots
   */
  async executeViaFlashbots(simulation) {
    try {
      const routeHash = this.generateRouteHash(simulation.route.path);
      
      // Build transaction
      const tx = await this.contract.startFlashLoan.populateTransaction(
        simulation.route.path[0], // asset
        simulation.flashLoanAmount,
        simulation.tradePercent,
        simulation.route.path,
        simulation.minOut,
        routeHash
      );

      // Estimate gas
      const gasEstimate = await this.provider.estimateGas(tx);
      const gasPrice = await this.provider.getFeeData();

      // Check gas price limit (2 gwei max)
      const maxGasPrice = ethers.parseUnits('2', 'gwei');
      if (gasPrice.gasPrice > maxGasPrice) {
        console.log('⚠️ Gas price too high, skipping...');
        return false;
      }

      // Build bundle for Flashbots
      const bundle = [
        {
          tx: tx,
          canRevert: false,
        },
      ];

      // Send to Flashbots relay
      const flashbotsResponse = await this.sendToFlashbots(bundle, gasPrice.gasPrice);

      if (flashbotsResponse.success) {
        console.log(`✅ Bundle sent to Flashbots: ${flashbotsResponse.bundleHash}`);
        this.trackRoute(routeHash);
        return true;
      }

      // Fallback to MEV-Blocker
      const mevBlockerResponse = await this.sendToMEVBlocker(bundle, gasPrice.gasPrice);
      if (mevBlockerResponse.success) {
        console.log(`✅ Bundle sent to MEV-Blocker: ${mevBlockerResponse.bundleHash}`);
        this.trackRoute(routeHash);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Execution error:', error.message);
      return false;
    }
  }

  /**
   * Send bundle to Flashbots relay
   */
  async sendToFlashbots(bundle, gasPrice) {
    try {
      // Flashbots requires specific format
      // This is a simplified version - see Flashbots docs for full implementation
      const payload = {
        jsonrpc: '2.0',
        method: 'eth_sendBundle',
        params: [
          {
            txs: bundle.map(b => ethers.Transaction.from(b.tx).serialized),
            blockNumber: `0x${(await this.provider.getBlockNumber() + 1).toString(16)}`,
            minTimestamp: Math.floor(Date.now() / 1000),
            maxTimestamp: Math.floor(Date.now() / 1000) + 120,
          },
        ],
        id: 1,
      };

      const response = await axios.post(CONFIG.FLASHBOTS_RELAY, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Flashbots-Signature': this.wallet.address, // Simplified - needs proper signing
        },
      });

      return {
        success: response.data.result !== undefined,
        bundleHash: response.data.result,
      };
    } catch (error) {
      console.error('Flashbots error:', error.message);
      return { success: false };
    }
  }

  /**
   * Send bundle to MEV-Blocker relay
   */
  async sendToMEVBlocker(bundle, gasPrice) {
    try {
      // MEV-Blocker has similar API to Flashbots
      // Implementation similar to sendToFlashbots
      // See MEV-Blocker docs for specifics
      console.log('Sending to MEV-Blocker...');
      return { success: false, error: 'Not implemented' };
    } catch (error) {
      console.error('MEV-Blocker error:', error.message);
      return { success: false };
    }
  }

  /**
   * Track route usage
   */
  trackRoute(routeHash) {
    const current = this.routeUsage.get(routeHash) || 0;
    this.routeUsage.set(routeHash, current + 1);
  }

  /**
   * Rotate routes (drop top 20%, add complexity)
   */
  async rotateRoutes() {
    const daysSinceRotation = (Date.now() - this.lastRotation) / (1000 * 60 * 60 * 24);
    
    if (daysSinceRotation < CONFIG.ROUTE_ROTATION_DAYS) {
      return;
    }

    console.log('🔄 Rotating routes...');

    // Sort routes by usage
    const sortedRoutes = Array.from(this.routeUsage.entries())
      .sort((a, b) => b[1] - a[1]);

    // Drop top 20%
    const dropCount = Math.floor(sortedRoutes.length * 0.2);
    for (let i = 0; i < dropCount; i++) {
      this.routeUsage.delete(sortedRoutes[i][0]);
    }

    // Scan for new routes
    const newRoutes = await this.scanMoonwellRoutes();
    
    // Add new routes with higher complexity
    for (const route of newRoutes) {
      if (route.hops >= 3) {
        const routeHash = this.generateRouteHash(route.path);
        if (!this.routeUsage.has(routeHash)) {
          this.routeUsage.set(routeHash, 0);
        }
      }
    }

    this.lastRotation = Date.now();
    console.log(`✅ Rotated routes: dropped ${dropCount}, added ${newRoutes.length}`);
  }

  /**
   * Fallback: Execute with own capital
   */
  async executeOwnCapital(simulation) {
    try {
      // Check if we have enough balance
      const balance = await this.provider.getBalance(this.wallet.address);
      if (balance < simulation.gasCost) {
        console.log('⚠️ Insufficient balance for own capital trade');
        return false;
      }

      // Use smaller amount for own capital
      const ownCapitalAmount = simulation.flashLoanAmount / 2n;

      const tx = await this.contract.executeOwnCapitalTrade(
        simulation.route.path[0],
        ownCapitalAmount,
        simulation.route.path,
        simulation.minOut
      );

      console.log(`📤 Own capital trade sent: ${tx.hash}`);
      await tx.wait();
      console.log(`✅ Own capital trade confirmed`);
      return true;
    } catch (error) {
      console.error('Own capital execution error:', error.message);
      return false;
    }
  }

  /**
   * Main loop
   */
  async run() {
    console.log('🤖 Flash Loan Bot Started');
    console.log(`Contract: ${CONFIG.CONTRACT_ADDRESS}`);
    console.log(`Network: ${CONFIG.RPC_URL}`);

    // Scan routes
    const routes = await this.scanMoonwellRoutes();

    // Test with a sample amount (1 ETH)
    const testAmount = ethers.parseEther('1');

    for (const route of routes) {
      // Simulate
      const sim = await this.simulateRoute(route, testAmount);
      
      if (!sim || !sim.isProfitable) {
        continue;
      }

      console.log(`💰 Profitable opportunity found!`);
      console.log(`   Route: ${route.path.map(addr => addr.slice(0, 10)).join(' -> ')}`);
      console.log(`   Expected Profit: $${ethers.formatUnits(sim.profitUSD, 8)}`);
      console.log(`   Trade %: ${sim.tradePercent}%`);

      // Check profit margin: ExpectedProfit ≥ (Gas × 2.5) + FlashFee + $0.80 buffer
      const gasCostUSD = await this.estimateProfitUSD(TOKENS.WETH, sim.gasCost);
      const flashFeeUSD = await this.estimateProfitUSD(
        route.path[0],
        (testAmount * 9n) / 10000n
      );
      const bufferUSD = ethers.parseUnits('0.80', 8);
      const totalCostUSD = (gasCostUSD * 25n) / 10n + flashFeeUSD + bufferUSD;

      if (sim.profitUSD < totalCostUSD) {
        console.log(`   ⚠️ Profit too low after costs`);
        continue;
      }

      // Try flash loan first
      const flashLoanSuccess = await this.executeViaFlashbots(sim);
      
      if (!flashLoanSuccess) {
        // Fallback to own capital
        console.log('   🔄 Flash loan failed, trying own capital...');
        await this.executeOwnCapital(sim);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check for route rotation
    await this.rotateRoutes();
  }
}

// Start bot
const bot = new FlashLoanBot();

// Run immediately
bot.run().catch(console.error);

// Schedule periodic runs (every 30 seconds)
cron.schedule('*/30 * * * * *', () => {
  bot.run().catch(console.error);
});

// Route rotation (weekly)
cron.schedule('0 0 * * 0', () => {
  bot.rotateRoutes().catch(console.error);
});

console.log('⏰ Bot scheduled: runs every 30 seconds, route rotation weekly');
