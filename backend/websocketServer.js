const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const MultiBet = require('./models/MultiBet');
const Match = require('./models/Match');
const Odds = require('./models/Odds');
const mongoose = require('mongoose');

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws'
    });
    this.clients = new Map(); // Map client connections to user info
    this.userSubscriptions = new Map(); // Map user IDs to their subscriptions
    this.liveMatchesSubscribers = new Set(); // Set of clients subscribed to live matches
    
    this.setupWebSocketServer();
    this.initializeChangeStreams();
  }
  
  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
    
    console.log('WebSocket server started');
  }
  
  // Initialize MongoDB change streams for real-time updates
  initializeChangeStreams() {
    // Determine if change streams should be enabled
    const mongoUri = process.env.MONGODB_URI || '';
    const enableFlag = (process.env.ENABLE_CHANGE_STREAMS || '').toLowerCase() === 'true';
    const uriSuggestsReplica = mongoUri.includes('replicaSet=') || mongoUri.startsWith('mongodb+srv');
    const shouldEnable = enableFlag || uriSuggestsReplica;

    if (!shouldEnable) {
      console.warn('MongoDB change streams disabled: non-replica setup or flag not enabled');
      return;
    }

    // Odds change stream: push odds_change to relevant subscribers
    try {
      this.oddsChangeStream = Odds.watch([], { fullDocument: 'updateLookup' });
      this.oddsChangeStream.on('change', async (change) => {
        const doc = change.fullDocument;
        if (!doc) return;
        try {
          const homeTeam = doc.home_team;
          const awayTeam = doc.away_team;
          const bookmakers = doc.bookmakers || [];

          // Find the corresponding live match by team names
          const match = await Match.findOne({ homeTeam, awayTeam, status: 'live' });
          if (!match) return;

          const newOdds = this.extractBasicOddsFromBookmakers(bookmakers, homeTeam, awayTeam);
          if (newOdds && Object.keys(newOdds).length > 0) {
            // Send odds change to match subscribers and live matches subscribers
            this.broadcastOddsChange(match._id.toString(), newOdds);
          }
        } catch (err) {
          console.error('Error processing odds change stream:', err);
        }
      });
      // Handle change stream errors gracefully
      this.oddsChangeStream.on('error', (err) => {
        console.warn('Odds change stream error:', err && err.message ? err.message : err);
      });
      console.log('Initialized Odds change stream');
    } catch (err) {
      console.warn('Odds change stream unavailable (is MongoDB a replica set?):', err && err.message ? err.message : err);
    }

    // Match change stream: push live list and results in near-real-time
    try {
      this.matchChangeStream = Match.watch([], { fullDocument: 'updateLookup' });
      this.matchChangeStream.on('change', async (change) => {
        const doc = change.fullDocument;
        if (!doc) return;
        try {
          const op = change.operationType;
          const updatedFields = change.updateDescription && change.updateDescription.updatedFields ? change.updateDescription.updatedFields : {};

          // Broadcast result updates when scores change
          const scoreChanged = 'homeScore' in updatedFields || 'awayScore' in updatedFields;
          if (scoreChanged || op === 'insert') {
            if (doc.homeScore !== null && doc.awayScore !== null) {
              this.broadcastMatchResult(doc._id.toString(), {
                homeScore: doc.homeScore,
                awayScore: doc.awayScore,
                score: `${doc.homeScore}-${doc.awayScore}`,
              });
            }
          }

          // Keep live matches list fresh for inserts or status transitions
          const statusChanged = 'status' in updatedFields;
          if (op === 'insert' || statusChanged || scoreChanged) {
            await this.broadcastLiveMatchesUpdate();
          }
        } catch (err) {
          console.error('Error processing match change stream:', err);
        }
      });
      this.matchChangeStream.on('error', (err) => {
        console.warn('Match change stream error:', err && err.message ? err.message : err);
      });
      console.log('Initialized Match change stream');
    } catch (err) {
      console.warn('Match change stream unavailable (is MongoDB a replica set?):', err && err.message ? err.message : err);
    }
  }

  // Extract basic 1X2 odds from bookmakers list
  extractBasicOddsFromBookmakers(bookmakers, homeTeam, awayTeam) {
    try {
      if (!Array.isArray(bookmakers) || bookmakers.length === 0) return null;
      const bm = bookmakers.find(b => Array.isArray(b.markets) && b.markets.length > 0);
      if (!bm) return null;
      const markets = bm.markets || [];
      const odds = {};
      // Prefer H2H, fallback to spreads and totals
      const h2hMarket = markets.find(m => m.key === 'h2h');
      if (h2hMarket && Array.isArray(h2hMarket.outcomes)) {
        h2hMarket.outcomes.forEach(outcome => {
          if (outcome.name === homeTeam) odds['1'] = outcome.price;
          else if (outcome.name === awayTeam) odds['2'] = outcome.price;
          else if (outcome.name === 'Draw') odds['X'] = outcome.price;
        });
      }
      const spreadsMarket = markets.find(m => m.key === 'spreads');
      if (spreadsMarket && Array.isArray(spreadsMarket.outcomes)) {
        const home = spreadsMarket.outcomes.find(o => o.name === homeTeam);
        const away = spreadsMarket.outcomes.find(o => o.name === awayTeam);
        const line = home?.point ?? away?.point;
        if (line != null) odds['handicapLine'] = line;
        if (typeof home?.price === 'number') odds['homeHandicap'] = home.price;
        if (typeof away?.price === 'number') odds['awayHandicap'] = away.price;
      }
      const totalsMarket = markets.find(m => m.key === 'totals');
      if (totalsMarket && Array.isArray(totalsMarket.outcomes)) {
        const over = totalsMarket.outcomes.find(o => /over/i.test(o.name));
        const under = totalsMarket.outcomes.find(o => /under/i.test(o.name));
        const total = over?.point ?? under?.point;
        if (total != null) odds['Total'] = total;
        if (typeof over?.price === 'number') odds['TM'] = over.price;
        if (typeof under?.price === 'number') odds['TU'] = under.price;
      }
      return Object.keys(odds).length > 0 ? odds : null;
    } catch (err) {
      console.error('Error extracting basic odds:', err);
      return null;
    }
  }
  
  handleConnection(ws, req) {
    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(1008, 'Authentication token required');
      return;
    }
    
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      // Store client connection
      this.clients.set(ws, {
        userId,
        ws,
        connectedAt: new Date(),
        subscriptions: new Set()
      });
      
      console.log(`WebSocket client connected for user: ${userId}`);
      
      // Send connection confirmation
      this.sendToClient(ws, {
        type: 'connected',
        payload: { userId, timestamp: new Date().toISOString() }
      });
      
      // Setup message handler
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.sendToClient(ws, {
            type: 'error',
            payload: { message: 'Invalid message format' }
          });
        }
      });
      
      // Setup close handler
      ws.on('close', (code, reason) => {
        this.handleDisconnection(ws, code, reason);
      });
      
      // Setup error handler
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnection(ws, 1011, 'Internal error');
      });
      
      // Setup ping/pong for connection health
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      ws.close(1008, 'Invalid authentication token');
    }
  }
  
  handleMessage(ws, message) {
    const { type, payload } = message;
    const client = this.clients.get(ws);
    
    if (!client) {
      return;
    }
    
    switch (type) {
      case 'ping':
        this.sendToClient(ws, { type: 'pong' });
        break;
        
      case 'subscribe_match':
        this.subscribeToMatch(ws, payload.matchId);
        break;
        
      case 'unsubscribe_match':
        this.unsubscribeFromMatch(ws, payload.matchId);
        break;
        
      case 'subscribe_user_bets':
        this.subscribeToUserBets(ws, client.userId);
        break;
        
      case 'unsubscribe_user_bets':
        this.unsubscribeFromUserBets(ws, client.userId);
        break;
        
      case 'subscribe_live_matches':
        this.subscribeToLiveMatches(ws);
        break;
        
      case 'unsubscribe_live_matches':
        this.unsubscribeFromLiveMatches(ws);
        break;
        
      case 'request_bet_status':
        this.handleBetStatusRequest(ws, payload.betId, client.userId);
        break;
        
      case 'request_live_matches':
        this.handleLiveMatchesRequest(ws);
        break;
        
      default:
        console.log('Unknown WebSocket message type:', type);
        this.sendToClient(ws, {
          type: 'error',
          payload: { message: 'Unknown message type' }
        });
    }
  }
  
  subscribeToMatch(ws, matchId) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    client.subscriptions.add(`match:${matchId}`);
    
    // Store subscription for broadcasting
    if (!this.userSubscriptions.has(client.userId)) {
      this.userSubscriptions.set(client.userId, new Set());
    }
    this.userSubscriptions.get(client.userId).add(`match:${matchId}`);
    
    console.log(`User ${client.userId} subscribed to match ${matchId}`);
    
    this.sendToClient(ws, {
      type: 'subscription_confirmed',
      payload: { matchId, subscribed: true }
    });
  }
  
  unsubscribeFromMatch(ws, matchId) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    client.subscriptions.delete(`match:${matchId}`);
    
    // Remove from global subscriptions
    if (this.userSubscriptions.has(client.userId)) {
      this.userSubscriptions.get(client.userId).delete(`match:${matchId}`);
    }
    
    console.log(`User ${client.userId} unsubscribed from match ${matchId}`);
    
    this.sendToClient(ws, {
      type: 'subscription_confirmed',
      payload: { matchId, subscribed: false }
    });
  }
  
  subscribeToLiveMatches(ws) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    client.subscriptions.add('live_matches');
    this.liveMatchesSubscribers.add(ws);
    
    console.log(`User ${client.userId} subscribed to live matches`);
    
    this.sendToClient(ws, {
      type: 'subscription_confirmed',
      payload: { liveMatches: true, subscribed: true }
    });
    
    // Send current live matches immediately
    this.handleLiveMatchesRequest(ws);
  }
  
  unsubscribeFromLiveMatches(ws) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    client.subscriptions.delete('live_matches');
    this.liveMatchesSubscribers.delete(ws);
    
    console.log(`User ${client.userId} unsubscribed from live matches`);
    
    this.sendToClient(ws, {
      type: 'subscription_confirmed',
      payload: { liveMatches: true, subscribed: false }
    });
  }
  
  subscribeToUserBets(ws, userId) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    client.subscriptions.add(`user_bets:${userId}`);
    
    if (!this.userSubscriptions.has(userId)) {
      this.userSubscriptions.set(userId, new Set());
    }
    this.userSubscriptions.get(userId).add(`user_bets:${userId}`);
    
    console.log(`User ${userId} subscribed to their bets`);
    
    this.sendToClient(ws, {
      type: 'subscription_confirmed',
      payload: { userBets: true, subscribed: true }
    });
  }
  
  unsubscribeFromUserBets(ws, userId) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    client.subscriptions.delete(`user_bets:${userId}`);
    
    if (this.userSubscriptions.has(userId)) {
      this.userSubscriptions.get(userId).delete(`user_bets:${userId}`);
    }
    
    console.log(`User ${userId} unsubscribed from their bets`);
    
    this.sendToClient(ws, {
      type: 'subscription_confirmed',
      payload: { userBets: true, subscribed: false }
    });
  }
  
  async handleBetStatusRequest(ws, betId, userId) {
    try {
      const multiBet = await MultiBet.findOne({
        _id: betId,
        userId: userId
      });
      
      if (multiBet) {
        this.sendToClient(ws, {
          type: 'bet_status_response',
          payload: {
            betId,
            status: multiBet.status,
            matches: multiBet.matches.map(match => ({
              matchId: match.matchId,
              status: match.status,
              result: match.result
            }))
          }
        });
      } else {
        this.sendToClient(ws, {
          type: 'error',
          payload: { message: 'Bet not found' }
        });
      }
    } catch (error) {
      console.error('Error handling bet status request:', error);
      this.sendToClient(ws, {
        type: 'error',
        payload: { message: 'Error retrieving bet status' }
      });
    }
  }
  
  async handleLiveMatchesRequest(ws) {
    try {
      // Get live matches from database
      const liveMatches = await Match.find({ status: 'live' })
        .sort({ startTime: 1 });
      
      // Get live odds data
      const liveOddsData = await Odds.find({
        commence_time: { $lte: new Date() }
      }).sort({ commence_time: -1 });
      
      // Transform matches to include live data
      const transformedLiveMatches = liveMatches.map(match => {
        const matchObj = match.toObject();
        
        // Find corresponding odds
        const matchOdds = liveOddsData.find(odds => 
          odds.home_team === match.homeTeam && 
          odds.away_team === match.awayTeam
        );
        
        let oddsStructure = {};
        if (matchOdds && matchOdds.bookmakers && matchOdds.bookmakers.length > 0) {
          const firstBookmaker = matchOdds.bookmakers[0];
          oddsStructure = {
            default: {
              bookmaker: firstBookmaker.title,
              odds: {}
            }
          };

          firstBookmaker.markets.forEach(market => {
            if (market.key === 'h2h' && Array.isArray(market.outcomes)) {
              market.outcomes.forEach(outcome => {
                if (outcome.name === matchObj.homeTeam) oddsStructure.default.odds['1'] = outcome.price;
                else if (outcome.name === matchObj.awayTeam) oddsStructure.default.odds['2'] = outcome.price;
                else if (outcome.name === 'Draw') oddsStructure.default.odds['X'] = outcome.price;
              });
            } else if (market.key === 'spreads' && Array.isArray(market.outcomes)) {
              const home = market.outcomes.find(o => o.name === matchObj.homeTeam);
              const away = market.outcomes.find(o => o.name === matchObj.awayTeam);
              const line = home?.point ?? away?.point;
              if (line != null) oddsStructure.default.odds['handicapLine'] = line;
              if (typeof home?.price === 'number') oddsStructure.default.odds['homeHandicap'] = home.price;
              if (typeof away?.price === 'number') oddsStructure.default.odds['awayHandicap'] = away.price;
            } else if (market.key === 'totals' && Array.isArray(market.outcomes)) {
              const over = market.outcomes.find(o => /over/i.test(o.name));
              const under = market.outcomes.find(o => /under/i.test(o.name));
              const total = over?.point ?? under?.point;
              if (total != null) oddsStructure.default.odds['Total'] = total;
              if (typeof over?.price === 'number') oddsStructure.default.odds['TM'] = over.price;
              if (typeof under?.price === 'number') oddsStructure.default.odds['TU'] = under.price;
            }
          });
        }
        
        return {
          id: matchObj._id,
          league: matchObj.leagueId || 'Live Match',
          subcategory: matchObj.sport || 'Live',
          startTime: matchObj.startTime,
          homeTeam: matchObj.homeTeam,
          awayTeam: matchObj.awayTeam,
          homeTeamFlag: '🏳️',
          awayTeamFlag: '🏳️',
          odds: oddsStructure.default?.odds || matchObj.odds || {},
          additionalMarkets: (matchObj.markets || []).length,
          sport: matchObj.sport ? matchObj.sport.split('_')[0] : 'Live',
          allMarkets: matchObj.markets || [],
          status: 'live',
          isLive: true,
          liveTime: this.calculateLiveTime(matchObj.startTime),
          score: matchObj.homeScore !== null && matchObj.awayScore !== null 
            ? `${matchObj.homeScore}-${matchObj.awayScore}` 
            : null,
          homeScore: matchObj.homeScore,
          awayScore: matchObj.awayScore,
          lastUpdate: new Date().toISOString()
        };
      });
      
      this.sendToClient(ws, {
        type: 'live_matches_update',
        payload: {
          matches: transformedLiveMatches,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Error handling live matches request:', error);
      this.sendToClient(ws, {
        type: 'error',
        payload: { message: 'Error retrieving live matches' }
      });
    }
  }
  
  calculateLiveTime(startTime) {
    const now = new Date();
    const start = new Date(startTime);
    const diffMs = now - start;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 0) return 'LIVE';
    if (diffMins < 90) return `LIVE ${diffMins}'`;
    return 'LIVE';
  }
  
  handleDisconnection(ws, code, reason) {
    const client = this.clients.get(ws);
    if (client) {
      console.log(`WebSocket client disconnected for user: ${client.userId} (${code}: ${reason})`);
      
      // Clean up subscriptions
      if (this.userSubscriptions.has(client.userId)) {
        this.userSubscriptions.delete(client.userId);
      }
      
      // Remove from live matches subscribers
      this.liveMatchesSubscribers.delete(ws);
      
      this.clients.delete(ws);
    }
  }
  
  // Broadcast message to all clients subscribed to a specific match
  broadcastToMatch(matchId, message) {
    this.clients.forEach((client, ws) => {
      if (client.subscriptions.has(`match:${matchId}`)) {
        this.sendToClient(ws, message);
      }
    });
  }
  
  // Broadcast message to a specific user
  broadcastToUser(userId, message) {
    this.clients.forEach((client, ws) => {
      if (client.userId === userId) {
        this.sendToClient(ws, message);
      }
    });
  }
  
  // Broadcast message to all clients subscribed to user bets
  broadcastToUserBetsSubscribers(userId, message) {
    this.clients.forEach((client, ws) => {
      if (client.subscriptions.has(`user_bets:${userId}`)) {
        this.sendToClient(ws, message);
      }
    });
  }
  
  // Broadcast message to all clients subscribed to live matches
  broadcastToLiveMatchesSubscribers(message) {
    this.liveMatchesSubscribers.forEach(ws => {
      this.sendToClient(ws, message);
    });
  }
  
  // Broadcast message to all connected clients
  broadcastToAll(message) {
    this.clients.forEach((client, ws) => {
      this.sendToClient(ws, message);
    });
  }
  
  // Emit method for compatibility with Socket.IO style usage
  emit(event, data) {
    this.broadcastToAll({ type: event, data });
  }
  
  // Send message to a specific client
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message to client:', error);
      }
    }
  }
  
  // Broadcast match result update
  broadcastMatchResult(matchId, result) {
    const message = {
      type: 'match_result_update',
      payload: {
        matchId,
        result,
        timestamp: new Date().toISOString()
      }
    };
    
    this.broadcastToMatch(matchId, message);
  }
  
  // Broadcast bet status update
  broadcastBetStatusUpdate(betId, userId, status, matches) {
    const message = {
      type: 'bet_status_update',
      payload: {
        betId,
        userId,
        status,
        matches,
        timestamp: new Date().toISOString()
      }
    };
    
    // Send to the specific user
    this.broadcastToUser(userId, message);
    
    // Send to users subscribed to user bets
    this.broadcastToUserBetsSubscribers(userId, message);
  }
  
  // Broadcast odds change
  broadcastOddsChange(matchId, newOdds) {
    const message = {
      type: 'odds_change',
      payload: {
        matchId,
        newOdds,
        timestamp: new Date().toISOString()
      }
    };
    
    // Targeted match subscribers
    this.broadcastToMatch(matchId, message);
    // Also notify live matches subscribers to keep lists in sync
    this.broadcastToLiveMatchesSubscribers(message);
  }
  
  // Broadcast live matches update
  async broadcastLiveMatchesUpdate() {
    try {
      await this.handleLiveMatchesRequest({ 
        send: (data) => {
          const message = JSON.parse(data);
          this.broadcastToLiveMatchesSubscribers(message);
        }
      });
    } catch (error) {
      console.error('Error broadcasting live matches update:', error);
    }
  }
  
  // Get server statistics
  getStats() {
    return {
      totalClients: this.clients.size,
      totalSubscriptions: Array.from(this.userSubscriptions.values()).reduce((total, subs) => total + subs.size, 0),
      liveMatchesSubscribers: this.liveMatchesSubscribers.size,
      uptime: process.uptime()
    };
  }
  
  // Setup heartbeat to detect stale connections
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('Terminating stale WebSocket connection');
          return ws.terminate();
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch (error) {
          console.log('Error sending ping, terminating connection:', error.message);
          ws.terminate();
        }
      });
    }, 25000); // Check every 25 seconds (more frequent for hosting platforms)
  }
  
  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  // Graceful shutdown
  shutdown() {
    console.log('Shutting down WebSocket server...');
    
    this.stopHeartbeat();
    
    try {
      if (this.oddsChangeStream && typeof this.oddsChangeStream.close === 'function') {
        this.oddsChangeStream.close();
      }
      if (this.matchChangeStream && typeof this.matchChangeStream.close === 'function') {
        this.matchChangeStream.close();
      }
    } catch (err) {
      console.warn('Error closing change streams:', err);
    }
    
    this.wss.clients.forEach((ws) => {
      ws.close(1001, 'Server shutdown');
    });
    
    this.wss.close(() => {
      console.log('WebSocket server closed');
    });
  }
}

module.exports = WebSocketServer;
