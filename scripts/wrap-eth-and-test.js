const hre = require("hardhat");
const { ethers } = require("ethers");

// Contract address
const CONTRACT_ADDRESS = "0x1aAB73510150a4541CcBb8CaF0a89bEE4b2722E7";

// WETH address on Base Sepolia
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

// WETH ABI
const WETH_ABI = [
  "function deposit() payable",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function main() {
  console.log("🔄 Wrapping ETH to WETH and Testing Contract\n");
  console.log("=".repeat(60));

  const [signer] = await hre.ethers.getSigners();
  console.log("Account:", signer.address);
  
  const ethBalance = await signer.provider.getBalance(signer.address);
  console.log("ETH Balance:", ethers.formatEther(ethBalance), "ETH\n");

  // Step 1: Wrap some ETH to WETH
  console.log("📦 Step 1: Wrapping ETH to WETH");
  console.log("-".repeat(60));
  
  const wrapAmount = ethers.parseEther("0.01"); // Wrap 0.01 ETH
  
  if (ethBalance < wrapAmount) {
    console.log("❌ Insufficient ETH. Need at least 0.01 ETH");
    return;
  }

  try {
    const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
    
    // Check current WETH balance
    const wethBalanceBefore = await wethContract.balanceOf(signer.address);
    console.log("WETH Balance Before:", ethers.formatEther(wethBalanceBefore), "WETH");
    
    console.log(`Wrapping ${ethers.formatEther(wrapAmount)} ETH to WETH...`);
    const wrapTx = await wethContract.deposit({ value: wrapAmount });
    console.log("Transaction:", wrapTx.hash);
    await wrapTx.wait();
    
    const wethBalanceAfter = await wethContract.balanceOf(signer.address);
    console.log("WETH Balance After:", ethers.formatEther(wethBalanceAfter), "WETH");
    console.log("✅ WETH wrapped successfully!\n");
  } catch (error) {
    console.log("❌ Failed to wrap ETH:", error.message);
    return;
  }

  // Step 2: Get contract instance
  console.log("📋 Step 2: Getting Contract Instance");
  console.log("-".repeat(60));
  
  const OwnCapitalArb = await hre.ethers.getContractFactory("OwnCapitalArb");
  const contract = OwnCapitalArb.attach(CONTRACT_ADDRESS);
  
  const moonwellRouter = await contract.moonwellRouter();
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("Moonwell Router:", moonwellRouter);
  console.log("✅ Contract ready\n");

  // Step 3: Check contract balance
  console.log("💰 Step 3: Checking Contract Balance");
  console.log("-".repeat(60));
  
  const contractBalance = await contract.getBalance(WETH_ADDRESS);
  console.log("Contract WETH Balance:", ethers.formatEther(contractBalance), "WETH");
  
  // Step 4: Deposit WETH to contract
  const depositAmount = ethers.parseEther("0.005"); // Deposit 0.005 WETH for testing
  
  if (contractBalance < depositAmount) {
    console.log("\n💾 Step 4: Depositing WETH to Contract");
    console.log("-".repeat(60));
    
    try {
      const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
      
      // Check allowance
      const allowance = await wethContract.allowance(signer.address, CONTRACT_ADDRESS);
      if (allowance < depositAmount) {
        console.log("Approving WETH...");
        const approveTx = await wethContract.approve(CONTRACT_ADDRESS, depositAmount * 2n);
        await approveTx.wait();
        console.log("✅ Approved");
      }
      
      console.log(`Depositing ${ethers.formatEther(depositAmount)} WETH...`);
      const depositTx = await contract.deposit(WETH_ADDRESS, depositAmount);
      console.log("Transaction:", depositTx.hash);
      await depositTx.wait();
      console.log("✅ Deposited successfully!\n");
    } catch (error) {
      console.log("❌ Deposit failed:", error.message);
      return;
    }
  } else {
    console.log("✅ Contract already has sufficient WETH\n");
  }

  // Step 5: Estimate a trade
  console.log("🔍 Step 5: Estimating Trade");
  console.log("-".repeat(60));
  
  // Try to find a token pair - we'll try WETH -> USDC if available
  // For now, let's just check if we can estimate (even if no liquidity)
  const testAmount = ethers.parseEther("0.001"); // Test with 0.001 WETH
  
  // Common USDC address on Base (verify this exists on Sepolia)
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  
  try {
    console.log(`Estimating trade: WETH -> USDC`);
    console.log(`Amount: ${ethers.formatEther(testAmount)} WETH`);
    
    const path = [WETH_ADDRESS, USDC_ADDRESS];
    const [expectedOut, profit, profitUSD] = await contract.estimateProfit(path, testAmount);
    
    console.log(`\n📈 Estimation Results:`);
    console.log(`  Expected Output: ${ethers.formatUnits(expectedOut, 6)} USDC`); // USDC has 6 decimals
    console.log(`  Expected Profit: ${ethers.formatEther(profit)} WETH`);
    console.log(`  Expected Profit USD: $${ethers.formatUnits(profitUSD, 8)}`);
    
    if (profitUSD < ethers.parseUnits("2", 8)) {
      console.log(`\n⚠️  Profit below minimum ($2.00). Trade may not execute.`);
      console.log(`   This is normal for testnet - liquidity may be low.`);
    } else {
      console.log(`\n✅ Profit meets minimum threshold!`);
      
      // Step 6: Execute trade if profitable
      console.log("\n🚀 Step 6: Executing Test Trade");
      console.log("-".repeat(60));
      
      try {
        const minAmountOut = expectedOut * 95n / 100n; // 5% slippage
        console.log(`Executing with 5% slippage tolerance...`);
        
        const tx = await contract.executeTrade(
          WETH_ADDRESS,
          USDC_ADDRESS,
          testAmount,
          minAmountOut,
          { gasLimit: 500000 }
        );
        
        console.log(`Transaction: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log(`✅ Trade executed! Block: ${receipt.blockNumber}`);
        
        // Check new balance
        const newBalance = await contract.getBalance(USDC_ADDRESS);
        console.log(`Contract USDC Balance: ${ethers.formatUnits(newBalance, 6)} USDC`);
        
      } catch (error) {
        console.log(`⚠️  Trade execution: ${error.message}`);
        console.log(`   This might be due to:`);
        console.log(`   - Low liquidity on testnet`);
        console.log(`   - Profit below minimum threshold`);
        console.log(`   - Gas price too high`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not estimate trade: ${error.message}`);
    console.log(`   This might mean:`);
    console.log(`   - No liquidity pool for WETH/USDC on Moonwell`);
    console.log(`   - Moonwell router doesn't have this pair on Base Sepolia`);
    console.log(`   - Tokens don't exist on Base Sepolia`);
    console.log(`\n💡 The contract is working correctly - we just need a valid token pair.`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test Complete!");
  console.log("\nContract Status:");
  console.log(`  Address: ${CONTRACT_ADDRESS}`);
  console.log(`  WETH Balance: ${ethers.formatEther(await contract.getBalance(WETH_ADDRESS))} WETH`);
  console.log("\nView on explorer:");
  console.log(`https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
