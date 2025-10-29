require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { OddsApiService } = require('../services/oddsApiService');

// Initialize services
const oddsService = new OddsApiService();

async function checkMarketSupportImproved(sportKey) {
    console.log(`\n=== Improved Market Support Check for ${sportKey} ===\n`);
    
    try {
        // Step 1: Get current events for the sport
        console.log('1. Fetching current events...');
        const events = await oddsService.getUpcomingOdds(sportKey, 'h2h');
        
        if (!events || events.length === 0) {
            console.log(`❌ No events found for ${sportKey}. Sport may be out of season.`);
            return;
        }
        
        console.log(`✅ Found ${events.length} events for ${sportKey}`);
        
        // Step 2: Check markets endpoint for a sample event
        const sampleEvent = events[0];
        console.log(`\n2. Checking available markets for event: ${sampleEvent.home_team} vs ${sampleEvent.away_team}`);
        
        try {
            // Use the markets endpoint to see what markets are available
            const marketsResponse = await fetch(
                `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${sampleEvent.id}/markets?apiKey=${process.env.ODDS_API_KEY}&regions=us,uk,au,eu`
            );
            
            if (marketsResponse.ok) {
                const marketsData = await marketsResponse.json();
                console.log('📊 Available markets from API:');
                
                const allMarkets = new Set();
                marketsData.forEach(bookmaker => {
                    if (bookmaker.markets) {
                        bookmaker.markets.forEach(market => allMarkets.add(market));
                    }
                });
                
                console.log(`   Markets found: ${Array.from(allMarkets).join(', ')}`);
                
                // Step 3: Test specific additional markets based on sport type
                console.log('\n3. Testing specific additional markets...');
                await testSpecificMarkets(sportKey, sampleEvent.id);
                
            } else {
                console.log('⚠️  Markets endpoint not available, testing markets directly...');
                await testSpecificMarkets(sportKey, sampleEvent.id);
            }
            
        } catch (error) {
            console.log('⚠️  Error accessing markets endpoint, testing markets directly...');
            await testSpecificMarkets(sportKey, sampleEvent.id);
        }
        
        // Step 4: Provide sport-specific recommendations
        console.log('\n4. Sport-specific market recommendations:');
        provideSportRecommendations(sportKey);
        
    } catch (error) {
        console.error('❌ Error checking market support:', error.message);
    }
}

async function testSpecificMarkets(sportKey, eventId) {
    // Define markets to test based on sport category
    const marketsByCategory = {
        us_sports: ['alternate_spreads', 'alternate_totals', 'team_totals', 'h2h_q1', 'h2h_h1', 'spreads_q1', 'spreads_h1'],
        soccer: ['btts', 'draw_no_bet', 'h2h_3_way'],
        hockey: ['h2h_p1', 'h2h_p2', 'h2h_p3', 'spreads_p1'],
        baseball: ['h2h_1st_5_innings', 'spreads_1st_5_innings', 'alternate_spreads_1st_5_innings']
    };
    
    let marketsToTest = [];
    
    // Determine which markets to test based on sport
    if (sportKey.includes('americanfootball') || sportKey.includes('basketball')) {
        marketsToTest = marketsByCategory.us_sports;
    } else if (sportKey.includes('soccer')) {
        marketsToTest = marketsByCategory.soccer;
    } else if (sportKey.includes('hockey')) {
        marketsToTest = [...marketsByCategory.us_sports, ...marketsByCategory.hockey];
    } else if (sportKey.includes('baseball')) {
        marketsToTest = [...marketsByCategory.us_sports, ...marketsByCategory.baseball];
    } else {
        marketsToTest = ['alternate_spreads', 'alternate_totals']; // Basic additional markets
    }
    
    console.log(`   Testing markets: ${marketsToTest.join(', ')}`);
    
    const supportedMarkets = [];
    const unsupportedMarkets = [];
    
    for (const market of marketsToTest) {
        try {
            const response = await fetch(
                `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${eventId}/odds?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=${market}`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.bookmakers && data.bookmakers.length > 0) {
                    const hasMarketData = data.bookmakers.some(bookmaker => 
                        bookmaker.markets && bookmaker.markets.some(m => m.key === market)
                    );
                    
                    if (hasMarketData) {
                        supportedMarkets.push(market);
                        console.log(`   ✅ ${market}: SUPPORTED`);
                    } else {
                        unsupportedMarkets.push(market);
                        console.log(`   ❌ ${market}: No data available`);
                    }
                } else {
                    unsupportedMarkets.push(market);
                    console.log(`   ❌ ${market}: No bookmakers`);
                }
            } else {
                unsupportedMarkets.push(market);
                console.log(`   ❌ ${market}: API error (${response.status})`);
            }
            
            // Rate limiting - small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            unsupportedMarkets.push(market);
            console.log(`   ❌ ${market}: Error - ${error.message}`);
        }
    }
    
    console.log(`\n📈 Summary: ${supportedMarkets.length} supported, ${unsupportedMarkets.length} unsupported`);
    if (supportedMarkets.length > 0) {
        console.log(`✅ Supported: ${supportedMarkets.join(', ')}`);
    }
}

function provideSportRecommendations(sportKey) {
    if (sportKey.includes('soccer')) {
        console.log(`
🔍 Soccer Market Insights:
   • Player props available for: EPL, Ligue 1, Bundesliga, Serie A, La Liga, MLS
   • Coverage limited to US bookmakers
   • Soccer-specific markets: btts, draw_no_bet, h2h_3_way
   • Most additional markets (alternate_spreads, etc.) not available for soccer
        `);
    } else if (sportKey.includes('americanfootball') || sportKey.includes('basketball')) {
        console.log(`
🔍 US Sports Market Insights:
   • Best coverage for additional markets
   • Alternate spreads/totals widely available
   • Quarter/half markets supported
   • Player props available from select bookmakers
        `);
    } else if (sportKey.includes('hockey')) {
        console.log(`
🔍 Hockey Market Insights:
   • Period markets (p1, p2, p3) available
   • Limited additional market coverage
   • Mainly US bookmakers for additional markets
        `);
    } else if (sportKey.includes('baseball')) {
        console.log(`
🔍 Baseball Market Insights:
   • Innings markets available (1st 5 innings, etc.)
   • Good coverage for alternate markets
   • Player props available from select bookmakers
        `);
    } else {
        console.log(`
🔍 General Market Insights:
   • Additional markets mainly available for US sports
   • Coverage expanding over time
   • Featured markets (h2h, spreads, totals) most reliable
        `);
    }
}

// Main execution
async function main() {
    const sportKey = process.argv[2];
    
    if (!sportKey) {
        console.log('Usage: node improvedMarketChecker.js <sport_key>');
        console.log('Examples:');
        console.log('  node improvedMarketChecker.js soccer_epl');
        console.log('  node improvedMarketChecker.js americanfootball_nfl');
        console.log('  node improvedMarketChecker.js basketball_nba');
        process.exit(1);
    }
    
    if (!process.env.ODDS_API_KEY) {
        console.error('❌ ODDS_API_KEY environment variable not set');
        process.exit(1);
    }
    
    await checkMarketSupportImproved(sportKey);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { checkMarketSupportImproved };