const axios = require('axios');
const fs = require('fs');
const path = require('path');
// Logger removed during cleanup - using console for now

// Configuration
const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const REGIONS = ['us', 'us2', 'uk', 'eu', 'au'];
const MARKETS = ['h2h', 'spreads', 'totals', 'outrights', 'player_props', 'game_props'];
const BOOKMAKERS = [
  'fanduel', 'draftkings', 'betmgm', 'caesars', 'pointsbetus',
  'unibet_us', 'ballybet', 'betrivers', 'superbook', 'foxbet',
  'williamhill_us', 'twinspires', 'betonlineag', 'lowvig', 'mybookieag'
];

class OddsFetcher {
  constructor() {
    this.client = axios.create({
      baseURL: ODDS_API_BASE_URL,
      timeout: 30000,
      params: {
        apiKey: ODDS_API_KEY,
        regions: REGIONS.join(','),
        oddsFormat: 'decimal',
        dateFormat: 'iso'
      }
    });
  }

  /**
   * Fetch all available sports
   */
  async getSports() {
    try {
      console.log('Fetching available sports...');
      const response = await this.client.get('/sports');
              console.log(`Found ${response.data.length} sports`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sports:', error.message);
      throw error;
    }
  }

  /**
   * Fetch all markets for a specific sport
   */
  async getMarketsForSport(sportKey) {
    try {
      const response = await this.client.get(`/sports/${sportKey}/markets`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        console.warn(`No markets found for sport ${sportKey}`);
        return [];
      }
      console.error(`Error fetching markets for ${sportKey}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch odds for a specific sport and market
   */
  async getOddsForMarket(sportKey, market, bookmakers = BOOKMAKERS) {
    try {
      const response = await this.client.get(`/sports/${sportKey}/odds`, {
        params: {
          markets: market,
          bookmakers: bookmakers.join(',')
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching odds for ${sportKey}/${market}:`, error.message);
      return [];
    }
  }

  /**
   * Merge odds data ensuring each market has only one bookmaker
   */
  mergeOddsData(allMatches) {
    const mergedMatches = {};

    const normalizeMarketKey = (key) => {
      const k = (key || '').toLowerCase();
      const noLay = k.replace(/_?lay$/i, '');
      if (noLay === 'h2h' || noLay === 'moneyline') return 'h2h';
      if (noLay === 'spreads' || noLay === 'handicap' || noLay === 'asian_handicap' || noLay === 'point_spread') return 'spreads';
      if (noLay === 'totals' || noLay === 'over_under' || noLay === 'points_total') return 'totals';
      if (noLay === 'double_chance') return 'double_chance';
      if (noLay === 'draw_no_bet') return 'draw_no_bet';
      if (noLay === 'both_teams_to_score' || noLay === 'btts') return 'both_teams_to_score';
      return noLay;
    };

    for (const match of allMatches) {
      const matchId = match.id;
      
      if (!mergedMatches[matchId]) {
        mergedMatches[matchId] = {
          ...match,
          bookmakers: []
        };
      }

      // Merge bookmakers for this match
      for (const bookmaker of match.bookmakers) {
        const existingBookmaker = mergedMatches[matchId].bookmakers.find(b => b.key === bookmaker.key);
        
        if (existingBookmaker) {
          // Merge markets for existing bookmaker
          for (const market of bookmaker.markets) {
            const normKey = normalizeMarketKey(market.key);
            const existingMarket = existingBookmaker.markets.find(m => normalizeMarketKey(m.key) === normKey);
            
            if (!existingMarket) {
              // Add new market to existing bookmaker
              existingBookmaker.markets.push({ ...market, key: normKey });
            } else {
              // Update existing market with better odds (lower price = better odds)
              for (const outcome of market.outcomes) {
                const existingOutcome = existingMarket.outcomes.find(o => o.name === outcome.name);
                if (!existingOutcome || outcome.price < existingOutcome.price) {
                  if (existingOutcome) {
                    existingOutcome.price = outcome.price;
                    existingOutcome.point = outcome.point;
                  } else {
                    existingMarket.outcomes.push(outcome);
                  }
                }
              }
            }
          }
        } else {
          // Add new bookmaker
          // Normalize market keys for the new bookmaker as well
          const normalizedBookmaker = {
            ...bookmaker,
            markets: (bookmaker.markets || []).map(m => ({ ...m, key: normalizeMarketKey(m.key) }))
          };
          mergedMatches[matchId].bookmakers.push(normalizedBookmaker);
        }
      }
    }

    return Object.values(mergedMatches);
  }

  /**
   * Fetch all odds for a sport with fallback bookmakers
   */
  async fetchAllOddsForSport(sportKey) {
    console.log(`Fetching all odds for sport: ${sportKey}`);
    
    // Get available markets for this sport
    const availableMarkets = await this.getMarketsForSport(sportKey);
    const marketsToFetch = availableMarkets.length > 0 
      ? availableMarkets.map(m => m.key)
      : MARKETS;

    console.log(`Markets to fetch for ${sportKey}: ${marketsToFetch.join(', ')}`);

    const allMatches = [];

    // Try each bookmaker group until we get data
    const bookmakerGroups = [
      ['fanduel', 'draftkings', 'betmgm'],
      ['caesars', 'pointsbetus', 'unibet_us'],
      ['ballybet', 'betrivers', 'superbook'],
      ['foxbet', 'williamhill_us', 'twinspires'],
      ['betonlineag', 'lowvig', 'mybookieag']
    ];

    for (const market of marketsToFetch) {
      let marketData = [];
      
      // Try each bookmaker group
      for (const bookmakerGroup of bookmakerGroups) {
        try {
          console.log(`Trying bookmakers ${bookmakerGroup.join(', ')} for ${sportKey}/${market}`);
          marketData = await this.getOddsForMarket(sportKey, market, bookmakerGroup);
          
          if (marketData.length > 0) {
            console.log(`Successfully fetched ${marketData.length} matches for ${sportKey}/${market} using ${bookmakerGroup.join(', ')}`);
            break;
          }
        } catch (error) {
          console.warn(`Failed to fetch ${sportKey}/${market} with ${bookmakerGroup.join(', ')}: ${error.message}`);
          continue;
        }
      }

      if (marketData.length > 0) {
        allMatches.push(...marketData);
      } else {
        console.warn(`No data found for ${sportKey}/${market} with any bookmaker group`);
      }

      // Rate limiting - wait between requests
      await this.sleep(1000);
    }

    // Merge all matches ensuring each market has only one bookmaker
    const mergedMatches = this.mergeOddsData(allMatches);
    
    console.log(`Merged ${mergedMatches.length} matches for ${sportKey}`);
    
    return mergedMatches;
  }

  /**
   * Save matches to JSON file
   */
  saveMatchesToFile(sportKey, matches) {
    const fileName = `${sportKey}_matches_${Date.now()}.json`;
    const filePath = path.join(__dirname, '..', fileName);
    
    const enrichedMatches = matches.map(match => ({
      ...match,
      sport_key: sportKey,
      fetched_at: new Date().toISOString()
    }));

    fs.writeFileSync(filePath, JSON.stringify(enrichedMatches, null, 2));
    console.log(`Saved ${enrichedMatches.length} matches for ${sportKey} to ${fileName}`);
    
    return filePath;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = OddsFetcher;