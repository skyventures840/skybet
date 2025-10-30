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
      // Construct WebSocket URL with proper protocol and path
      let wsUrl;
      const envWsUrl = process.env.REACT_APP_WS_URL;
      
      if (envWsUrl) {
        // Production environment - convert HTTP(S) to WS(S) and add /ws path
        if (envWsUrl.startsWith('https://')) {
          wsUrl = envWsUrl.replace('https://', 'wss://');
        } else if (envWsUrl.startsWith('http://')) {
          wsUrl = envWsUrl.replace('http://', 'ws://');
        } else {
          wsUrl = envWsUrl;
        }
        
        // Ensure /ws path is added if not present
        if (!wsUrl.endsWith('/ws') && !wsUrl.includes('/ws')) {
          wsUrl = wsUrl.replace(/\/$/, '') + '/ws';
        }
      } else {
        // Development fallback
        wsUrl = 'ws://localhost:5000/ws';
      }
      
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
   * Handle connection close with improved reconnection logic
   */
  handleClose(event) {
    console.log('[ODDS WS] Connection closed:', event.code, event.reason);
    this.isConnected = false;
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Notify subscribers of disconnection
    this.notifySubscribers('connection', { status: 'disconnected' });
    
    // Clear any existing reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Don't reconnect if it was a clean close (code 1000) or authentication failure (code 1008)
    if (event.code === 1000 || event.code === 1008) {
      console.log('[ODDS WS] Connection closed cleanly or due to auth failure, not reconnecting');
      return;
    }
    
    // In production, be more conservative with reconnection attempts
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAttempts = isProduction ? 3 : 10; // Fewer attempts in production
    
    if (this.reconnectAttempts < maxAttempts) {
      this.scheduleReconnect();
    } else {
      console.error('[ODDS WS] Maximum reconnection attempts reached');
      if (isProduction) {
        console.error('[ODDS WS] Production WebSocket connection failed permanently. Please check:');
        console.error('1. Backend server status at:', process.env.REACT_APP_WS_URL);
        console.error('2. Network connectivity');
        console.error('3. Environment variable configuration');
      }
      this.notifySubscribers('connectionFailed', { 
        attempts: this.reconnectAttempts,
        lastError: event 
      });
    }
  }

  /**
   * Handle WebSocket errors with production-specific handling
   */
  handleError(error) {
    console.error('[ODDS WS] WebSocket error:', error);
    
    // In production, if we get connection errors, try to provide helpful feedback
    if (process.env.NODE_ENV === 'production') {
      console.warn('[ODDS WS] Production WebSocket connection failed. This may be due to:');
      console.warn('- Backend server not running or not deployed');
      console.warn('- Incorrect REACT_APP_WS_URL environment variable');
      console.warn('- Network connectivity issues');
      console.warn('- WebSocket endpoint not properly configured on backend');
    }
    
    this.isConnected = false;
    
    // Don't immediately reconnect on error, let the close handler manage reconnection
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
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'heartbeat' }));
          
          // Set timeout for heartbeat response
          this.heartbeatTimeout = setTimeout(() => {
            console.warn('[ODDS WS] Heartbeat timeout, closing connection');
            this.ws.close();
          }, 5000);
        } catch (error) {
          console.error('[ODDS WS] Error sending heartbeat:', error);
          this.ws.close();
        }
      } else if (this.ws && this.ws.readyState === WebSocket.CLOSED) {
        console.log('[ODDS WS] Connection closed during heartbeat, attempting reconnect');
        this.connect();
      }
    }, 20000); // Send heartbeat every 20 seconds (more frequent for hosting platforms)
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