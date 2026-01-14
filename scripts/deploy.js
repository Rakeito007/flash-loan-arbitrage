const hre = require("hardhat");
const { ethers } = require("ethers");

// Aave V3 Pool Addresses Provider addresses
const AAVE_ADDRESSES_PROVIDER = {
  sepolia: "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9a",
  mainnet: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
  base: "0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D", // Base network (Moonwell is on Base)
  baseSepolia: "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9a", // Base Sepolia uses same as Sepolia
};

// Price Oracle addresses (Chainlink)
// Note: For Base Sepolia, we'll use a mock oracle or Sepolia oracle
const PRICE_ORACLES = {
  sepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // Chainlink ETH/USD Sepolia
  mainnet: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // Chainlink ETH/USD Mainnet
  base: "0x4aDC67696BA383F43dD60A9e78f2C97Fbbfa7dF4", // Chainlink ETH/USD on Base (checksummed)
  baseSepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306", // Use Sepolia oracle for Base Sepolia
};

// Helper to get checksummed address
function getChecksummedAddress(address) {
  const { ethers } = require("hardhat");
  return ethers.getAddress(address);
}

// Router addresses
const ROUTERS = {
  sepolia: {
    moonwell: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Placeholder - verify for Sepolia
  },
  mainnet: {
    moonwell: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Placeholder - verify for mainnet
  },
  base: {
    moonwell: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Moonwell router on Base (verified)
  },
  baseSepolia: {
    moonwell: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Placeholder - verify for Base Sepolia
  },
};

// Helper to safely get checksummed address
function getChecksummedAddress(address) {
  try {
    return ethers.getAddress(address);
  } catch (e) {
    // If checksum fails, try lowercase then checksum
    return ethers.getAddress(address.toLowerCase());
  }
}

async function main() {
  const network = hre.network.name;
  let addressesProvider = AAVE_ADDRESSES_PROVIDER[network] || AAVE_ADDRESSES_PROVIDER.base;
  const routers = ROUTERS[network] || ROUTERS.base;
  let oracle = PRICE_ORACLES[network] || PRICE_ORACLES.base;
  
  // Get checksummed addresses
  addressesProvider = getChecksummedAddress(addressesProvider);
  oracle = getChecksummedAddress(oracle);

  console.log(`Deploying to ${network}...`);
  console.log(`Using Aave Addresses Provider: ${addressesProvider}`);
  console.log(`Moonwell Router: ${routers.moonwell}`);
  console.log(`Price Oracle: ${oracle}`);

  const BaseMEVArb = await hre.ethers.getContractFactory("BaseMEVArb");
  const baseMEVArb = await BaseMEVArb.deploy(
    addressesProvider,
    routers.moonwell,
    oracle
  );

  await baseMEVArb.waitForDeployment();
  const address = await baseMEVArb.getAddress();

  console.log("BaseMEVArb deployed to:", address);
  console.log("Default Parameters:");
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
          addressesProvider,
          routers.moonwell,
          oracle,
        ],
      });
      console.log("Contract verified on Etherscan!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
