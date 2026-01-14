# Safe Crypto Flash Loan - Advanced Version

Complete flash loan arbitrage system with off-chain bot, Flashbots integration, and safety mechanisms.

## Architecture

```
Off-chain Bot
   ↓ (simulation + route selection)
Flashbots / MEV-Blocker (Base)
   ↓ (private bundle)
Smart Contract
   ├─ Flash Loan (Aave)
   ├─ Partial Trade (60–75%)
   ├─ Moonwell Swap(s)
   ├─ Oracle + Profit Checks
   ├─ Repayment
   └─ Profit → Wallet
```

## Features

### Smart Contract (`BaseMEVArb.sol`)

✅ **Flash Loan Integration**
- Uses Aave V3 `FlashLoanSimpleReceiverBase`
- Automatic repayment with premium

✅ **Partial Trade Strategy**
- Only trades 60-75% of flash loan amount
- Keeps reserve for safety

✅ **Oracle-Based Profit Validation**
- Checks profit in USD using Chainlink oracle
- Ensures profit ≥ (Gas × 2.5) + FlashFee + $0.80 buffer

✅ **Gas Price Protection**
- Maximum gas price limit (default: 2 gwei)
- Prevents execution during high gas periods

✅ **Route Rotation**
- Tracks route usage
- Drops top 20% most-used routes every 7 days
- Adds new routes with higher complexity

✅ **Own Capital Fallback**
- If flash loan fails, uses own funds
- Same safety checks apply
- Smaller trade size

### Off-Chain Bot

✅ **Route Scanning**
- Scans Moonwell for arbitrage opportunities
- Generates 2-3 hop routes
- Tests multiple token pairs

✅ **Simulation**
- Estimates profit before execution
- Checks gas costs
- Validates profitability

✅ **Flashbots Integration**
- Sends private bundles to Flashbots relay
- MEV-Blocker fallback
- Protects against front-running

✅ **Auto Route Rotation**
- Weekly route rotation
- Drops overused routes
- Adds complexity over time

## Installation

### 1. Install Dependencies

```bash
# Root directory
npm install

# Bot directory
cd bot
npm install
cd ..
```

### 2. Configure Environment

**Root `.env`:**
```bash
SEPOLIA_RPC_URL=https://sepolia.base.org
MAINNET_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_private_key
```

**Bot `.env`:**
```bash
RPC_URL=https://mainnet.base.org
CONTRACT_ADDRESS=your_deployed_contract_address
PRIVATE_KEY=your_private_key
MIN_PROFIT_USD=2.0
```

### 3. Deploy Contract

```bash
# Compile
npm run compile

# Deploy to Base
hardhat run scripts/deploy.js --network base
```

Update `CONTRACT_ADDRESS` in bot `.env` after deployment.

### 4. Update Router Addresses

Edit `scripts/deploy.js` and update:
- Moonwell router address (Base: `0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24`)
- Price oracle address (Chainlink on Base)

## Usage

### Start the Bot

```bash
cd bot
npm start
```

The bot will:
1. Scan Moonwell routes every 30 seconds
2. Simulate profitable opportunities
3. Send private bundles via Flashbots
4. Rotate routes weekly

### Manual Execution

You can also call the contract directly:

```javascript
// Flash loan arbitrage
await contract.startFlashLoan(
  assetAddress,      // Token to borrow
  amount,            // Amount to borrow
  65,                // Trade 65% of loan
  [token1, token2],  // Swap path
  minOut,            // Minimum output
  routeHash          // Route identifier
);

// Own capital fallback
await contract.executeOwnCapitalTrade(
  assetAddress,
  amount,
  [token1, token2],
  minOut
);
```

## Safety Mechanisms

### Profit Validation

The contract only executes if:
```
ExpectedProfit ≥ (Gas × 2.5) + FlashFee + $0.80 buffer
```

### Gas Protection

- Maximum gas price: 2 gwei (configurable)
- Transaction reverts if gas too high

### Route Rotation

Every 7 days:
- Drops top 20% most-used routes
- Adds new Moonwell pools
- Increases hop complexity (2 → 3 hops)
- Reduces size temporarily

This prevents bots from copying your routes.

## Flashbots Integration

### Setup

1. Get Flashbots signer key
2. Update bot configuration
3. Bot automatically sends bundles to Flashbots relay

### Benefits

- **Private Execution**: Transactions not visible in public mempool
- **MEV Protection**: Can't be front-run
- **Better Execution**: Direct to block builders

## Fallback Mechanism

If flash loan fails:
1. Bot automatically tries own capital
2. Same contract, same checks
3. Smaller trade size (50% of flash loan amount)
4. Still uses private relay

This keeps:
- Frequency high
- Risk low
- Capital efficient

## Configuration

### Update Risk Parameters

```javascript
await contract.updateRiskParams(
  2 gwei,    // Max gas price
  2e8,       // Min profit USD ($2, 8 decimals)
  80e6       // Buffer USD ($0.80, 6 decimals)
);
```

### Route Management

```javascript
// Get route stats
const usage = await contract.getRouteStats(routeHash);

// Get active routes
const routes = await contract.getActiveRoutes();

// Rotate routes (bot does this automatically)
await contract.rotateRoutes(newRoutes);
```

## Monitoring

### Events

- `FlashLoanExecuted`: Flash loan arbitrage completed
- `OwnCapitalTrade`: Fallback trade executed
- `RouteRotated`: Routes rotated
- `RiskParamsUpdated`: Safety parameters changed

### Logs

Bot logs:
- Route scanning results
- Simulation outcomes
- Execution status
- Profit/loss

## Important Notes

⚠️ **Network**: Designed for Base network (Moonwell + Aave)

⚠️ **Gas Costs**: Flash loan arbitrage can be expensive. Monitor gas prices.

⚠️ **Oracle**: Requires working price oracle. Update oracle address if needed.

⚠️ **Testing**: Always test on testnet first with small amounts.

⚠️ **Capital**: Keep some ETH for own-capital fallback trades.

## Troubleshooting

### "GAS_TOO_HIGH"
- Gas price exceeded maximum (2 gwei)
- Wait for lower gas or increase limit

### "LOW_PROFIT"
- Profit below minimum threshold
- Adjust `minProfitUSD` or wait for better opportunities

### "INSUFFICIENT_PROFIT_MARGIN"
- Profit doesn't cover gas + fees + buffer
- Normal - bot will skip unprofitable trades

### Flashbots Bundle Fails
- Bot automatically tries MEV-Blocker
- If both fail, tries own capital
- Check relay connectivity

## Advanced Features

### Multi-DEX Fallback
Add support for multiple DEXs in the contract for better opportunities.

### Limit Order AMMs
Integrate with limit-order AMMs for better execution.

### Time-Weighted Execution
Add timing logic to avoid predictable patterns.

### Dashboard
Create a monitoring dashboard with:
- Route performance
- Profit tracking
- Gas cost analysis
- Alert system

## Security

- ✅ Reentrancy protection
- ✅ Gas price limits
- ✅ Profit validation
- ✅ Oracle price checks
- ✅ Owner-only functions
- ✅ Emergency withdraw

## License

MIT

## Disclaimer

This software is for educational purposes. Flash loans and arbitrage involve significant risks:
- Smart contract bugs
- Oracle failures
- Market volatility
- Gas price spikes
- MEV extraction

Always:
- Test thoroughly
- Start small
- Monitor closely
- Understand the risks
