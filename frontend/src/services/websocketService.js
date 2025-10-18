class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
  }
  
  // Connect to WebSocket server
  connect(token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    try {
      // Use environment variable for WebSocket URL, fallback to localhost for development
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000/ws';
      this.ws = new WebSocket(`${wsUrl}?token=${token}`);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnected = false;
        this.emit('disconnected', event);
        
        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
      
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.emit('error', error);
    }
  }
  
  // Schedule reconnection attempt
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling WebSocket reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const token = localStorage.getItem('token');
        if (token) {
          this.connect(token);
        }
      }
    }, delay);
  }
  
  // Handle incoming messages
  handleMessage(data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'bet_status_update':
        this.emit('betStatusUpdate', payload);
        break;
      case 'match_result_update':
        this.emit('matchResultUpdate', payload);
        break;
      case 'odds_change':
        this.emit('oddsChange', payload);
        break;
      case 'live_matches_update':
        this.emit('liveMatchesUpdate', payload);
        break;
      case 'pong':
        // Handle heartbeat response
        break;
      default:
        console.log('Unknown WebSocket message type:', type);
    }
  }
  
  // Send message to server
  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, payload });
      this.ws.send(message);
    } else {
      console.warn('WebSocket is not connected. Cannot send message:', type);
    }
  }
  
  // Subscribe to match updates
  subscribeToMatch(matchId) {
    this.send('subscribe_match', { matchId });
  }
  
  // Unsubscribe from match updates
  unsubscribeFromMatch(matchId) {
    this.send('unsubscribe_match', { matchId });
  }
  
  // Subscribe to user's bets
  subscribeToUserBets(userId) {
    this.send('subscribe_user_bets', { userId });
  }
  
  // Unsubscribe from user's bets
  unsubscribeFromUserBets(userId) {
    this.send('unsubscribe_user_bets', { userId });
  }
  
  // Subscribe to live matches
  subscribeToLiveMatches() {
    this.send('subscribe_live_matches');
  }
  
  // Unsubscribe from live matches
  unsubscribeFromLiveMatches() {
    this.send('unsubscribe_live_matches');
  }
  
  // Request live matches
  requestLiveMatches() {
    this.send('request_live_matches');
  }
  
  // Request bet status update
  requestBetStatus(betId) {
    this.send('request_bet_status', { betId });
  }
  
  // Start heartbeat to keep connection alive
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('ping');
      } else if (this.ws && this.ws.readyState === WebSocket.CLOSED) {
        console.log('[WS] Connection closed during heartbeat, attempting reconnect');
        this.reconnect();
      }
    }, 20000); // Send ping every 20 seconds (more frequent for hosting platforms)
  }
  
  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  // Add event listener
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  // Remove event listener
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  // Emit event to all listeners
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket event listener:', error);
        }
      });
    }
  }
  
  // Disconnect WebSocket
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect');
      this.ws = null;
    }
    this.isConnected = false;
    this.stopHeartbeat();
  }
  
  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws ? this.ws.readyState : null,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
