import React, { useState, useEffect } from 'react';
import './App.css';
import MetaMaskConnect from './components/MetaMaskConnect';
import FlashLoanForm from './components/FlashLoanForm';
import { ethers } from 'ethers';

// Contract ABI (simplified - import full ABI in production)
const FLASH_LOAN_ABI = [
  "function executeFlashLoan(address asset, uint256 amount, bytes calldata params) external",
  "function getSafetyParams() external view returns (uint256, uint256, uint256)",
  "function maxLoanAmount() external view returns (uint256)",
  "function minProfitThreshold() external view returns (uint256)",
  "function maxSlippageBps() external view returns (uint256)",
  "function estimateArbitrageProfit(address asset, uint256 amount, address tokenToBuy, address tokenToSell) external view returns (uint256, uint256)",
  "event FlashLoanExecuted(address indexed asset, uint256 amount, uint256 profit, bool success)",
  "event ArbitrageExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 profit)"
];

// Common token addresses (Sepolia testnet)
const TOKENS = {
  WETH: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
  USDC: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
  DAI: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
};

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [safetyParams, setSafetyParams] = useState(null);
  const [network, setNetwork] = useState(null);

  // Contract address - update this after deployment
  const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '';

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          setProvider(provider);
          setAccount(accounts[0].address);
          await setupContract(provider);
        }

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount(null);
      setContract(null);
    } else {
      setAccount(accounts[0]);
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setProvider(provider);
      setAccount(address);
      await setupContract(provider);

      // Get network info
      const network = await provider.getNetwork();
      setNetwork({
        name: network.name,
        chainId: Number(network.chainId)
      });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  const setupContract = async (provider) => {
    if (!CONTRACT_ADDRESS) {
      console.warn('Contract address not set. Please update REACT_APP_CONTRACT_ADDRESS');
      return;
    }

    try {
      const signer = await provider.getSigner();
      const contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        FLASH_LOAN_ABI,
        signer
      );
      setContract(contractInstance);

      // Load safety parameters
      const params = await contractInstance.getSafetyParams();
      setSafetyParams({
        maxLoanAmount: ethers.formatEther(params[0]),
        minProfitThreshold: Number(params[1]) / 100,
        maxSlippageBps: Number(params[2]) / 100,
      });
    } catch (error) {
      console.error('Error setting up contract:', error);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setContract(null);
    setSafetyParams(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Flash Loan App</h1>
        <p className="subtitle">Low-risk flash loan execution with MetaMask</p>
      </header>

      <main className="App-main">
        {!account ? (
          <MetaMaskConnect onConnect={connectWallet} />
        ) : (
          <div className="connected-container">
            <div className="wallet-info">
              <div className="info-item">
                <span className="label">Connected:</span>
                <span className="value">{account.slice(0, 6)}...{account.slice(-4)}</span>
              </div>
              {network && (
                <div className="info-item">
                  <span className="label">Network:</span>
                  <span className="value">{network.name} ({network.chainId})</span>
                </div>
              )}
              <button onClick={disconnectWallet} className="disconnect-btn">
                Disconnect
              </button>
            </div>

            {safetyParams && (
              <div className="safety-params">
                <h3>Safety Parameters</h3>
                <div className="params-grid">
                  <div className="param-item">
                    <span className="param-label">Max Loan Amount:</span>
                    <span className="param-value">{safetyParams.maxLoanAmount} ETH</span>
                  </div>
                  <div className="param-item">
                    <span className="param-label">Min Profit Threshold:</span>
                    <span className="param-value">{safetyParams.minProfitThreshold}%</span>
                  </div>
                  <div className="param-item">
                    <span className="param-label">Max Slippage:</span>
                    <span className="param-value">{safetyParams.maxSlippageBps}%</span>
                  </div>
                </div>
              </div>
            )}

            <FlashLoanForm 
              contract={contract} 
              account={account}
              tokens={TOKENS}
            />
          </div>
        )}
      </main>

      <footer className="App-footer">
        <p>⚠️ Use at your own risk. Flash loans involve smart contract risks.</p>
      </footer>
    </div>
  );
}

export default App;
