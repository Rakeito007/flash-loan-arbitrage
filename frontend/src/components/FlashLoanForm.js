import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './FlashLoanForm.css';

function FlashLoanForm({ contract, account, tokens }) {
  const [asset, setAsset] = useState(tokens.WETH || '');
  const [tokenToBuy, setTokenToBuy] = useState(tokens.USDC || ''); // Token to buy on Aave
  const [tokenToSell, setTokenToSell] = useState(tokens.USDC || ''); // Token to sell on Moonwell
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [estimatedProfit, setEstimatedProfit] = useState(null);
  const [estimating, setEstimating] = useState(false);

  const estimateProfit = async () => {
    if (!contract || !asset || !tokenToBuy || !tokenToSell || !amount || parseFloat(amount) <= 0) {
      setEstimatedProfit(null);
      return;
    }

    setEstimating(true);
    try {
      const amountWei = ethers.parseEther(amount);
      const [profit, premium] = await contract.estimateArbitrageProfit(
        asset,
        amountWei,
        tokenToBuy,
        tokenToSell
      );
      
      setEstimatedProfit({
        profit: ethers.formatEther(profit),
        premium: ethers.formatEther(premium),
        profitable: profit > 0
      });
    } catch (err) {
      console.error('Profit estimation error:', err);
      setEstimatedProfit({ error: err.message });
    } finally {
      setEstimating(false);
    }
  };

  // Estimate profit when inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      estimateProfit();
    }, 500); // Debounce
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, tokenToBuy, tokenToSell, amount, contract]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!contract) {
      setError('Contract not initialized. Please check contract address.');
      setLoading(false);
      return;
    }

    try {
      // Validate inputs
      if (!asset || !tokenToBuy || !tokenToSell || !amount || parseFloat(amount) <= 0) {
        setError('Please fill in all fields with valid values');
        setLoading(false);
        return;
      }

      // Convert amount to wei
      const amountWei = ethers.parseEther(amount);

      // Check max loan amount
      const maxLoan = await contract.maxLoanAmount();
      if (amountWei > maxLoan) {
        setError(`Amount exceeds maximum loan limit: ${ethers.formatEther(maxLoan)} ETH`);
        setLoading(false);
        return;
      }

      // Get slippage protection from contract
      const maxSlippageBps = await contract.maxSlippageBps();
      
      // Prepare parameters for arbitrage: (tokenToBuy, tokenToSell, minAaveOut, minMoonwellOut)
      // We'll set minAmountOut to 0 to use contract's slippage protection
      const params = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'uint256'],
        [
          tokenToBuy,    // Token to buy on Aave
          tokenToSell,   // Token to sell on Moonwell
          0,             // minAmountOutAave (0 = use contract slippage)
          0              // minAmountOutMoonwell (0 = use contract slippage)
        ]
      );

      // Estimate gas
      const gasEstimate = await contract.executeFlashLoan.estimateGas(
        asset,
        amountWei,
        params
      );

      // Execute flash loan
      const tx = await contract.executeFlashLoan(
        asset,
        amountWei,
        params,
        {
          gasLimit: gasEstimate * BigInt(120) / BigInt(100) // Add 20% buffer
        }
      );

      setSuccess(`Transaction sent! Hash: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      setSuccess(`Transaction confirmed! Block: ${receipt.blockNumber}`);

      // Listen for events
      contract.on('ArbitrageExecuted', (tokenIn, tokenOut, amountIn, amountOut, profit) => {
        setSuccess(`Arbitrage executed! Profit: ${ethers.formatEther(profit)} ETH`);
      });

      contract.on('FlashLoanExecuted', (token, loanAmount, profit, success) => {
        if (success) {
          setSuccess(prev => prev + ` | Total Profit: ${ethers.formatEther(profit)} ETH`);
        } else {
          setError('Flash loan execution failed');
        }
      });

    } catch (err) {
      console.error('Flash loan error:', err);
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flash-loan-form-container">
      <h2>Arbitrage: Buy on Aave, Sell on Moonwell</h2>
      <form onSubmit={handleSubmit} className="flash-loan-form">
        <div className="form-group">
          <label htmlFor="asset">Flash Loan Asset (to borrow):</label>
          <select
            id="asset"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="form-input"
          >
            <option value={tokens.WETH || ''}>WETH</option>
            <option value={tokens.USDC || ''}>USDC</option>
            <option value={tokens.DAI || ''}>DAI</option>
          </select>
          <input
            type="text"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            placeholder="Or enter custom token address"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Flash Loan Amount:</label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.01"
            min="0"
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="tokenToBuy">Token to Buy on Aave:</label>
          <select
            id="tokenToBuy"
            value={tokenToBuy}
            onChange={(e) => setTokenToBuy(e.target.value)}
            className="form-input"
          >
            <option value={tokens.WETH || ''}>WETH</option>
            <option value={tokens.USDC || ''}>USDC</option>
            <option value={tokens.DAI || ''}>DAI</option>
          </select>
          <input
            type="text"
            value={tokenToBuy}
            onChange={(e) => setTokenToBuy(e.target.value)}
            placeholder="Token address to buy on Aave"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="tokenToSell">Token to Sell on Moonwell:</label>
          <select
            id="tokenToSell"
            value={tokenToSell}
            onChange={(e) => setTokenToSell(e.target.value)}
            className="form-input"
          >
            <option value={tokens.WETH || ''}>WETH</option>
            <option value={tokens.USDC || ''}>USDC</option>
            <option value={tokens.DAI || ''}>DAI</option>
          </select>
          <input
            type="text"
            value={tokenToSell}
            onChange={(e) => setTokenToSell(e.target.value)}
            placeholder="Token address to sell on Moonwell"
            className="form-input"
          />
        </div>

        {/* Profit Estimation */}
        {amount && tokenToBuy && tokenToSell && (
          <div className="profit-estimation">
            <h3>Profit Estimation</h3>
            {estimating ? (
              <p>Calculating...</p>
            ) : estimatedProfit ? (
              estimatedProfit.error ? (
                <p className="estimation-error">Error: {estimatedProfit.error}</p>
              ) : (
                <div className="estimation-results">
                  <div className="estimation-item">
                    <span>Estimated Profit:</span>
                    <span className={estimatedProfit.profitable ? 'profit-positive' : 'profit-negative'}>
                      {estimatedProfit.profit} ETH
                    </span>
                  </div>
                  <div className="estimation-item">
                    <span>Flash Loan Premium:</span>
                    <span>{estimatedProfit.premium} ETH</span>
                  </div>
                  {!estimatedProfit.profitable && (
                    <p className="estimation-warning">
                      ⚠️ This arbitrage may not be profitable. Check prices before executing.
                    </p>
                  )}
                </div>
              )
            ) : null}
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !contract || (estimatedProfit && !estimatedProfit.profitable && !estimatedProfit.error)}
          className="submit-button"
        >
          {loading ? 'Executing Arbitrage...' : 'Execute Arbitrage'}
        </button>

        <div className="strategy-info">
          <h3>Strategy Overview</h3>
          <ol>
            <li>Borrow {amount || 'X'} {asset ? 'tokens' : ''} via flash loan from Aave</li>
            <li>Buy {tokenToBuy ? 'tokens' : 'token'} on Aave DEX</li>
            <li>Sell {tokenToSell ? 'tokens' : 'token'} on Moonwell DEX</li>
            <li>Repay flash loan + premium</li>
            <li>Keep the profit (if any)</li>
          </ol>
        </div>

        <div className="warning-box">
          <p><strong>⚠️ Important:</strong></p>
          <ul>
            <li>Flash loans must be repaid in the same transaction</li>
            <li>Ensure you have enough ETH for gas fees (can be high for complex swaps)</li>
            <li>Transaction will revert if repayment fails or profit is too low</li>
            <li>Arbitrage opportunities may disappear quickly - prices change fast</li>
            <li>Always test on testnet first with small amounts</li>
          </ul>
        </div>
      </form>
    </div>
  );
}

export default FlashLoanForm;
