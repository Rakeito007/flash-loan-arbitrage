import axios from 'axios';
import { ethers } from 'ethers';

/**
 * DexScreener Scanner
 * Finds low-competition arbitrage opportunities on Base network
 */

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

// Base network chain ID
const BASE_CHAIN_ID = 'base';
const BASE_SEPOLIA_CHAIN_ID = 'base-sepolia'; // If available

// Competition indicators (lower = less competition)
const COMPETITION_THRESHOLDS = {
  maxVolume24h: 100000,     // Max $100k volume (relaxed for testnet)
  maxTxns24h: 200,          // Max 200 transactions (relaxed for testnet)
  minLiquidity: 100,        // Min $100 liquidity (lower for testnet)
  maxLiquidity: 500000,      // Max $500k liquidity (relaxed)
  minPriceChange24h: -100,  // No minimum (testnet can be quiet)
  maxPriceChange24h: 100,   // Max 100% change
};

// "Weird pair" indicators - pairs that bots have limited interest in
const WEIRD_PAIR_INDICATORS = {
  maxVolume24h: 50000,       // Lower volume = less bot interest
  maxTxns24h: 50,            // Fewer transactions = less activity
  minLiquidity: 500,         // Need some liquidity but not too much
  maxLiquidity: 50000,       // Lower liquidity = less whale interest
  minPairsCount: 1,          // Pairs that exist on fewer DEXes
  obscureTokenNames: true,   // Prefer non-standard token names
  lowMarketCap: true,       // Lower market cap tokens
};

