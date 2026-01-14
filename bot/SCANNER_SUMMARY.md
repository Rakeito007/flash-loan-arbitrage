# DexScreener Scanner - Summary

## ✅ What's Working

1. **Scanner Created** - `dexscreener-scanner.js`
2. **API Integration** - Successfully connecting to DexScreener
3. **Pair Discovery** - Finding pairs on Base network
4. **Filtering** - Low competition filtering working

## 📊 Current Results

- **Pairs Found:** 12 total pairs
- **Low Competition Pairs:** 1 pair
- **Arbitrage Opportunities:** 0 (need pairs on different DEXes)

## 🔍 What We Found

The scanner found pairs but they're mostly on:
- Uniswap (high volume)
- Aerodrome (Base DEX)
- PancakeSwap

**Issue:** Need to find the same token pair on **both Uniswap AND Moonwell** for arbitrage.

## 💡 Solutions

### Option 1: Search for Moonwell-Specific Pairs

Moonwell might not be indexed well on DexScreener. Try:

```bash
# Search directly for Moonwell
node dexscreener-scanner.js --dex moonwell
```

### Option 2: Manual Pair Discovery

1. Check Moonwell directly: https://moonwell.fi/
2. Find pairs with liquidity
3. Check if same pair exists on Uniswap
4. Add to scanner manually

### Option 3: Use Base Mainnet

Base Sepolia (testnet) has limited pairs. Base mainnet has:
- More liquidity
- More pairs
- Better DEX coverage
- More arbitrage opportunities

### Option 4: Adjust Filters

Current filters might be too strict. Try:

```javascript
// More lenient for testnet
maxVolume24h: 500000,  // $500k
maxTxns24h: 500,       // 500 transactions
minLiquidity: 50,      // $50 minimum
```

## 🎯 Next Steps

1. **Test on Base Mainnet** (if you have mainnet ETH)
2. **Search Moonwell directly** for available pairs
3. **Manually identify pairs** that exist on both DEXes
4. **Use the scanner** to monitor those specific pairs

## 📝 How to Use

### Basic Scan
```bash
cd bot
node scanner.js
```

### Search Specific Tokens
```bash
# In .env
TOKEN_ADDRESSES=0x4200000000000000000000000000000000000006,0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

node scanner.js
```

### Find Cross-DEX Opportunities

The scanner needs pairs on **both** DEXes. To find them:

1. **Check Moonwell:** https://moonwell.fi/ (Base network)
2. **Note token pairs** with good liquidity
3. **Check Uniswap:** https://app.uniswap.org/ (Base network)
4. **Verify same pairs exist** on both
5. **Add to scanner** for monitoring

## 🔧 Integration with Bot

Once you find opportunities, integrate:

```javascript
// In bot/index.js
import { DexScreenerScanner } from './dexscreener-scanner.js';

const scanner = new DexScreenerScanner();
const results = await scanner.scanOpportunities(['WETH', 'USDC']);

for (const opp of results.opportunities) {
  if (opp.competitionScore < 100) {
    // Execute arbitrage
    await contract.arbitrageMoonwellToUniswap(...);
  }
}
```

## 📈 Competition Score Guide

- **< 50:** Very low competition ✅ Best
- **50-100:** Low competition ✅ Good
- **100-200:** Medium competition ⚠️ OK
- **> 200:** High competition ❌ Avoid

## 🚫 Avoiding MEV Bots

The scanner helps by:
1. ✅ Finding low-volume pairs
2. ✅ Identifying less active pairs
3. ✅ Calculating competition scores
4. ✅ Prioritizing low-competition opportunities

**Additional Tips:**
- Use Flashbots/MEV-Blocker (already in bot)
- Execute during low-activity periods
- Start with small amounts
- Rotate between pairs

## 📊 Current Status

✅ **Scanner:** Working  
✅ **API:** Connected  
✅ **Filtering:** Working  
⚠️ **Opportunities:** Need cross-DEX pairs  
💡 **Solution:** Search Moonwell directly or use mainnet
