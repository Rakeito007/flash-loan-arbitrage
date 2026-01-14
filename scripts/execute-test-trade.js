const hre = require("hardhat");
const { ethers } = require("ethers");

// Contract address
const CONTRACT_ADDRESS = "0x1aAB73510150a4541CcBb8CaF0a89bEE4b2722E7";

// Common tokens on Base Sepolia - these are examples, verify they exist
const TOKENS = {
  WETH: "0x4200000000000000000000000000000000000006", // Base WETH
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
  DAI: "0x50c5725949A6F0c72E6C4a641F24049A917E0D6E", // Base DAI
};

// ERC20 ABI (simplified)
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  console.log("🧪 Testing OwnCapitalArb Contract\n");
  console.log("=" .repeat(60));

  const [signer] = await hre.ethers.getSigners();
  console.log("Account:", signer.address);
  
  // Get contract
  const OwnCapitalArb = await hre.ethers.getContractFactory("OwnCapitalArb");
  const contract = OwnCapitalArb.attach(CONTRACT_ADDRESS);

  // Check account ETH balance
  const ethBalance = await signer.provider.getBalance(signer.address);
  console.log("ETH Balance:", ethers.formatEther(ethBalance), "ETH\n");

  // Step 1: Check what tokens the account has
  console.log("📊 Step 1: Checking Token Balances");
  console.log("-".repeat(60));
  
  const tokenBalances = {};
  for (const [name, address] of Object.entries(TOKENS)) {
    try {
      const tokenContract = new ethers.Contract(address, ERC20_ABI, signer);
      const balance = await tokenContract.balanceOf(signer.address);
      const decimals = await tokenContract.decimals();
      const symbol = await tokenContract.symbol();
      
      if (balance > 0n) {
        tokenBalances[name] = { address, balance, decimals, symbol };
        console.log(`✅ ${name} (${symbol}):`, ethers.formatUnits(balance, decimals));
      } else {
        console.log(`❌ ${name} (${symbol}): 0 (no balance)`);
      }
    } catch (error) {
      console.log(`⚠️  ${name}: Token may not exist or not accessible`);
    }
  }

  // Step 2: Check contract balances
  console.log("\n📦 Step 2: Checking Contract Balances");
  console.log("-".repeat(60));
  
  for (const [name, info] of Object.entries(tokenBalances)) {
    try {
      const contractBalance = await contract.getBalance(info.address);
      if (contractBalance > 0n) {
        console.log(`✅ Contract has ${name}:`, ethers.formatUnits(contractBalance, info.decimals));
      } else {
        console.log(`❌ Contract has no ${name}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not check ${name} balance`);
    }
  }

  // Step 3: If we have tokens, try to deposit and test
  const availableTokens = Object.keys(tokenBalances);
  
  if (availableTokens.length === 0) {
    console.log("\n⚠️  No tokens found in your wallet.");
    console.log("You need to:");
    console.log("1. Get testnet tokens (WETH, USDC, etc.)");
    console.log("2. Or use a token you already have");
    console.log("\nTo get testnet tokens:");
    console.log("- Use a Base Sepolia faucet");
    console.log("- Bridge from Ethereum Sepolia");
    console.log("- Or swap ETH for tokens on Moonwell");
    return;
  }

  // Step 4: Try to estimate a trade
  console.log("\n🔍 Step 3: Estimating Trade Profit");
  console.log("-".repeat(60));
  
  // Use first available token
  const tokenInName = availableTokens[0];
  const tokenIn = tokenBalances[tokenInName];
  
  // Try to find a pair (use WETH if available, otherwise use first token)
  let tokenOutName = "WETH";
  let tokenOut = tokenBalances["WETH"];
  
  if (!tokenOut || tokenOutName === tokenInName) {
    // Use a different token or same token for circular arbitrage
    tokenOutName = availableTokens.length > 1 ? availableTokens[1] : tokenInName;
    tokenOut = tokenBalances[tokenOutName];
  }

  if (!tokenOut) {
    console.log("⚠️  Need at least one token to test with");
    return;
  }

  // Small test amount (1% of balance or 0.001 tokens, whichever is smaller)
  const testAmount = tokenIn.balance / 100n > ethers.parseUnits("0.001", tokenIn.decimals)
    ? ethers.parseUnits("0.001", tokenIn.decimals)
    : tokenIn.balance / 100n;

  console.log(`Testing with:`);
  console.log(`  Token In: ${tokenInName} (${tokenIn.symbol})`);
  console.log(`  Token Out: ${tokenOutName} (${tokenOut.symbol})`);
  console.log(`  Amount: ${ethers.formatUnits(testAmount, tokenIn.decimals)} ${tokenIn.symbol}`);

  try {
    const path = [tokenIn.address, tokenOut.address];
    const [expectedOut, profit, profitUSD] = await contract.estimateProfit(path, testAmount);
    
    console.log(`\n📈 Estimation Results:`);
    console.log(`  Expected Output: ${ethers.formatUnits(expectedOut, tokenOut.decimals)} ${tokenOut.symbol}`);
    console.log(`  Expected Profit: ${ethers.formatUnits(profit, tokenIn.decimals)} ${tokenIn.symbol}`);
    console.log(`  Expected Profit USD: $${ethers.formatUnits(profitUSD, 8)}`);
    
    if (profitUSD < ethers.parseUnits("2", 8)) {
      console.log(`\n⚠️  Profit below minimum ($2.00). Trade may not execute.`);
    } else {
      console.log(`\n✅ Profit meets minimum threshold!`);
    }
  } catch (error) {
    console.log(`\n❌ Could not estimate trade:`, error.message);
    console.log(`   This might mean:`);
    console.log(`   - No liquidity pool exists for this pair`);
    console.log(`   - Moonwell router doesn't support this pair`);
    console.log(`   - Tokens don't exist on Base Sepolia`);
    return;
  }

  // Step 5: Check if we need to deposit
  console.log("\n💾 Step 4: Checking if Deposit is Needed");
  console.log("-".repeat(60));
  
  const contractBalance = await contract.getBalance(tokenIn.address);
  const needsDeposit = contractBalance < testAmount;
  
  if (needsDeposit) {
    console.log(`⚠️  Contract needs ${ethers.formatUnits(testAmount - contractBalance, tokenIn.decimals)} more ${tokenIn.symbol}`);
    console.log(`\n📤 Attempting to deposit...`);
    
    try {
      // Check allowance
      const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(signer.address, CONTRACT_ADDRESS);
      
      if (allowance < testAmount) {
        console.log("   Approving tokens...");
        const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, testAmount * 2n);
        await approveTx.wait();
        console.log("   ✅ Approved");
      }
      
      console.log("   Depositing tokens...");
      const depositTx = await contract.deposit(tokenIn.address, testAmount);
      console.log("   Transaction:", depositTx.hash);
      await depositTx.wait();
      console.log("   ✅ Deposited successfully!");
    } catch (error) {
      console.log(`   ❌ Deposit failed:`, error.message);
      return;
    }
  } else {
    console.log(`✅ Contract has sufficient balance`);
  }

  // Step 6: Execute test trade (if profitable)
  console.log("\n🚀 Step 5: Executing Test Trade");
  console.log("-".repeat(60));
  
  try {
    const minAmountOut = expectedOut * 95n / 100n; // 5% slippage tolerance
    console.log(`Executing trade with 5% slippage tolerance...`);
    
    const tx = await contract.executeTrade(
      tokenIn.address,
      tokenOut.address,
      testAmount,
      minAmountOut,
      { gasLimit: 500000 }
    );
    
    console.log(`Transaction sent: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`✅ Trade executed! Block: ${receipt.blockNumber}`);
    
    // Check new balances
    const newContractBalance = await contract.getBalance(tokenOut.address);
    console.log(`\nNew contract balance of ${tokenOutName}:`, ethers.formatUnits(newContractBalance, tokenOut.decimals));
    
  } catch (error) {
    console.log(`❌ Trade execution failed:`, error.message);
    if (error.message.includes("LOW_PROFIT")) {
      console.log(`   Profit was below minimum threshold`);
    } else if (error.message.includes("GAS_TOO_HIGH")) {
      console.log(`   Gas price too high (max 2 gwei)`);
    } else if (error.message.includes("SLIPPAGE")) {
      console.log(`   Slippage too high - price moved unfavorably`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test Complete!");
  console.log("\nView contract on explorer:");
  console.log(`https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
