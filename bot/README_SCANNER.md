# DexScreener Scanner

Finds low-competition arbitrage opportunities on Base network to avoid MEV bots.

## Features

✅ **DexScreener API Integration**
- Fetches real-time pair data
- Filters for Base network
- Searches by token address or symbol

✅ **Low Competition Filtering**
- Max volume: $50k (avoids high-competition pairs)
- Max transactions: 100/day (avoids active pairs)
- Liquidity range: $1k - $100k (enough liquidity, not whale-dominated)
- Price movement: 1-50% (shows activity but not too volatile)

✅ **Arbitrage Detection**
- Finds price differences between DEXes
- Identifies Uniswap ↔ Moonwell opportunities
- Calculates competition score (lower = less competition)

✅ **MEV Bot Avoidance**
- Filters for low-volume pairs
- Prioritizes less active pairs
- Suggests private transaction methods

## Usage

### Basic Scan

```bash
cd bot
node scanner.js
```

### Search Specific Tokens

```bash
# Set token addresses in .env
TOKEN_ADDRESSES=0x4200000000000000000000000000000000000006,0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

node scanner.js
```

Or pass as arguments:
```bash
node dexscreener-scanner.js 0x4200000000000000000000000000000000000006
```

## Output

The scanner will:
1. Search DexScreener for pairs
2. Filter for low competition
3. Find arbitrage opportunities
4. Display top 10 opportunities
5. Save top 20 to `opportunities.json`

## Competition Score

Lower score = Less competition = Better for avoiding MEV bots

**Score Calculation:**
```
Score = (Total Volume / 1000) + (Total Transactions × 10)
```

**Good Scores:**
- < 50: Very low competition ✅
- 50-100: Low competition ✅
- 100-200: Medium competition ⚠️
- > 200: High competition ❌

## Integration with Bot

The scanner can be integrated into the main bot:

```javascript
import { DexScreenerScanner } from './dexscreener-scanner.js';

const scanner = new DexScreenerScanner();
const results = await scanner.scanOpportunities();

// Use opportunities in bot
for (const opp of results.opportunities) {
  if (opp.competitionScore < 100) {
    // Execute arbitrage
  }
}
```

## Tips to Avoid MEV Bots

1. **Use Low Competition Pairs**
   - Competition score < 100
   - Volume < $10k
   - Transactions < 50/day

2. **Use Private Transactions**
   - Flashbots bundles
   - MEV-Blocker
   - Private RPC

3. **Timing**
   - Execute during low-activity periods
   - Avoid peak trading hours
   - Monitor gas prices

4. **Size**
   - Start with small amounts
   - Don't create large price impact
   - Rotate between pairs

## Configuration

Edit `dexscreener-scanner.js` to adjust filters:

```javascript
const COMPETITION_THRESHOLDS = {
  maxVolume24h: 50000,      // Adjust based on your needs
  maxTxns24h: 100,
  minLiquidity: 1000,
  maxLiquidity: 100000,
  // ...
};
```

## API Rate Limits

DexScreener API is free but has rate limits:
- ~10 requests/second recommended
- Scanner includes 500ms delays between requests
- Cache results for 1 minute

## Example Output

```
🎯 TOP LOW-COMPETITION OPPORTUNITIES
============================================================

1. WETH/USDC
   📊 Price Difference: 0.75%
   💰 Buy on: moonwell ($2,450.50)
   💰 Sell on: uniswap-v3 ($2,468.90)
   📈 Competition Score: 45.2 (lower = better)
   💧 Total Liquidity: $15,234.50
   📊 Total Volume 24h: $3,456.78
```

## Next Steps

1. Run scanner to find opportunities
2. Review `opportunities.json`
3. Test with small amounts
4. Integrate into main bot
5. Monitor and adjust filters
