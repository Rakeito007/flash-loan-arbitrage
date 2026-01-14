# Quick Start - Advanced Flash Loan System

Get your advanced flash loan arbitrage system running quickly!

## Prerequisites

- Node.js v18+
- MetaMask or wallet with Base network
- Base ETH for gas (get from [Base faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet) for testnet)

## Step 1: Install Dependencies

```bash
# Root directory
cd /Users/rakeito/flash-loan-app
npm install

# Bot directory
cd bot
npm install
cd ..
```

## Step 2: Configure Environment

### Root `.env`:
```bash
cp .env.example .env
```

Add:
```
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_private_key_here
```

### Bot `.env`:
```bash
cd bot
cp .env.example .env
```

Add:
```
RPC_URL=https://mainnet.base.org
CONTRACT_ADDRESS=  # Will fill after deployment
PRIVATE_KEY=your_private_key_here
MIN_PROFIT_USD=2.0
```

## Step 3: Update Addresses

Edit `scripts/deploy.js` and verify:
- Moonwell router: `0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24` (Base)
- Price oracle: Update with Chainlink ETH/USD on Base

## Step 4: Compile Contracts

```bash
npm run compile
```

## Step 5: Deploy to Base

```bash
# For Base mainnet
hardhat run scripts/deploy.js --network base

# For Base Sepolia testnet
hardhat run scripts/deploy.js --network baseSepolia
```

Copy the deployed contract address and update `bot/.env`:
```
CONTRACT_ADDRESS=0x...
```

## Step 6: Start the Bot

```bash
cd bot
npm start
```

The bot will:
- ✅ Scan Moonwell routes every 30 seconds
- ✅ Simulate profitable opportunities
- ✅ Send private bundles via Flashbots
- ✅ Rotate routes weekly

## Step 7: Monitor

Watch the bot logs for:
- Route scanning results
- Simulation outcomes
- Execution status
- Profit/loss

## Testing

### Test on Base Sepolia First

1. Get testnet ETH
2. Deploy to `baseSepolia` network
3. Run bot with testnet RPC
4. Verify everything works

### Manual Contract Calls

```javascript
// Check safety parameters
const maxGas = await contract.maxGasPrice();
const minProfit = await contract.minProfitUSD();

// Update risk parameters (if needed)
await contract.updateRiskParams(
  ethers.parseUnits("2", "gwei"),  // Max gas
  ethers.parseUnits("2", 8),       // Min profit $2
  ethers.parseUnits("0.80", 6)     // Buffer $0.80
);
```

## Troubleshooting

### "Contract not found"
- Make sure contract is deployed
- Update `CONTRACT_ADDRESS` in bot `.env`

### "Insufficient funds"
- Add Base ETH to your wallet
- Check gas prices

### "GAS_TOO_HIGH"
- Gas price exceeded 2 gwei limit
- Wait for lower gas or increase limit via `updateRiskParams`

### Flashbots not working
- Bot will fallback to MEV-Blocker
- If both fail, uses own capital
- Check relay connectivity

## Next Steps

1. **Monitor Performance**: Track route success rates
2. **Optimize Parameters**: Adjust min profit, gas limits
3. **Add More Routes**: Expand token pairs
4. **Dashboard**: Build monitoring dashboard

## Important Reminders

⚠️ **Always test on testnet first**
⚠️ **Start with small amounts**
⚠️ **Monitor gas costs**
⚠️ **Keep some ETH for own-capital fallback**

See `README_ADVANCED.md` for full documentation.
