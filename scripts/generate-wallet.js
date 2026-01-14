const { ethers } = require("ethers");

/**
 * Generate a new wallet for development/testing
 * WARNING: This is for development only. Never use for mainnet with real funds.
 */
function generateWallet() {
  const wallet = ethers.Wallet.createRandom();
  
  console.log("=".repeat(60));
  console.log("NEW WALLET GENERATED (Development Only!)");
  console.log("=".repeat(60));
  console.log("\n📝 Address:");
  console.log(wallet.address);
  console.log("\n🔑 Private Key:");
  console.log(wallet.privateKey);
  console.log("\n📋 Mnemonic (12 words):");
  console.log(wallet.mnemonic.phrase);
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  SECURITY WARNINGS:");
  console.log("=".repeat(60));
  console.log("1. Save this information securely");
  console.log("2. NEVER commit to git");
  console.log("3. NEVER share publicly");
  console.log("4. Only use for testnet/development");
  console.log("5. Fund with testnet ETH only");
  console.log("=".repeat(60));
  console.log("\n💡 Next Steps:");
  console.log("1. Copy the private key above");
  console.log("2. Add it to your .env file as PRIVATE_KEY=");
  console.log("3. Fund this wallet with testnet ETH");
  console.log("4. Import to MetaMask if needed (use private key)");
  console.log("\n");
  
  return wallet;
}

// Run if called directly
if (require.main === module) {
  generateWallet();
}

module.exports = { generateWallet };
