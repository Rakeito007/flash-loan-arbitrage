# Flash Loan Arbitrage App

A low-risk flash loan arbitrage application that buys tokens on Aave and sells them on Moonwell, with MetaMask integration.

## Strategy

This app implements a flash loan arbitrage strategy:

1. **Borrow** assets via flash loan from Aave
2. **Buy** tokens on Aave DEX (at lower price)
3. **Sell** tokens on Moonwell DEX (at higher price)
4. **Repay** flash loan + premium
5. **Keep** the profit

## Features

- ✅ **Flash Loan Execution** - Borrow and repay in a single transaction
- ✅ **Arbitrage Strategy** - Buy on Aave, sell on Moonwell
- ✅ **MetaMask Integration** - Seamless wallet connection
- ✅ **Profit Estimation** - Real-time profit calculation before execution
- ✅ **Safety Mechanisms** - Built-in risk controls:
  - Maximum loan amount limits
  - Minimum profit thresholds
  - Slippage protection
  - Reentrancy guards
- ✅ **Aave V3 Integration** - Uses Aave's flash loan protocol
- ✅ **Modern UI** - Clean, responsive React frontend

## Architecture

### Smart Contracts
- `FlashLoanReceiver.sol` - Main contract that handles flash loan execution and arbitrage
- Implements the full arbitrage strategy: Aave → Moonwell

### Frontend
- React app with MetaMask integration
- Real-time profit estimation
- Transaction status tracking
- Safety parameter display

## Prerequisites

- Node.js (v18 or higher)
- MetaMask browser extension
- ETH for gas fees (testnet or mainnet)
- Access to networks where both Aave and Moonwell operate (Base network recommended)

## Installation

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your private key and RPC URLs
   ```

3. **Update router addresses:**
   - Edit `scripts/deploy.js` and update the router addresses for your target network
   - Aave router: Address of Aave's swap router
   - Moonwell router: Address of Moonwell's DEX router

4. **Compile contracts:**
   ```bash
   npm run compile
   ```

## Deployment

### Local Development

1. Start local Hardhat node:
   ```bash
   npm run node
   ```

2. Deploy to local network (in a new terminal):
   ```bash
   npm run deploy:local
   ```

### Base Network (Recommended for Moonwell)

Moonwell operates on Base network. To deploy:

1. Get Base ETH from a faucet
2. Update `.env` with your private key and Base RPC URL
3. Update router addresses in `scripts/deploy.js`:
   ```javascript
   base: {
     aave: "YOUR_AAVE_ROUTER_ON_BASE",
     moonwell: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // Moonwell router
   }
   ```
4. Deploy:
   ```bash
   hardhat run scripts/deploy.js --network base
   ```

### Sepolia Testnet

1. Get Sepolia ETH from [faucet](https://sepoliafaucet.com/)
2. Update `.env` with your private key and Sepolia RPC URL
3. Update router addresses in `scripts/deploy.js`
4. Deploy:
   ```bash
   npm run deploy:sepolia
   ```

5. Copy the deployed contract address
6. Update `frontend/src/App.js` with the contract address, or set `REACT_APP_CONTRACT_ADDRESS` in `.env`

## Running the Frontend

```bash
npm run frontend
```

The app will open at `http://localhost:3000`

## Usage

1. **Connect MetaMask:**
   - Click "Connect MetaMask" button
   - Approve the connection in MetaMask
   - Ensure you're on the correct network (Base for Moonwell, or your target network)

2. **Set Up Arbitrage:**
   - Select the asset to flash loan (e.g., WETH)
   - Enter the amount to borrow
   - Select token to buy on Aave
   - Select token to sell on Moonwell (usually same as token to buy)
   - Review the profit estimation

3. **Execute Arbitrage:**
   - Click "Execute Arbitrage"
   - Confirm the transaction in MetaMask
   - Wait for confirmation

4. **Monitor:**
   - Watch for transaction confirmations
   - Check profit in the success message

## How It Works

### Step-by-Step Execution

1. **Flash Loan**: Contract borrows assets from Aave (no collateral needed)
2. **Buy on Aave**: Uses borrowed assets to buy tokens on Aave's DEX
3. **Sell on Moonwell**: Sells the tokens on Moonwell's DEX
4. **Repay**: Repays the flash loan + premium (typically 0.09%)
5. **Profit**: Keeps any remaining tokens as profit

### Safety Checks

The contract includes several safety mechanisms:

- **Max Loan Amount**: Prevents borrowing more than the configured limit
- **Min Profit Threshold**: Ensures operations only execute if profit meets minimum requirements
- **Slippage Protection**: Prevents execution if price moves unfavorably
- **Reentrancy Guard**: Prevents reentrancy attacks
- **Profit Estimation**: Frontend estimates profit before execution

## Important Notes

⚠️ **Network Compatibility**: Moonwell operates on Base network. Ensure both Aave and Moonwell are available on your target network.

⚠️ **Router Addresses**: You must update the router addresses in `scripts/deploy.js` with the correct addresses for your network:
- Aave swap router address
- Moonwell DEX router address

⚠️ **Gas Costs**: Flash loan arbitrage transactions can be expensive. Monitor gas costs and ensure profitability after fees.

⚠️ **Price Changes**: Arbitrage opportunities can disappear quickly. Prices change between estimation and execution.

⚠️ **Testing**: Always test on testnet first with small amounts before using real funds.

## Customization

### Update Safety Parameters

Call `updateSafetyParams()` on the deployed contract:
- `maxLoanAmount`: Maximum ETH that can be borrowed
- `minProfitThreshold`: Minimum profit in basis points (100 = 1%)
- `maxSlippageBps`: Maximum acceptable slippage in basis points

### Update Router Addresses

Call `updateRouters()` on the deployed contract:
- `_aaveRouter`: New Aave router address
- `_moonwellRouter`: New Moonwell router address

## Testing

```bash
npm test
```

## Network Addresses

### Aave V3 Pool Addresses Provider
- **Sepolia**: `0x012bAC54348C0E635dCAc9D5FB99f06F24136C9a`
- **Mainnet**: `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e`
- **Base**: `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D`

### Moonwell
- **Base Router**: `0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24` (verify on [Moonwell docs](https://docs.moonwell.fi/))

### Common Token Addresses
Update these based on your network:
- WETH, USDC, DAI addresses vary by network

## Troubleshooting

### "Arbitrage not profitable"
- Prices may have changed between estimation and execution
- Gas costs may be too high
- Slippage may be too high
- Try with a smaller amount or different token pair

### "Slippage too high"
- Market moved unfavorably
- Increase `maxSlippageBps` (but be careful!)
- Try a different token pair

### "Insufficient balance to repay loan"
- The arbitrage didn't generate enough profit
- Check that prices are actually different between Aave and Moonwell

## License

MIT

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Flash loans and arbitrage involve significant financial and technical risks. Always:
- Test thoroughly on testnets
- Start with small amounts
- Monitor gas costs
- Understand the risks
- Never invest more than you can afford to lose
