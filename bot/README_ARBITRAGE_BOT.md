# Continuous Arbitrage Bot

Automated bot that continuously scans DexScreener and executes arbitrage trades between Uniswap and Moonwell.

## Features

✅ **Continuous Scanning**
- Scans DexScreener every 30 seconds (configurable)
- Finds low-competition opportunities
- Automatically executes profitable trades

✅ **Bidirectional Arbitrage**
- Buy on Moonwell → Sell on Uniswap
- Buy on Uniswap → Sell on Moonwell
- Automatically chooses best direction

✅ **Smart Execution**
- Profit validation before execution
- Gas price protection
- Slippage protection
- Competition score filtering

✅ **Safety Features**
- Minimum profit threshold ($2 default)
- Maximum gas price (2 gwei default)
- Balance checks
- Error handling and recovery

## Setup

### 1. Configure Environment

Edit `bot/.env`:
```bash
RPC_URL=https://sepolia.base.org
CONTRACT_ADDRESS=0x45e19Cd9a97a7b6459aCc520bBd4F84C9DFD4F54
PRIVATE_KEY=your_private_key
MIN_PROFIT_USD=2.0
SCAN_INTERVAL_SECONDS=30
MAX_GAS_PRICE_GWEI=2.0
```

### 2. Deposit Tokens

Before starting, deposit tokens to the contract:

```javascript
// Using Hardhat console or script
const contract = await ethers.getContractAt("ArbitrageUniswapMoonwell", CONTRACT_ADDRESS);

// Approve token
await tokenContract.approve(CONTRACT_ADDRESS, amount);

// Deposit
await contract.deposit(tokenAddress, amount);
```

### 3. Start Bot

```bash
cd bot
npm start
```

## How It Works

### 1. Scanning Phase

Every 30 seconds (configurable):
- Scans DexScreener for token pairs
- Filters for low competition
- Finds arbitrage opportunities
- Estimates profit using contract

### 2. Validation Phase

For each opportunity:
- ✅ Check price difference ≥ 0.5%
- ✅ Check competition score < 200
- ✅ Estimate profit ≥ $2.00
- ✅ Check gas price < 2 gwei
- ✅ Verify contract balance

### 3. Execution Phase

If all checks pass:
- Determines best direction (Moonwell→Uniswap or Uniswap→Moonwell)
- Calculates trade amount (10% of balance or 0.01 tokens)
- Sets slippage protection (5%)
- Executes arbitrage trade
- Records results

## Configuration

### Scan Interval

```bash
SCAN_INTERVAL_SECONDS=30  # Scan every 30 seconds
```

### Profit Threshold

```bash
MIN_PROFIT_USD=2.0  # Minimum $2 profit required
```

### Gas Protection

```bash
MAX_GAS_PRICE_GWEI=2.0  # Max 2 gwei gas price
```

## Monitoring

The bot prints:
- Scan results
- Opportunities found
- Trade executions
- Statistics every 5 minutes

### Statistics Include:
- Total scans
- Opportunities found
- Trades executed
- Total profit
- Errors

## Safety Features

### Profit Validation
- Contract validates profit in USD
- Minimum profit threshold enforced
- Gas costs considered

### Gas Protection
- Won't execute if gas > 2 gwei
- Prevents execution during high gas periods

### Slippage Protection
- 5% slippage tolerance
- Minimum output enforced
- Transaction reverts if slippage too high

### Competition Filtering
- Only trades on low-competition pairs
- Competition score < 200
- Volume < $100k
- Transactions < 200/day

## Troubleshooting

### "No balance in contract"
- Deposit tokens using `deposit()` function
- Ensure you have approved tokens

### "Profit below minimum"
- Adjust `MIN_PROFIT_USD` in `.env`
- Or wait for better opportunities

### "Gas too high"
- Wait for lower gas prices
- Or increase `MAX_GAS_PRICE_GWEI`

### "No opportunities found"
- Normal on testnet (limited liquidity)
- Try Base mainnet for more opportunities
- Adjust competition filters

### "Estimation failed"
- Pair might not exist on both DEXes
- Insufficient liquidity
- Invalid token addresses

## Integration with Scanner

The bot uses `DexScreenerScanner` to:
1. Find pairs on Base network
2. Filter for low competition
3. Detect price differences
4. Identify arbitrage opportunities

## Contract Functions Used

### Estimate Profit
```solidity
estimateArbitrageProfit(
    tokenIn, tokenOut, amountIn,
    moonwellPath, uniswapFee, buyOnMoonwell
) returns (expectedOut, profit, profitUSD)
```

### Execute Arbitrage
```solidity
// Buy on Moonwell, Sell on Uniswap
arbitrageMoonwellToUniswap(
    tokenIn, tokenOut, amountIn,
    moonwellPath, uniswapFee, minAmountOut
)

// Buy on Uniswap, Sell on Moonwell
arbitrageUniswapToMoonwell(
    tokenIn, tokenOut, amountIn,
    uniswapFee, moonwellPath, minAmountOut
)
```

## Best Practices

1. **Start Small**
   - Test with small amounts first
   - Monitor for a few hours
   - Gradually increase size

2. **Monitor Gas**
   - High gas can eat profits
   - Set appropriate max gas price
   - Avoid peak hours

3. **Diversify**
   - Don't focus on single pair
   - Rotate between opportunities
   - Spread risk

4. **Keep Capital**
   - Maintain sufficient balance
   - Don't trade entire balance
   - Keep reserves

5. **Monitor Competition**
   - Watch competition scores
   - Avoid high-competition pairs
   - Rotate pairs regularly

## Example Output

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
      Amount: 0.01 WETH
      Direction: Moonwell → Uniswap
      Transaction: 0x...
      Waiting for confirmation...
   ✅ Trade executed! Block: 12345
```

## Next Steps

1. ✅ Bot created and ready
2. ⏭️ Deposit tokens to contract
3. ⏭️ Start bot: `npm start`
4. ⏭️ Monitor and optimize
5. ⏭️ Scale up gradually
