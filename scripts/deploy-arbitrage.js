const hre = require("hardhat");
const { ethers } = require("ethers");

// Router addresses
const UNISWAP_ROUTERS = {
  sepolia: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
  mainnet: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  base: "0x2626664c2603336E57B271c5C9b86e4C8C5F4c5a",
  baseSepolia: "0x2626664c2603336E57B271c5C9b86e4C8C5F4c5a", // Verify this
};

const MOONWELL_ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24";

const PRICE_ORACLES = {
  sepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  mainnet: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  base: "0x4aDC67696BA383F43dD60A9e78f2C97Fbbfa7dF4",
  baseSepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
};

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
  
  oracle = getChecksummedAddress(oracle);
  const uniRouter = getChecksummedAddress(uniswapRouter);
  const moonwell = getChecksummedAddress(MOONWELL_ROUTER);

  console.log(`Deploying ArbitrageUniswapMoonwell to ${network}...`);
  console.log(`Uniswap Router: ${uniRouter}`);
  console.log(`Moonwell Router: ${moonwell}`);
  console.log(`Price Oracle: ${oracle}`);

  const ArbitrageUniswapMoonwell = await hre.ethers.getContractFactory("ArbitrageUniswapMoonwell");
  const arb = await ArbitrageUniswapMoonwell.deploy(
    uniRouter,
    moonwell,
    oracle
  );

  await arb.waitForDeployment();
  const address = await arb.getAddress();

  console.log("\n✅ ArbitrageUniswapMoonwell deployed to:", address);
  console.log("\nThis contract enables:");
  console.log("  ✅ Buy on Moonwell, Sell on Uniswap");
  console.log("  ✅ Buy on Uniswap, Sell on Moonwell");
  console.log("  ✅ True arbitrage between two DEXes!");
  
  console.log("\n📝 Next Steps:");
  console.log("1. Update bot/.env with CONTRACT_ADDRESS=" + address);
  console.log("2. Deposit tokens to contract");
  console.log("3. Execute arbitrage trades!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
