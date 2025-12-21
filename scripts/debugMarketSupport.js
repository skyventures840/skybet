require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { OddsApiService } = require('../services/oddsApiService');

async function debugMarketSupport(sportKey) {
  const oddsService = new OddsApiService();
  
  console.log(`🔍 Debugging market support for ${sportKey}`);
  
  // Test basic markets first
  const basicMarkets = ['h2h', 'spreads', 'totals'];
  console.log('\n1. Testing basic markets individually:');
  
  for (const market of basicMarkets) {
    try {
      const response = await oddsService.client.get(`/sports/${sportKey}/odds`, {
        params: {
          regions: 'us',
          markets: market,
          oddsFormat: 'decimal'
        }
      });
      console.log(`✅ ${market}: SUPPORTED (${response.data.length} events)`);
    } catch (error) {
      console.log(`❌ ${market}: ERROR - Status: ${error.response?.status}, Message: ${error.response?.data?.message || error.message}`);
    }
  }
  
  console.log('\n2. Testing all basic markets together:');
  try {
    const response = await oddsService.client.get(`/sports/${sportKey}/odds`, {
      params: {
        regions: 'us',
        markets: basicMarkets.join(','),
        oddsFormat: 'decimal'
      }
    });
    console.log(`✅ All basic markets: SUPPORTED (${response.data.length} events)`);
  } catch (error) {
    console.log(`❌ All basic markets: ERROR - Status: ${error.response?.status}`);
    console.log(`Error message: ${error.response?.data?.message || error.message}`);
    console.log(`Full error data:`, JSON.stringify(error.response?.data, null, 2));
  }
  
  console.log('\n3. Testing comprehensive market list:');
  const comprehensiveMarkets = [
    'h2h', 'spreads', 'totals', 'alternate_spreads', 'alternate_totals',
    'team_totals', 'alternate_team_totals', 'h2h_h1', 'h2h_h2',
    'spreads_h1', 'spreads_h2', 'totals_h1', 'totals_h2',
    'player_pass_tds', 'player_rush_yds', 'player_reception_yds',
    'player_points', 'player_rebounds', 'player_assists'
  ];
  
  try {
    const response = await oddsService.client.get(`/sports/${sportKey}/odds`, {
      params: {
        regions: 'us',
        markets: comprehensiveMarkets.join(','),
        oddsFormat: 'decimal'
      }
    });
    console.log(`✅ All comprehensive markets: SUPPORTED (${response.data.length} events)`);
  } catch (error) {
    console.log(`❌ All comprehensive markets: ERROR - Status: ${error.response?.status}`);
    console.log(`Error message: ${error.response?.data?.message || error.message}`);
    console.log(`Full error data:`, JSON.stringify(error.response?.data, null, 2));
  }
}

const sportKey = process.argv[2] || 'basketball_nba';
debugMarketSupport(sportKey).catch(console.error);