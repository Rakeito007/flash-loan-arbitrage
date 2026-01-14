# Flash Loan Arbitrage Bot

A complete flash loan arbitrage system with DexScreener integration, continuous scanning, and macOS desktop controller.

## 🚀 Features

### Smart Contracts
- **BaseMEVArb**: Advanced flash loan arbitrage with Aave integration
- **ArbitrageUniswapMoonwell**: Cross-DEX arbitrage (Uniswap ↔ Moonwell)
- **OwnCapitalArb**: Simple own capital trading

### Bot System
- **Continuous Scanning**: DexScreener integration for opportunity discovery
- **Automatic Execution**: Executes profitable trades automatically
- **Bidirectional Trading**: Buy on one DEX, sell on another
- **Low Competition Filtering**: Avoids MEV bots
- **Safety Mechanisms**: Profit validation, gas protection, slippage protection

### Desktop App
- **macOS Controller**: Beautiful Electron-based interface
- **Start/Stop Controls**: One-click bot control
- **Live Monitoring**: Real-time output and statistics
- **Dashboard**: Track uptime, scans, opportunities, trades

## 📁 Project Structure

```
flash-loan-app/
├── contracts/          # Solidity smart contracts
├── bot/               # Off-chain arbitrage bot
├── desktop-app/        # macOS desktop controller
├── scripts/           # Deployment and utility scripts
├── frontend/          # React frontend (original)
└── test/              # Contract tests
```

## 🛠️ Setup

### Prerequisites
- Node.js v18+
- MetaMask or wallet
- Base network access

### Installation

```bash
# Install root dependencies
npm install

# Install bot dependencies
cd bot && npm install && cd ..

# Install desktop app dependencies
cd desktop-app && npm install && cd ..
```

### Configuration

1. **Root `.env`**:
```bash
BASE_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_private_key_here
```

2. **Bot `.env`**:
```bash
RPC_URL=https://sepolia.base.org
CONTRACT_ADDRESS=your_deployed_contract_address
PRIVATE_KEY=your_private_key_here
MIN_PROFIT_USD=2.0
```

## 🚀 Usage

### Deploy Contracts

```bash
# Compile
npm run compile

# Deploy to Base Sepolia
npx hardhat run scripts/deploy-arbitrage.js --network baseSepolia
```

### Run Bot

**Option 1: Command Line**
```bash
cd bot
npm start
```

**Option 2: Desktop App**
```bash
cd desktop-app
npm start
```

### Desktop Controller

The desktop app provides:
- ✅ Start/Stop buttons
- ✅ Real-time output
- ✅ Statistics dashboard
- ✅ Status indicators

## 📊 How It Works

1. **Scanner**: Continuously scans DexScreener for opportunities
2. **Filtering**: Finds low-competition pairs
3. **Validation**: Checks profit, gas, slippage
4. **Execution**: Automatically executes profitable trades
5. **Monitoring**: Tracks statistics and performance

## 🔒 Security

- ✅ `.env` files excluded from git
- ✅ Private keys never committed
- ✅ Safety mechanisms in contracts
- ✅ Gas price protection
- ✅ Profit validation

## 📝 Documentation

- `README_ADVANCED.md` - Advanced features
- `OWN_CAPITAL_SETUP.md` - Own capital trading guide
- `DESKTOP_APP_GUIDE.md` - Desktop app guide
- `FLASH_LOAN_ALTERNATIVES.md` - Alternative approaches

## ⚠️ Disclaimer

This software is for educational purposes. Flash loans and arbitrage involve significant risks:
- Smart contract bugs
- Market volatility
- Gas price spikes
- MEV extraction

Always test on testnet first and never invest more than you can afford to lose.

## 📄 License

MIT
