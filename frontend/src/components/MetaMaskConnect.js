import React from 'react';
import './MetaMaskConnect.css';

function MetaMaskConnect({ onConnect }) {
  return (
    <div className="metamask-connect">
      <div className="connect-card">
        <div className="metamask-icon">🦊</div>
        <h2>Connect Your Wallet</h2>
        <p>Connect MetaMask to start using flash loans</p>
        <button onClick={onConnect} className="connect-button">
          Connect MetaMask
        </button>
        <div className="info-box">
          <p><strong>Requirements:</strong></p>
          <ul>
            <li>MetaMask extension installed</li>
            <li>Account with ETH for gas fees</li>
            <li>Network: Sepolia (testnet) or Mainnet</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default MetaMaskConnect;
