const hre = require("hardhat");
const { ethers } = require("ethers");

// Moonwell router
const MOONWELL_ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24";

// Price Oracle addresses
const PRICE_ORACLES = {
  sepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  mainnet: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  base: "0x4aDC67696BA383F43dD60A9e78f2C97Fbbfa7dF4",
  baseSepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // Use Sepolia oracle
};

// Helper to safely get checksummed address
function getChecksummedAddress(address) {
  try {
    return ethers.getAddress(address);
  } catch (e) {
    return ethers.getAddress(address.toLowerCase());
  }
}

async function main() {
  const network = hre.network.name;
  let oracle = PRICE_ORACLES[network] || PRICE_ORACLES.baseSepolia;
  
  // Get checksummed addresses
  oracle = getChecksummedAddress(oracle);
  const moonwell = getChecksummedAddress(MOONWELL_ROUTER);

  console.log(`Deploying OwnCapitalArb to ${network}...`);
  console.log(`Moonwell Router: ${moonwell}`);
  console.log(`Price Oracle: ${oracle}`);

  const OwnCapitalArb = await hre.ethers.getContractFactory("OwnCapitalArb");
  const arb = await OwnCapitalArb.deploy(
    moonwell,
    oracle
  );

  await arb.waitForDeployment();
  const address = await arb.getAddress();

  console.log("\n✅ OwnCapitalArb deployed to:", address);
  console.log("\nDefault Parameters:");
  console.log(`  Max Gas Price: 2 gwei`);
  console.log(`  Min Profit USD: $2.00`);
  console.log(`  Max Trade Amount: 10 ETH`);

  // Verify contract on Etherscan (optional)
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await arb.deploymentTransaction()?.wait(5);

    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [
          moonwell,
          oracle,
        ],
      });
      console.log("Contract verified on Etherscan!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }
  
  console.log("\n📝 Next Steps:");
  console.log("1. Update bot/.env with CONTRACT_ADDRESS=" + address);
  console.log("2. Deposit tokens to contract using deposit()");
  console.log("3. Execute trades using executeTrade() or executeMultiHopArb()");
  console.log("4. Start the bot!");
  console.log("\n💡 Example usage:");
  console.log(`   await contract.deposit(tokenAddress, amount)`);
  console.log(`   await contract.executeTrade(tokenIn, tokenOut, amount, minOut)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
