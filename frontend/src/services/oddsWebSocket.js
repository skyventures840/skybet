/**
 * Odds WebSocket Service
 * Handles real-time odds updates without affecting cached match data
 */

class OddsWebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.isConnected = false;
    this.subscribers = new Map();
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    try {
      // Use environment variable for WebSocket URL, fallback to localhost
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:10000/ws/odds';
      
      console.log('[ODDS WS] Connecting to:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      console.error('[ODDS WS] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket connection open
   */
  handleOpen() {
    console.log('[ODDS WS] Connected successfully');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Notify subscribers of connection
    this.notifySubscribers('connection', { status: 'connected' });
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Handle different message types
      switch (data.type) {
        case 'odds_update':
          this.handleOddsUpdate(data);
          break;
        case 'match_status':
          this.handleMatchStatus(data);
          break;
        case 'heartbeat':
          this.handleHeartbeat();
          break;
        default:
          console.log('[ODDS WS] Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('[ODDS WS] Error parsing message:', error);
    }
  }

  /**
   * Handle odds updates
   */
  handleOddsUpdate(data) {
    const { matchId, odds, timestamp } = data;
    
    console.log(`[ODDS WS] Odds update for match ${matchId}:`, odds);
    
    // Notify all subscribers about odds update
    this.notifySubscribers('odds_update', {
      matchId,
      odds,
      timestamp
    });
  }

  /**
   * Handle match status updates
   */
  handleMatchStatus(data) {
    const { matchId, status, score } = data;
    
    console.log(`[ODDS WS] Status update for match ${matchId}:`, { status, score });
    
    // Notify subscribers about status update
    this.notifySubscribers('match_status', {
      matchId,
      status,
      score
    });
  }

  /**
   * Handle heartbeat response
   */
  handleHeartbeat() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Handle WebSocket connection close
   */
  handleClose(event) {
    console.log('[ODDS WS] Connection closed:', event.code, event.reason);
    this.isConnected = false;
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Notify subscribers of disconnection
    this.notifySubscribers('connection', { status: 'disconnected' });
    
    // Schedule reconnection if not a clean close
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket errors
   */
  handleError(error) {
    console.error('[ODDS WS] WebSocket error:', error);
    this.notifySubscribers('error', { error });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[ODDS WS] Max reconnection attempts reached');
      this.notifySubscribers('connection', { status: 'failed' });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[ODDS WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
        
        // Set timeout for heartbeat response
        this.heartbeatTimeout = setTimeout(() => {
          console.warn('[ODDS WS] Heartbeat timeout, closing connection');
          this.ws.close();
        }, 5000);
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    this.subscribers.get(eventType).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Notify all subscribers of an event
   */
  notifySubscribers(eventType, data) {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[ODDS WS] Error in subscriber callback for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.stopHeartbeat();
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriberCount: Array.from(this.subscribers.values())
        .reduce((total, callbacks) => total + callbacks.size, 0)
    };
  }

  /**
   * Send message to server (if needed for future features)
   */
  send(message) {
    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[ODDS WS] Cannot send message, not connected');
    }
  }
}

// Create singleton instance
const oddsWebSocket = new OddsWebSocketService();

export default oddsWebSocket;