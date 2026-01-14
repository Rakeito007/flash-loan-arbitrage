const hre = require("hardhat");
const { ethers } = require("ethers");

// Uniswap V3 Router addresses
const UNISWAP_ROUTERS = {
  sepolia: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", // Uniswap V3 Router Sepolia
  mainnet: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router Mainnet
  base: "0x2626664c2603336E57B271c5C9b86e4C8C5F4c5a", // Uniswap V3 Router Base
  baseSepolia: "0x2626664c2603336E57B271c5C9b86e4C8C5F4c5a", // May be same as Base
};

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
  const uniswapRouter = UNISWAP_ROUTERS[network] || UNISWAP_ROUTERS.baseSepolia;
  let oracle = PRICE_ORACLES[network] || PRICE_ORACLES.baseSepolia;
  
  // Get checksummed addresses
  oracle = getChecksummedAddress(oracle);
  const router = getChecksummedAddress(uniswapRouter);
  const moonwell = getChecksummedAddress(MOONWELL_ROUTER);

  console.log(`Deploying to ${network}...`);
  console.log(`Using Uniswap V3 Router: ${router}`);
  console.log(`Moonwell Router: ${moonwell}`);
  console.log(`Price Oracle: ${oracle}`);

  const BaseMEVArbUniswap = await hre.ethers.getContractFactory("BaseMEVArbUniswap");
  const baseMEVArb = await BaseMEVArbUniswap.deploy(
    router,
    moonwell,
    oracle
  );

  await baseMEVArb.waitForDeployment();
  const address = await baseMEVArb.getAddress();

  console.log("\n✅ BaseMEVArbUniswap deployed to:", address);
  console.log("\nDefault Parameters:");
  console.log(`  Max Gas Price: 2 gwei`);
  console.log(`  Min Profit USD: $2.00`);
  console.log(`  Buffer USD: $0.80`);

  // Verify contract on Etherscan (optional)
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\nWaiting for block confirmations...");
    await baseMEVArb.deploymentTransaction()?.wait(5);

    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [
          router,
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
  console.log("2. Find Uniswap V3 pools for your token pairs");
  console.log("3. Start the bot!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
