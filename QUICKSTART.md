# Quick Start Guide

Get your flash loan app running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd /Users/rakeito/flash-loan-app
npm install
cd frontend
npm install
cd ..
```

## Step 2: Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and add:
- Your private key (for deployment)
- RPC URL (Sepolia testnet recommended for testing)

## Step 3: Compile Contracts

```bash
npm run compile
```

## Step 4: Deploy (Choose One)

### Option A: Local Network (Recommended for Testing)

Terminal 1:
```bash
npm run node
```

Terminal 2:
```bash
npm run deploy:local
```

Copy the deployed contract address.

### Option B: Sepolia Testnet

1. Get Sepolia ETH from [faucet](https://sepoliafaucet.com/)
2. Update `.env` with your private key
3. Deploy:
```bash
npm run deploy:sepolia
```

## Step 5: Update Frontend

Edit `frontend/src/App.js` and update:
```javascript
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';
```

Or set it in `.env`:
```
REACT_APP_CONTRACT_ADDRESS=YOUR_DEPLOYED_CONTRACT_ADDRESS
```

## Step 6: Run Frontend

```bash
npm run frontend
```

Open `http://localhost:3000` in your browser.

## Step 7: Connect MetaMask

1. Install MetaMask extension if you haven't
2. Click "Connect MetaMask" in the app
3. Approve the connection
4. Make sure you're on the correct network (Sepolia for testnet)

## Step 8: Test Flash Loan

⚠️ **Important**: The current contract has placeholder logic. Before using with real funds:

1. Implement your strategy in `contracts/FlashLoanReceiver.sol` in the `executeOperation` function
2. Test thoroughly on testnet
3. Start with small amounts

## Troubleshooting

### "Contract not initialized"
- Make sure you've deployed the contract and updated the address in `App.js`

### "Insufficient funds"
- Ensure you have ETH for gas fees
- For testnet, get Sepolia ETH from a faucet

### "Transaction failed"
- Check you're on the correct network
- Verify you have enough gas
- The contract may revert if safety checks fail

### MetaMask not connecting
- Make sure MetaMask is installed and unlocked
- Try refreshing the page
- Check browser console for errors

## Next Steps

1. **Implement Your Strategy**: Edit the `executeOperation` function in `FlashLoanReceiver.sol`
2. **Add More Safety Checks**: Customize safety parameters
3. **Test Extensively**: Use testnet before mainnet
4. **Monitor Gas Costs**: Flash loans can be expensive

## Need Help?

- Check the main [README.md](./README.md) for detailed documentation
- Review the contract code in `contracts/FlashLoanReceiver.sol`
- Test on local network first before deploying to testnet
