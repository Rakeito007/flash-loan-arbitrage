import { ethers } from 'ethers';
import axios from 'axios';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { DexScreenerScanner } from './dexscreener-scanner.js';

dotenv.config();

// Configuration
const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'https://sepolia.base.org',
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || '0x45e19Cd9a97a7b6459aCc520bBd4F84C9DFD4F54', // ArbitrageUniswapMoonwell
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  MIN_PROFIT_USD: parseFloat(process.env.MIN_PROFIT_USD || '2.0'),
  SCAN_INTERVAL_SECONDS: parseInt(process.env.SCAN_INTERVAL_SECONDS || '30'),
  MAX_GAS_PRICE_GWEI: parseFloat(process.env.MAX_GAS_PRICE_GWEI || '2.0'),
};

// Contract ABI
const CONTRACT_ABI = [
  "function arbitrageMoonwellToUniswap(address tokenIn, address tokenOut, uint256 amountIn, address[] calldata moonwellPath, uint24 uniswapFee, uint256 minAmountOut) external returns (uint256, uint256)",
  "function arbitrageUniswapToMoonwell(address tokenIn, address tokenOut, uint256 amountIn, uint24 uniswapFee, address[] calldata moonwellPath, uint256 minAmountOut) external returns (uint256, uint256)",
  "function estimateArbitrageProfit(address tokenIn, address tokenOut, uint256 amountIn, address[] calldata moonwellPath, uint24 uniswapFee, bool buyOnMoonwell) external view returns (uint256, uint256, uint256)",
  "function getBalance(address token) external view returns (uint256)",
  "function deposit(address token, uint256 amount) external",
  "function updateRiskParams(uint256 gasCap, uint256 profit, uint256 maxTrade) external",
];

// ERC20 ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

