# Quick Start - Continuous Arbitrage Bot

Get your bot running in 3 steps!

## Step 1: Update Contract Address

Edit `bot/.env`:
```bash
CONTRACT_ADDRESS=0x45e19Cd9a97a7b6459aCc520bBd4F84C9DFD4F54
```

This is the `ArbitrageUniswapMoonwell` contract that supports both directions.

## Step 2: Deposit Tokens

Before starting, deposit tokens to the contract:

```bash
# Using Hardhat console
cd /Users/rakeito/flash-loan-app
npx hardhat console --network baseSepolia

# In console:
const contract = await ethers.getContractAt("ArbitrageUniswapMoonwell", "0x45e19Cd9a97a7b6459aCc520bBd4F84C9DFD4F54");
const weth = await ethers.getContractAt("IERC20", "0x4200000000000000000000000000000000000006");
await weth.approve(contract.target, ethers.parseEther("0.1"));
await contract.deposit("0x4200000000000000000000000000000000000006", ethers.parseEther("0.05"));
```

## Step 3: Start Bot

```bash
cd bot
npm start
```

The bot will:
- ✅ Scan DexScreener every 30 seconds
- ✅ Find arbitrage opportunities
- ✅ Execute trades automatically
- ✅ Work in both directions (Moonwell ↔ Uniswap)

## What to Expect

```
🤖 Arbitrage Bot Initializing...

Configuration:
  Contract: 0x45e19Cd9a97a7b6459aCc520bBd4F84C9DFD4F54
  Network: https://sepolia.base.org
  Min Profit: $2.0
  Scan Interval: 30s
  Max Gas: 2.0 gwei

✅ Contract connected

🚀 Bot started - scanning continuously...

[10:30:15] 🔍 Scan #1
✅ Found 2 opportunities

📊 Processing: WETH/USDC
   Price Diff: 0.75%
   Competition: 45.2
   💰 Estimated Profit: $2.45
   🚀 Executing arbitrage...
   ✅ Trade executed! Block: 12345
```

## Configuration Options

Edit `bot/.env` to customize:

```bash
SCAN_INTERVAL_SECONDS=30    # How often to scan (seconds)
MIN_PROFIT_USD=2.0          # Minimum profit required ($)
MAX_GAS_PRICE_GWEI=2.0      # Maximum gas price
```

## Troubleshooting

### "No balance in contract"
→ Deposit tokens first (Step 2)

### "No opportunities found"
→ Normal on testnet. Try Base mainnet for more opportunities.

### "Profit below minimum"
→ Adjust `MIN_PROFIT_USD` or wait for better opportunities.

### Bot stops working
→ Check logs for errors. Restart with `npm start`.

## Monitoring

The bot prints:
- Scan results every 30 seconds
- Opportunities found
- Trade executions
- Statistics every 5 minutes

Press `Ctrl+C` to stop gracefully.

## Next Steps

1. ✅ Bot running
2. ⏭️ Monitor for opportunities
3. ⏭️ Adjust settings as needed
4. ⏭️ Scale up gradually