class DexScreenerScanner {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  /**
   * Fetch pairs from DexScreener for Base network
   */
  async fetchBasePairs(tokenAddress = null) {
    try {
      let url;
      if (tokenAddress) {
        // Get pairs for specific token
        url = `${DEXSCREENER_API}/tokens/${tokenAddress}`;
      } else {
        // Get all pairs (limited - may need to use search)
        url = `${DEXSCREENER_API}/search?q=base`;
      }

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.data && response.data.pairs) {
        return response.data.pairs.filter(pair => 
          pair.chainId === BASE_CHAIN_ID || 
          pair.chainId === BASE_SEPOLIA_CHAIN_ID
        );
      }

      return [];
    } catch (error) {
      console.error('DexScreener API error:', error.message);
      return [];
    }
  }

  /**
   * Search for pairs by token symbol or address
   */
  async searchPairs(query) {
    try {
      const url = `${DEXSCREENER_API}/search?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, { timeout: 10000 });

      if (response.data && response.data.pairs) {
        return response.data.pairs.filter(pair => 
          pair.chainId === BASE_CHAIN_ID || 
          pair.chainId === BASE_SEPOLIA_CHAIN_ID
        );
      }

      return [];
    } catch (error) {
      console.error('Search error:', error.message);
      return [];
    }
  }

  /**
   * Filter pairs for low competition
   */
  filterLowCompetitionPairs(pairs) {
    console.log(`\nFiltering ${pairs.length} pairs...`);
    
    const filtered = pairs.filter(pair => {
      const volume24h = parseFloat(pair.volume?.h24 || 0);
      const txns24h = parseInt(pair.txns?.h24?.buys || 0) + parseInt(pair.txns?.h24?.sells || 0);
      const liquidity = parseFloat(pair.liquidity?.usd || 0);
      const priceChange24h = parseFloat(pair.priceChange?.h24 || 0);
      const dexId = (pair.dexId || '').toLowerCase();

      // More lenient filtering for testnet
      const hasValidDex = dexId.includes('uniswap') || 
                         dexId.includes('moonwell') ||
                         dexId.includes('base') ||
                         dexId.includes('aerodrome') || // Base DEX
                         dexId.includes('swap'); // Generic swap

      const passes = (
        volume24h <= COMPETITION_THRESHOLDS.maxVolume24h &&
        txns24h <= COMPETITION_THRESHOLDS.maxTxns24h &&
        liquidity >= COMPETITION_THRESHOLDS.minLiquidity &&
        liquidity <= COMPETITION_THRESHOLDS.maxLiquidity &&
        Math.abs(priceChange24h) <= COMPETITION_THRESHOLDS.maxPriceChange24h &&
        hasValidDex &&
        pair.baseToken?.address &&
        pair.quoteToken?.address
      );

      if (!passes && pairs.length <= 20) {
        // Debug first few failures
        console.log(`  ❌ ${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}: v=${volume24h}, t=${txns24h}, l=${liquidity}, d=${dexId}`);
      }

      return passes;
    });

    console.log(`Filtered to ${filtered.length} pairs`);
    return filtered;
  }

  /**
   * Filter for "weird pairs" - obscure pairs with low bot interest
   */
  filterWeirdPairs(pairs) {
    console.log(`\n🔍 Identifying weird/obscure pairs (low bot interest)...`);
    
    const weirdPairs = pairs.filter(pair => {
      const volume24h = parseFloat(pair.volume?.h24 || 0);
      const txns24h = parseInt(pair.txns?.h24?.buys || 0) + parseInt(pair.txns?.h24?.sells || 0);
      const liquidity = parseFloat(pair.liquidity?.usd || 0);
      const baseSymbol = (pair.baseToken?.symbol || '').toLowerCase();
      const quoteSymbol = (pair.quoteToken?.symbol || '').toLowerCase();
      
      // Common tokens that bots love (exclude these)
      const commonTokens = ['weth', 'eth', 'usdc', 'usdt', 'dai', 'wbtc', 'btc', 'bnb', 'matic', 'avax'];
      const isCommonPair = commonTokens.includes(baseSymbol) && commonTokens.includes(quoteSymbol);
      
      // Check if token names look "weird" (not standard)
      const baseName = (pair.baseToken?.name || '').toLowerCase();
      const quoteName = (pair.quoteToken?.name || '').toLowerCase();
      const hasWeirdName = !baseName.includes('wrapped') && 
                          !baseName.includes('stablecoin') &&
                          !quoteName.includes('wrapped') &&
                          !quoteName.includes('stablecoin');
      
      // Weird pair criteria
      const isWeird = (
        volume24h <= WEIRD_PAIR_INDICATORS.maxVolume24h &&
        volume24h > 0 && // Must have some activity
        txns24h <= WEIRD_PAIR_INDICATORS.maxTxns24h &&
        liquidity >= WEIRD_PAIR_INDICATORS.minLiquidity &&
        liquidity <= WEIRD_PAIR_INDICATORS.maxLiquidity &&
        !isCommonPair && // Not a common pair
        hasWeirdName // Has non-standard token names
      );

      return isWeird;
    });

    console.log(`Found ${weirdPairs.length} weird/obscure pairs`);
    return weirdPairs;
  }

  /**
   * Calculate "weirdness score" - higher = more obscure, less bot interest
   */
  calculateWeirdnessScore(pair) {
    let score = 0;
    
    const volume24h = parseFloat(pair.volume?.h24 || 0);
    const txns24h = parseInt(pair.txns?.h24?.buys || 0) + parseInt(pair.txns?.h24?.sells || 0);
    const liquidity = parseFloat(pair.liquidity?.usd || 0);
    const baseSymbol = (pair.baseToken?.symbol || '').toLowerCase();
    const quoteSymbol = (pair.quoteToken?.symbol || '').toLowerCase();
    
    // Lower volume = more weird (bots avoid)
    if (volume24h < 10000) score += 30;
    else if (volume24h < 25000) score += 20;
    else if (volume24h < 50000) score += 10;
    
    // Fewer transactions = more weird
    if (txns24h < 20) score += 30;
    else if (txns24h < 50) score += 20;
    else if (txns24h < 100) score += 10;
    
    // Lower liquidity = more weird (but still tradeable)
    if (liquidity < 5000) score += 20;
    else if (liquidity < 20000) score += 15;
    else if (liquidity < 50000) score += 10;
    
    // Non-standard token names = more weird
    const commonTokens = ['weth', 'eth', 'usdc', 'usdt', 'dai', 'wbtc', 'btc'];
    if (!commonTokens.includes(baseSymbol) && !commonTokens.includes(quoteSymbol)) {
      score += 20; // Both tokens are uncommon
    } else if (!commonTokens.includes(baseSymbol) || !commonTokens.includes(quoteSymbol)) {
      score += 10; // One token is uncommon
    }
    
    // Long or unusual token names
    const baseName = (pair.baseToken?.name || '').toLowerCase();
    const quoteName = (pair.quoteToken?.name || '').toLowerCase();
    if (baseName.length > 20 || quoteName.length > 20) {
      score += 10; // Unusually long names
    }
    
    // Token symbols with numbers or special chars (often obscure)
    if (/\d/.test(baseSymbol) || /\d/.test(quoteSymbol)) {
      score += 5;
    }
    
    return score;
  }

  /**
   * Find arbitrage opportunities between DEXes
   * Prioritizes "weird pairs" with low bot interest
   */
  findArbitrageOpportunities(pairs, prioritizeWeird = true) {
    const opportunities = [];
    
    // Group pairs by token pair (e.g., WETH/USDC)
    const pairMap = new Map();
    
    pairs.forEach(pair => {
      const key = `${pair.baseToken.address}-${pair.quoteToken.address}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, []);
      }
      pairMap.get(key).push(pair);
    });

    // Find pairs with same tokens on different DEXes
    pairMap.forEach((dexPairs, key) => {
      if (dexPairs.length >= 2) {
        // Check all combinations
        for (let i = 0; i < dexPairs.length; i++) {
          for (let j = i + 1; j < dexPairs.length; j++) {
            const pair1 = dexPairs[i];
            const pair2 = dexPairs[j];
            
            // Must be on different DEXes
            if (pair1.dexId !== pair2.dexId) {
              const price1 = parseFloat(pair1.priceUsd || 0);
              const price2 = parseFloat(pair2.priceUsd || 0);
              
              if (price1 > 0 && price2 > 0) {
                const priceDiff = Math.abs(price1 - price2);
                const priceDiffPercent = (priceDiff / Math.min(price1, price2)) * 100;
                
                // Minimum 0.5% price difference for arbitrage
                if (priceDiffPercent >= 0.5) {
                  // Calculate weirdness score for this pair
                  const weirdnessScore = this.calculateWeirdnessScore(pair1) + 
                                        this.calculateWeirdnessScore(pair2);
                  
                  opportunities.push({
                    tokenPair: key,
                    baseToken: pair1.baseToken,
                    quoteToken: pair1.quoteToken,
                    dex1: {
                      name: pair1.dexId,
                      address: pair1.pairAddress,
                      price: price1,
                      liquidity: parseFloat(pair1.liquidity?.usd || 0),
                      volume24h: parseFloat(pair1.volume?.h24 || 0),
                    },
                    dex2: {
                      name: pair2.dexId,
                      address: pair2.pairAddress,
                      price: price2,
                      liquidity: parseFloat(pair2.liquidity?.usd || 0),
                      volume24h: parseFloat(pair2.volume?.h24 || 0),
                    },
                    priceDifference: priceDiff,
                    priceDifferencePercent: priceDiffPercent,
                    buyOn: price1 < price2 ? pair1.dexId : pair2.dexId,
                    sellOn: price1 < price2 ? pair2.dexId : pair1.dexId,
                    competitionScore: this.calculateCompetitionScore(pair1, pair2),
                    weirdnessScore: weirdnessScore, // Higher = more obscure, less bot interest
                    isWeirdPair: weirdnessScore >= 50, // Threshold for "weird" pairs
                  });
                }
              }
            }
          }
        }
      }
    });

    // Sort: prioritize weird pairs first, then by competition score
    if (prioritizeWeird) {
      return opportunities.sort((a, b) => {
        // Weird pairs first
        if (a.isWeirdPair && !b.isWeirdPair) return -1;
        if (!a.isWeirdPair && b.isWeirdPair) return 1;
        // Then by weirdness score (higher = better)
        if (a.weirdnessScore !== b.weirdnessScore) {
          return b.weirdnessScore - a.weirdnessScore;
        }
        // Finally by competition score (lower = better)
        return a.competitionScore - b.competitionScore;
      });
    } else {
      // Sort by competition score (lower = less competition)
      return opportunities.sort((a, b) => a.competitionScore - b.competitionScore);
    }
  }

  /**
   * Calculate competition score (lower = less competition)
   */
  calculateCompetitionScore(pair1, pair2) {
    const volume1 = parseFloat(pair1.volume?.h24 || 0);
    const volume2 = parseFloat(pair2.volume?.h24 || 0);
    const txns1 = parseInt(pair1.txns?.h24?.buys || 0) + parseInt(pair1.txns?.h24?.sells || 0);
    const txns2 = parseInt(pair2.txns?.h24?.buys || 0) + parseInt(pair2.txns?.h24?.sells || 0);
    
    // Lower volume + lower transactions = lower competition
    const totalVolume = volume1 + volume2;
    const totalTxns = txns1 + txns2;
    
    // Score: volume weight + transaction weight
    return (totalVolume / 1000) + (totalTxns * 10);
  }

  /**
   * Scan for opportunities, prioritizing weird/obscure pairs
   */
  async scanOpportunities(tokenAddresses = [], prioritizeWeird = true) {
    console.log('🔍 Scanning DexScreener for opportunities...');
    if (prioritizeWeird) {
      console.log('🎯 Prioritizing weird/obscure pairs (low bot interest)\n');
    } else {
      console.log('📊 Standard scan mode\n');
    }

    let allPairs = [];

    if (tokenAddresses.length > 0) {
      // Search for specific tokens
      for (const tokenAddress of tokenAddresses) {
        console.log(`Searching for token: ${tokenAddress}`);
        const pairs = await this.fetchBasePairs(tokenAddress);
        allPairs.push(...pairs);
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }
    } else {
      // Search for common tokens AND look for obscure ones
      const commonTokens = [
        'WETH',
        'USDC',
        'DAI',
        'USDT',
      ];

      for (const token of commonTokens) {
        console.log(`Searching for ${token}...`);
        const pairs = await this.searchPairs(token);
        allPairs.push(...pairs);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Also search for random/obscure tokens by searching Base network broadly
      console.log('Searching for obscure pairs on Base...');
      try {
        // Search for less common terms that might reveal weird pairs
        const obscureSearches = ['base', 'test', 'meme', 'new'];
        for (const term of obscureSearches) {
          const pairs = await this.searchPairs(term);
          allPairs.push(...pairs);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.log('  (Some searches may have failed - this is OK)');
      }
    }

    console.log(`\nFound ${allPairs.length} total pairs`);

    // Filter for low competition
    const lowCompetitionPairs = this.filterLowCompetitionPairs(allPairs);
    console.log(`Filtered to ${lowCompetitionPairs.length} low-competition pairs`);

    // Identify weird pairs
    const weirdPairs = this.filterWeirdPairs(lowCompetitionPairs);
    console.log(`🎯 Found ${weirdPairs.length} weird/obscure pairs (low bot interest)`);

    // Find arbitrage opportunities (prioritize weird pairs if enabled)
    const opportunities = this.findArbitrageOpportunities(
      lowCompetitionPairs, 
      prioritizeWeird
    );
    
    const weirdOpportunities = opportunities.filter(opp => opp.isWeirdPair);
    console.log(`Found ${opportunities.length} total arbitrage opportunities`);
    console.log(`🎯 ${weirdOpportunities.length} weird pair opportunities (prioritized)\n`);

    return {
      pairs: lowCompetitionPairs,
      weirdPairs: weirdPairs,
      opportunities: opportunities,
      weirdOpportunities: weirdOpportunities,
    };
  }

  /**
   * Format opportunity for display
   */
  formatOpportunity(opp, index) {
    const weirdBadge = opp.isWeirdPair ? ' 🎯 WEIRD PAIR (Low Bot Interest)' : '';
    return `
${index + 1}. ${opp.baseToken.symbol}/${opp.quoteToken.symbol}${weirdBadge}
   📊 Price Difference: ${opp.priceDifferencePercent.toFixed(2)}%
   💰 Buy on: ${opp.buyOn} ($${opp.dex1.price.toFixed(6)})
   💰 Sell on: ${opp.sellOn} ($${opp.dex2.price.toFixed(6)})
   📈 Competition Score: ${opp.competitionScore.toFixed(2)} (lower = better)
   🎯 Weirdness Score: ${opp.weirdnessScore || 0} (higher = more obscure)
   💧 Total Liquidity: $${(opp.dex1.liquidity + opp.dex2.liquidity).toFixed(2)}
   📊 Total Volume 24h: $${(opp.dex1.volume24h + opp.dex2.volume24h).toFixed(2)}
   🔗 Token Addresses:
      Base: ${opp.baseToken.address}
      Quote: ${opp.quoteToken.address}
`;
  }
}

// Main execution
async function main() {
  const scanner = new DexScreenerScanner();
  
  // You can specify token addresses to search, or leave empty for common tokens
  const tokenAddresses = process.argv.slice(2);
  
  const results = await scanner.scanOpportunities(tokenAddresses);
  
  console.log('='.repeat(60));
  console.log('🎯 TOP LOW-COMPETITION OPPORTUNITIES');
  console.log('='.repeat(60));
  
  if (results.opportunities.length === 0) {
    console.log('\n⚠️  No opportunities found. Try:');
    console.log('   - Different token addresses');
    console.log('   - Adjusting competition thresholds');
    console.log('   - Checking if DEXes are available on Base');
  } else {
    // Show top 10
    results.opportunities.slice(0, 10).forEach((opp, index) => {
      console.log(scanner.formatOpportunity(opp, index));
    });
  }
  
  console.log('\n💡 Tips to avoid MEV bots:');
  console.log('   - Look for pairs with competition score < 100');
  console.log('   - Prefer pairs with volume < $10k');
  console.log('   - Use private transactions (Flashbots/MEV-Blocker)');
  console.log('   - Execute during low-activity periods');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DexScreenerScanner };