class ArbitrageBot {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, this.wallet);
    this.scanner = new DexScreenerScanner();
    this.isRunning = false;
    this.lastScanTime = 0;
    this.executedTrades = [];
    this.stats = {
      scans: 0,
      opportunitiesFound: 0,
      tradesExecuted: 0,
      totalProfit: 0,
      errors: 0,
    };
  }

  /**
   * Initialize bot
   */
  async initialize() {
    console.log('🤖 Arbitrage Bot Initializing...\n');
    console.log('Configuration:');
    console.log(`  Contract: ${CONFIG.CONTRACT_ADDRESS}`);
    console.log(`  Network: ${CONFIG.RPC_URL}`);
    console.log(`  Min Profit: $${CONFIG.MIN_PROFIT_USD}`);
    console.log(`  Scan Interval: ${CONFIG.SCAN_INTERVAL_SECONDS}s`);
    console.log(`  Max Gas: ${CONFIG.MAX_GAS_PRICE_GWEI} gwei\n`);

    // Check contract connection
    try {
      // Test with WETH address instead of zero address
      const wethAddress = '0x4200000000000000000000000000000000000006';
      const balance = await this.contract.getBalance(wethAddress);
      console.log('✅ Contract connected');
      console.log(`   Contract WETH balance: ${ethers.formatEther(balance)} WETH\n`);
    } catch (error) {
      console.error('❌ Failed to connect to contract:', error.message);
      console.error('   Make sure contract address is correct and network matches');
      process.exit(1);
    }
  }

  /**
   * Scan for opportunities
   */
  async scanOpportunities() {
    this.stats.scans++;
    console.log(`\n[${new Date().toLocaleTimeString()}] 🔍 Scan #${this.stats.scans}`);

    try {
      // Search for common token pairs
      const tokenAddresses = [
        '0x4200000000000000000000000000000000000006', // WETH
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
        '0x50c5725949A6F0c72E6C4a641F24049A917E0D6E', // DAI
      ];

      const results = await this.scanner.scanOpportunities(tokenAddresses);
      
      if (results.opportunities.length > 0) {
        this.stats.opportunitiesFound += results.opportunities.length;
        console.log(`✅ Found ${results.opportunities.length} opportunities`);
        
        // Process opportunities
        for (const opp of results.opportunities) {
          await this.processOpportunity(opp);
        }
      } else {
        console.log('⚠️  No opportunities found');
      }

      this.lastScanTime = Date.now();
    } catch (error) {
      this.stats.errors++;
      console.error('❌ Scan error:', error.message);
    }
  }

  /**
   * Process an arbitrage opportunity
   */
  async processOpportunity(opportunity) {
    try {
      console.log(`\n📊 Processing: ${opportunity.baseToken.symbol}/${opportunity.quoteToken.symbol}`);
      console.log(`   Price Diff: ${opportunity.priceDifferencePercent.toFixed(2)}%`);
      console.log(`   Competition: ${opportunity.competitionScore.toFixed(2)}`);

      // Check if profitable enough
      if (opportunity.priceDifferencePercent < 0.5) {
        console.log('   ⚠️  Price difference too small');
        return;
      }

      // Check competition score
      if (opportunity.competitionScore > 200) {
        console.log('   ⚠️  Competition too high');
        return;
      }

      // Determine direction
      const buyOnMoonwell = opportunity.buyOn.toLowerCase().includes('moonwell');
      const tokenIn = opportunity.baseToken.address;
      const tokenOut = opportunity.quoteToken.address;

      // Estimate profit using contract
      const moonwellPath = [tokenIn, tokenOut];
      const uniswapFee = 3000; // 0.3% fee tier (common)

      try {
        const [expectedOut, profit, profitUSD] = await this.contract.estimateArbitrageProfit(
          tokenIn,
          tokenOut,
          ethers.parseEther('0.1'), // Test with 0.1 tokens
          moonwellPath,
          uniswapFee,
          buyOnMoonwell
        );

        const profitUSDNum = parseFloat(ethers.formatUnits(profitUSD, 8));
        console.log(`   💰 Estimated Profit: $${profitUSDNum.toFixed(2)}`);

        if (profitUSDNum < CONFIG.MIN_PROFIT_USD) {
          console.log(`   ⚠️  Profit below minimum ($${CONFIG.MIN_PROFIT_USD})`);
          return;
        }

        // Check gas price
        const feeData = await this.provider.getFeeData();
        const gasPriceGwei = parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei'));
        
        if (gasPriceGwei > CONFIG.MAX_GAS_PRICE_GWEI) {
          console.log(`   ⚠️  Gas too high: ${gasPriceGwei.toFixed(2)} gwei`);
          return;
        }

        // Execute arbitrage
        await this.executeArbitrage(opportunity, buyOnMoonwell, moonwellPath, uniswapFee);

      } catch (error) {
        console.log(`   ❌ Estimation failed: ${error.message}`);
      }

    } catch (error) {
      console.error('❌ Opportunity processing error:', error.message);
    }
  }

  /**
   * Execute arbitrage trade
   */
  async executeArbitrage(opportunity, buyOnMoonwell, moonwellPath, uniswapFee) {
    try {
      const tokenIn = opportunity.baseToken.address;
      const tokenOut = opportunity.quoteToken.address;
      
      // Determine trade amount (use 10% of contract balance or fixed amount)
      const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, this.wallet);
      const balance = await this.contract.getBalance(tokenIn);
      
      if (balance === 0n) {
        console.log('   ⚠️  No balance in contract');
        return;
      }

      // Use smaller amount for safety
      const tradeAmount = balance / 10n > ethers.parseEther('0.01') 
        ? ethers.parseEther('0.01')
        : balance / 10n;
      
      // Estimate output using contract
      const [expectedOut, , ] = await this.contract.estimateArbitrageProfit(
        tokenIn,
        tokenOut,
        tradeAmount,
        moonwellPath,
        uniswapFee,
        buyOnMoonwell
      );
      
      // Calculate min amount out (5% slippage tolerance)
      const minAmountOut = expectedOut * 95n / 100n;

      console.log(`   🚀 Executing arbitrage...`);
      console.log(`      Amount: ${ethers.formatEther(tradeAmount)} ${opportunity.baseToken.symbol}`);
      console.log(`      Direction: ${buyOnMoonwell ? 'Moonwell → Uniswap' : 'Uniswap → Moonwell'}`);

      let tx;
      if (buyOnMoonwell) {
        tx = await this.contract.arbitrageMoonwellToUniswap(
          tokenIn,
          tokenOut,
          tradeAmount,
          moonwellPath,
          uniswapFee,
          minAmountOut,
          { gasLimit: 1000000 }
        );
      } else {
        tx = await this.contract.arbitrageUniswapToMoonwell(
          tokenIn,
          tokenOut,
          tradeAmount,
          uniswapFee,
          moonwellPath,
          minAmountOut,
          { gasLimit: 1000000 }
        );
      }

      console.log(`      Transaction: ${tx.hash}`);
      console.log('      Waiting for confirmation...');

      const receipt = await tx.wait();
      console.log(`   ✅ Trade executed! Block: ${receipt.blockNumber}`);

      // Record trade
      this.executedTrades.push({
        timestamp: Date.now(),
        opportunity,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      });

      this.stats.tradesExecuted++;

      // Try to estimate profit from receipt (simplified)
      // In production, parse events for actual profit

    } catch (error) {
      this.stats.errors++;
      console.error(`   ❌ Execution failed: ${error.message}`);
      
      if (error.message.includes('LOW_PROFIT')) {
        console.log('      Profit was below minimum threshold');
      } else if (error.message.includes('GAS_TOO_HIGH')) {
        console.log('      Gas price too high');
      } else if (error.message.includes('SLIPPAGE')) {
        console.log('      Slippage too high - price moved');
      }
    }
  }

  /**
   * Check and deposit tokens if needed
   */
  async ensureTokenBalance(tokenAddress, minAmount) {
    try {
      const balance = await this.contract.getBalance(tokenAddress);
      
      if (balance < minAmount) {
        console.log(`\n💾 Depositing tokens to contract...`);
        
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.wallet);
        const walletBalance = await tokenContract.balanceOf(this.wallet.address);
        
        if (walletBalance < minAmount) {
          console.log('   ⚠️  Insufficient wallet balance');
          return false;
        }

        // Approve if needed
        const allowance = await tokenContract.allowance(this.wallet.address, CONFIG.CONTRACT_ADDRESS);
        if (allowance < minAmount) {
          const approveTx = await tokenContract.approve(CONFIG.CONTRACT_ADDRESS, minAmount * 2n);
          await approveTx.wait();
        }

        // Deposit
        const depositTx = await this.contract.deposit(tokenAddress, minAmount);
        await depositTx.wait();
        console.log('   ✅ Tokens deposited');
        return true;
      }

      return true;
    } catch (error) {
      console.error('❌ Deposit error:', error.message);
      return false;
    }
  }

  /**
   * Print statistics
   */
  printStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 BOT STATISTICS');
    console.log('='.repeat(60));
    console.log(`Scans: ${this.stats.scans}`);
    console.log(`Opportunities Found: ${this.stats.opportunitiesFound}`);
    console.log(`Trades Executed: ${this.stats.tradesExecuted}`);
    console.log(`Total Profit: $${this.stats.totalProfit.toFixed(2)}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log('='.repeat(60));
  }

  /**
   * Start continuous scanning
   */
  async start() {
    await this.initialize();
    
    this.isRunning = true;
    console.log('🚀 Bot started - scanning continuously...\n');

    // Initial scan
    await this.scanOpportunities();

    // Set up continuous scanning
    setInterval(async () => {
      if (this.isRunning) {
        await this.scanOpportunities();
      }
    }, CONFIG.SCAN_INTERVAL_SECONDS * 1000);

    // Print stats every 5 minutes
    setInterval(() => {
      this.printStats();
    }, 5 * 60 * 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down bot...');
      this.isRunning = false;
      this.printStats();
      process.exit(0);
    });
  }

  /**
   * Stop bot
   */
  stop() {
    this.isRunning = false;
  }
}

// Start bot
const bot = new ArbitrageBot();
bot.start().catch(console.error);
