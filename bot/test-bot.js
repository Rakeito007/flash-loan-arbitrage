import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { DexScreenerScanner } from './dexscreener-scanner.js';

dotenv.config();

// Quick test script
const CONFIG = {
  RPC_URL: process.env.RPC_URL || 'https://sepolia.base.org',
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || '0x45e19Cd9a97a7b6459aCc520bBd4F84C9DFD4F54',
  PRIVATE_KEY: process.env.PRIVATE_KEY,
};

const CONTRACT_ABI = [
  "function getBalance(address token) external view returns (uint256)",
  "function estimateArbitrageProfit(address tokenIn, address tokenOut, uint256 amountIn, address[] calldata moonwellPath, uint24 uniswapFee, bool buyOnMoonwell) external view returns (uint256, uint256, uint256)",
];

async function testBot() {
  console.log('🧪 Testing Arbitrage Bot\n');
  console.log('='.repeat(60));

  // Setup
  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  console.log('Configuration:');
  console.log(`  Contract: ${CONFIG.CONTRACT_ADDRESS}`);
  console.log(`  Network: ${CONFIG.RPC_URL}`);
  console.log(`  Wallet: ${wallet.address}\n`);

  // Test 1: Check contract connection
  console.log('Test 1: Contract Connection');
  console.log('-'.repeat(60));
  try {
    const wethAddress = '0x4200000000000000000000000000000000000006';
    const balance = await contract.getBalance(wethAddress);
    console.log(`✅ Contract connected`);
    console.log(`   WETH Balance: ${ethers.formatEther(balance)} WETH\n`);
  } catch (error) {
    console.log(`❌ Contract connection failed: ${error.message}\n`);
    return;
  }

  // Test 2: Test DexScreener Scanner
  console.log('Test 2: DexScreener Scanner');
  console.log('-'.repeat(60));
  try {
    const scanner = new DexScreenerScanner();
    console.log('Scanning for opportunities...');
    
    const tokenAddresses = [
      '0x4200000000000000000000000000000000000006', // WETH
    ];
    
    const results = await scanner.scanOpportunities(tokenAddresses);
    console.log(`✅ Scanner working`);
    console.log(`   Pairs found: ${results.pairs.length}`);
    console.log(`   Opportunities: ${results.opportunities.length}\n`);
    
    if (results.opportunities.length > 0) {
      console.log('Top opportunity:');
      const opp = results.opportunities[0];
      console.log(`   Pair: ${opp.baseToken.symbol}/${opp.quoteToken.symbol}`);
      console.log(`   Price Diff: ${opp.priceDifferencePercent.toFixed(2)}%`);
      console.log(`   Competition: ${opp.competitionScore.toFixed(2)}\n`);
    }
  } catch (error) {
    console.log(`❌ Scanner test failed: ${error.message}\n`);
  }

  // Test 3: Estimate profit (if we have an opportunity)
  console.log('Test 3: Profit Estimation');
  console.log('-'.repeat(60));
  try {
    const tokenIn = '0x4200000000000000000000000000000000000006'; // WETH
    const tokenOut = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC
    const amountIn = ethers.parseEther('0.01');
    const moonwellPath = [tokenIn, tokenOut];
    const uniswapFee = 3000;
    const buyOnMoonwell = true;

    console.log('Estimating arbitrage profit...');
    const [expectedOut, profit, profitUSD] = await contract.estimateArbitrageProfit(
      tokenIn,
      tokenOut,
      amountIn,
      moonwellPath,
      uniswapFee,
      buyOnMoonwell
    );

    console.log(`✅ Estimation successful`);
    console.log(`   Expected Output: ${ethers.formatUnits(expectedOut, 6)} USDC`);
    console.log(`   Profit: ${ethers.formatEther(profit)} WETH`);
    console.log(`   Profit USD: $${ethers.formatUnits(profitUSD, 8)}\n`);
  } catch (error) {
    console.log(`⚠️  Estimation failed: ${error.message}`);
    console.log(`   This is normal if pair doesn't exist or has no liquidity\n`);
  }

  // Test 4: Check gas price
  console.log('Test 4: Gas Price Check');
  console.log('-'.repeat(60));
  try {
    const feeData = await provider.getFeeData();
    const gasPriceGwei = parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei'));
    console.log(`✅ Current gas price: ${gasPriceGwei.toFixed(2)} gwei`);
    if (gasPriceGwei > 2.0) {
      console.log(`   ⚠️  Gas price above 2 gwei - trades may not execute\n`);
    } else {
      console.log(`   ✅ Gas price OK for trading\n`);
    }
  } catch (error) {
    console.log(`❌ Gas check failed: ${error.message}\n`);
  }

  console.log('='.repeat(60));
  console.log('✅ Test Complete!');
  console.log('\n💡 Next Steps:');
  console.log('   1. Deposit tokens to contract if needed');
  console.log('   2. Run full bot: npm start');
  console.log('   3. Monitor for opportunities');
}

testBot().catch(console.error);
