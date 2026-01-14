const hre = require("hardhat");

// Mock addresses for local testing
const MOCK_ADDRESSES = {
  aaveProvider: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // First Hardhat account
  moonwellRouter: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // Second Hardhat account
  oracle: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", // Third Hardhat account
};

async function main() {
  console.log("Deploying to local network...");
  console.log("Using mock addresses for testing");
  
  // Deploy mock contracts first (simplified for testing)
  console.log("\nNote: This is a test deployment with mock addresses.");
  console.log("For Base Sepolia, Aave needs to be deployed first.");
  
  const BaseMEVArb = await hre.ethers.getContractFactory("BaseMEVArb");
  
  try {
    const baseMEVArb = await BaseMEVArb.deploy(
      MOCK_ADDRESSES.aaveProvider,
      MOCK_ADDRESSES.moonwellRouter,
      MOCK_ADDRESSES.oracle
    );

    await baseMEVArb.waitForDeployment();
    const address = await baseMEVArb.getAddress();

    console.log("\n✅ BaseMEVArb deployed to:", address);
    console.log("\n⚠️  This is a LOCAL deployment with mock addresses.");
    console.log("For Base Sepolia, Aave V3 must be deployed first.");
  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    console.log("\nThis is expected - Aave is not available on Base Sepolia.");
    console.log("Options:");
    console.log("1. Deploy to Base mainnet (where Aave exists)");
    console.log("2. Wait for Aave to be deployed on Base Sepolia");
    console.log("3. Use a different testnet where Aave is available");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
