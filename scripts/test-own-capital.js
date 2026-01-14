const hre = require("hardhat");
const { ethers } = require("ethers");

// Contract address (from deployment)
const CONTRACT_ADDRESS = "0x1aAB73510150a4541CcBb8CaF0a89bEE4b2722E7";

// Common tokens on Base Sepolia (update with actual addresses)
const TOKENS = {
  WETH: "0x4200000000000000000000000000000000000006", // Base WETH
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC (verify)
  DAI: "0x50c5725949A6F0c72E6C4a641F24049A917E0D6E", // Base DAI (verify)
};

async function main() {
  const network = hre.network.name;
  console.log(`Testing OwnCapitalArb on ${network}...\n`);

  // Get contract
  const OwnCapitalArb = await hre.ethers.getContractFactory("OwnCapitalArb");
  const contract = OwnCapitalArb.attach(CONTRACT_ADDRESS);

  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Using account:", signer.address);

  // Check contract info
  console.log("\n📋 Contract Info:");
  const moonwellRouter = await contract.moonwellRouter();
  const oracle = await contract.oracle();
  const maxGasPrice = await contract.maxGasPrice();
  const minProfitUSD = await contract.minProfitUSD();
  const maxTradeAmount = await contract.maxTradeAmount();

  console.log("  Moonwell Router:", moonwellRouter);
  console.log("  Oracle:", oracle);
  console.log("  Max Gas Price:", ethers.formatUnits(maxGasPrice, "gwei"), "gwei");
  console.log("  Min Profit USD: $", ethers.formatUnits(minProfitUSD, 8));
  console.log("  Max Trade Amount:", ethers.formatEther(maxTradeAmount), "ETH");

  // Check balances
  console.log("\n💰 Balances:");
  for (const [name, address] of Object.entries(TOKENS)) {
    try {
      const balance = await contract.getBalance(address);
      if (balance > 0n) {
        console.log(`  ${name}:`, ethers.formatEther(balance));
      }
    } catch (e) {
      // Token might not exist
    }
  }

  // Example: Estimate profit for a trade
  console.log("\n🔍 Example: Estimate Trade Profit");
  console.log("(This is a view function - no transaction needed)");
  
  try {
    const tokenIn = TOKENS.WETH;
    const tokenOut = TOKENS.USDC;
    const amountIn = ethers.parseEther("0.1"); // 0.1 ETH
    
    const path = [tokenIn, tokenOut];
    const [expectedOut, profit, profitUSD] = await contract.estimateProfit(path, amountIn);
    
    console.log(`  Input: ${ethers.formatEther(amountIn)} WETH`);
    console.log(`  Expected Output: ${ethers.formatEther(expectedOut)} USDC`);
    console.log(`  Expected Profit: ${ethers.formatEther(profit)} tokens`);
    console.log(`  Expected Profit USD: $${ethers.formatUnits(profitUSD, 8)}`);
  } catch (error) {
    console.log("  ⚠️  Could not estimate (tokens may not exist or no liquidity)");
  }

  console.log("\n✅ Contract is ready to use!");
  console.log("\n💡 To execute a trade:");
  console.log("   1. Deposit tokens: await contract.deposit(tokenAddress, amount)");
  console.log("   2. Execute trade: await contract.executeTrade(tokenIn, tokenOut, amount, minOut)");
  console.log("\n💡 To execute multi-hop arbitrage:");
  console.log("   await contract.executeMultiHopArb([tokenA, tokenB, tokenA], amount, minOut)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
