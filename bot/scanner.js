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

  const results = await scanner.scanOpportunities(tokenAddresses);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCAN RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Pairs Found: ${results.pairs.length}`);
  console.log(`Arbitrage Opportunities: ${results.opportunities.length}`);
  
  if (results.opportunities.length > 0) {
    console.log('\n🎯 TOP OPPORTUNITIES (Lowest Competition First):');
    console.log('='.repeat(60));
    
    results.opportunities.slice(0, 10).forEach((opp, index) => {
      console.log(scanner.formatOpportunity(opp, index));
    });

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
