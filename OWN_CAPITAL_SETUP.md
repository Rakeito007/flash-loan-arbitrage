# Own Capital Arbitrage - Setup Complete! ✅

## Contract Deployed

**Address:** `0x1aAB73510150a4541CcBb8CaF0a89bEE4b2722E7`  
**Network:** Base Sepolia  
**Status:** ✅ Deployed and Ready

## What This Contract Does

This contract allows you to execute arbitrage trades using **your own capital** (no flash loans needed). It:

1. ✅ Works on Base Sepolia (no Aave required)
2. ✅ Trades on Moonwell DEX
3. ✅ Validates profit using price oracle
4. ✅ Protects against high gas and slippage
5. ✅ Supports single-hop and multi-hop trades

## Contract Functions

### Execute Trades

**Single Trade:**
```solidity
executeTrade(tokenIn, tokenOut, amountIn, minAmountOut)
```

**Multi-Hop Arbitrage:**
```solidity
executeMultiHopArb([tokenA, tokenB, tokenA], amountIn, minAmountOut)
```

### Estimate Profit (View Function)
```solidity
estimateProfit(path, amountIn) returns (expectedOut, profit, profitUSD)
```

### Deposit/Withdraw
```solidity
deposit(token, amount)  // Deposit tokens to contract
withdraw(token, amount) // Withdraw tokens (owner only)
getBalance(token)       // Check contract balance
```

### Update Settings
```solidity
updateRiskParams(maxGasPrice, minProfitUSD, maxTradeAmount)
```

## Default Settings

- **Max Gas Price:** 2 gwei
- **Min Profit USD:** $2.00
- **Max Trade Amount:** 10 ETH

## Quick Start

### 1. Test the Contract

```bash
npx hardhat run scripts/test-own-capital.js --network baseSepolia
```

### 2. Deposit Tokens

You need to deposit tokens to the contract before trading:

```javascript
const contract = await ethers.getContractAt("OwnCapitalArb", "0x1aAB73510150a4541CcBb8CaF0a89bEE4b2722E7");

// Approve first
await tokenContract.approve(contractAddress, amount);

// Then deposit
await contract.deposit(tokenAddress, amount);
```

### 3. Execute a Trade

```javascript
// Simple trade
await contract.executeTrade(
  tokenIn,      // e.g., WETH address
  tokenOut,     // e.g., USDC address
  amountIn,     // e.g., ethers.parseEther("0.1")
  minAmountOut // Minimum output (slippage protection)
);

// Multi-hop arbitrage (tokenA -> tokenB -> tokenA)
await contract.executeMultiHopArb(
  [tokenA, tokenB, tokenA], // Path
  amountIn,
  minAmountOut
);
```

### 4. Estimate Profit First

Always estimate profit before executing:

```javascript
const [expectedOut, profit, profitUSD] = await contract.estimateProfit(
  [tokenIn, tokenOut],
  amountIn
);

console.log("Expected profit:", ethers.formatUnits(profitUSD, 8), "USD");
```

## Bot Integration

The bot in `/bot/index.js` can be updated to use this contract. Update it to:

1. Check contract balance
2. Estimate profit for routes
3. Execute trades when profitable
4. Monitor results

## Important Notes

⚠️ **Capital Required:** You need to deposit tokens to the contract before trading

⚠️ **Profit Validation:** Trades only execute if profit ≥ $2.00 USD

⚠️ **Gas Protection:** Trades won't execute if gas > 2 gwei

⚠️ **Slippage:** Always set appropriate `minAmountOut` to protect against slippage

## Next Steps

1. ✅ Contract deployed
2. ⏭️ Deposit tokens to contract
3. ⏭️ Test with small amounts
4. ⏭️ Update bot to use this contract
5. ⏭️ Monitor and optimize

## Contract Address

Save this address:
```
0x1aAB73510150a4541CcBb8CaF0a89bEE4b2722E7
```

View on Base Sepolia Explorer:
https://sepolia.basescan.org/address/0x1aAB73510150a4541CcBb8CaF0a89bEE4b2722E7
