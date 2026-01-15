import { DexScreenerScanner } from './dexscreener-scanner.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Main scanner script
 * Finds low-competition arbitrage opportunities
 */

async function runScanner() {
  const scanner = new DexScreenerScanner();
  
  console.log('🚀 Starting DexScreener Scanner\n');
  console.log('Competition Filters:');
  console.log(`  Max Volume 24h: $${50000}`);
  console.log(`  Max Transactions 24h: ${100}`);
  console.log(`  Min Liquidity: $${1000}`);
  console.log(`  Max Liquidity: $${100000}`);
  console.log('');

  // Get token addresses from env or use defaults
  const tokenAddresses = process.env.TOKEN_ADDRESSES 
    ? process.env.TOKEN_ADDRESSES.split(',')
    : [];

  // Prioritize weird pairs (low bot interest)
  const results = await scanner.scanOpportunities(tokenAddresses, true);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCAN RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Pairs Found: ${results.pairs.length}`);
  console.log(`Weird/Obscure Pairs: ${results.weirdPairs.length}`);
  console.log(`Total Arbitrage Opportunities: ${results.opportunities.length}`);
  console.log(`🎯 Weird Pair Opportunities: ${results.weirdOpportunities.length}`);
  
  if (results.opportunities.length > 0) {
    console.log('\n🎯 TOP OPPORTUNITIES (Weird Pairs First, Then by Competition):');
    console.log('='.repeat(60));
    
    // Show weird pairs first
    const weirdOpps = results.opportunities.filter(opp => opp.isWeirdPair);
    const normalOpps = results.opportunities.filter(opp => !opp.isWeirdPair);
    
    if (weirdOpps.length > 0) {
      console.log('\n🌟 WEIRD PAIRS (Low Bot Interest - Prioritized):');
      weirdOpps.slice(0, 5).forEach((opp, index) => {
        console.log(scanner.formatOpportunity(opp, index));
      });
    }
    
    if (normalOpps.length > 0 && weirdOpps.length < 10) {
      console.log('\n📊 Standard Pairs:');
      normalOpps.slice(0, 10 - weirdOpps.length).forEach((opp, index) => {
        console.log(scanner.formatOpportunity(opp, index + weirdOpps.length));
      });
    }

    // Save to file for bot to use
    const fs = await import('fs');
    fs.writeFileSync(
      'opportunities.json',
      JSON.stringify(results.opportunities.slice(0, 20), null, 2)
    );
    console.log('\n💾 Saved top 20 opportunities to opportunities.json');
  } else {
    console.log('\n⚠️  No opportunities found with current filters.');
    console.log('Try adjusting competition thresholds or searching different tokens.');
  }
}

runScanner().catch(console.error);
