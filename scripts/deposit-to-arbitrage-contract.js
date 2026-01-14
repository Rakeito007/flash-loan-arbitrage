const hre = require("hardhat");
const { ethers } = require("ethers");

const CONTRACT_ADDRESS = "0x45e19Cd9a97a7b6459aCc520bBd4F84C9DFD4F54";
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

const CONTRACT_ABI = [
  "function deposit(address token, uint256 amount) external",
  "function getBalance(address token) external view returns (uint256)",
];

async function main() {
  const network = hre.network.name;
  console.log(`Depositing to ArbitrageUniswapMoonwell on ${network}...\n`);

  const [signer] = await hre.ethers.getSigners();
  console.log("Account:", signer.address);

  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, signer);

  // Check balances
  const walletBalance = await weth.balanceOf(signer.address);
  const contractBalance = await contract.getBalance(WETH_ADDRESS);

  console.log(`Wallet WETH: ${ethers.formatEther(walletBalance)} WETH`);
  console.log(`Contract WETH: ${ethers.formatEther(contractBalance)} WETH\n`);

  if (walletBalance === 0n) {
    console.log("❌ No WETH in wallet. Wrap ETH first or get testnet tokens.");
    return;
  }

  // Deposit amount (use 50% of wallet balance or 0.01, whichever is smaller)
  const depositAmount = walletBalance / 2n > ethers.parseEther("0.01")
    ? ethers.parseEther("0.01")
    : walletBalance / 2n;

  console.log(`Depositing ${ethers.formatEther(depositAmount)} WETH...`);

  // Check allowance
  const allowance = await weth.allowance(signer.address, CONTRACT_ADDRESS);
  if (allowance < depositAmount) {
    console.log("Approving WETH...");
    const approveTx = await weth.approve(CONTRACT_ADDRESS, depositAmount * 2n);
    await approveTx.wait();
    console.log("✅ Approved");
  }

  // Deposit
  const depositTx = await contract.deposit(WETH_ADDRESS, depositAmount);
  console.log("Transaction:", depositTx.hash);
  await depositTx.wait();
  console.log("✅ Deposited successfully!");

  // Verify
  const newBalance = await contract.getBalance(WETH_ADDRESS);
  console.log(`\nNew contract balance: ${ethers.formatEther(newBalance)} WETH`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
