/**
 * MongoDB Reconnect Watcher
 * Monitors and auto-recovers MongoDB connection
 */

const mongoose = require('mongoose');

class MongoWatcher {
  constructor(client) {
    this.client = client;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // Start at 5 seconds
    this.mongoWatchInterval = null;
  }

  /**
   * Start monitoring MongoDB connection
   */
  async start() {
    console.log('MongoWatcher: Starting MongoDB monitoring...');

    // Listen to mongoose events
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 5000;
      console.log('MongoWatcher: MongoDB connected ✓');
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      console.warn('MongoWatcher: MongoDB disconnected, attempting recovery...');
      this.attemptReconnect();
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoWatcher: MongoDB error:', err && (err.message || err));
      this.isConnected = false;
    });

    // Check connection health every 60 seconds
    this.mongoWatchInterval = setInterval(() => {
      this.checkConnection();
    }, 60000);

    // Initial check
    await this.checkConnection();
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.mongoWatchInterval) {
      clearInterval(this.mongoWatchInterval);
      this.mongoWatchInterval = null;
    }
    console.log('MongoWatcher: Monitoring stopped');
  }

  /**
   * Check current connection status
   */
  async checkConnection() {
    try {
      const readyState = mongoose.connection.readyState;
      // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting

      if (readyState !== 1) {
        this.isConnected = false;
        if (readyState === 0) {
          // 0 = disconnected, try to reconnect
          console.warn('MongoWatcher: Connection is disconnected, attempting reconnect...');
          await this.attemptReconnect();
        }
      } else {
        this.isConnected = true;
        this.reconnectAttempts = 0;
      }

      return this.isConnected;
    } catch (err) {
      console.error('MongoWatcher.checkConnection error:', err && (err.message || err));
      return false;
    }
  }

  /**
   * Attempt to reconnect to MongoDB
   */
  async attemptReconnect() {
    try {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('MongoWatcher: Max reconnection attempts reached, giving up');
        return false;
      }

      this.reconnectAttempts++;

      console.log(`MongoWatcher: Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      console.log(`MongoWatcher: Waiting ${this.reconnectDelay}ms before attempt...`);

      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

      // Try to force a connection
      if (mongoose.connection.readyState === 0) {
        const mongoUrl = process.env.MONGODB_URL || process.env.MONGOURI || this.client.config.mongourl;

        if (!mongoUrl || !mongoUrl.startsWith('mongodb')) {
          console.error('MongoWatcher: No valid MongoDB URL configured');
          return false;
        }

        try {
          await mongoose.connect(mongoUrl, {
            autoIndex: false,
            connectTimeoutMS: 30000,
            serverSelectionTimeoutMS: 30000,
            family: 4
          });

          console.log('MongoWatcher: Reconnection successful! ✓');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 5000;
          return true;
        } catch (connectErr) {
          console.error('MongoWatcher: Reconnect attempt failed:', connectErr && (connectErr.message || connectErr));

          // Exponential backoff: 5s, 10s, 20s, 40s, etc
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 300000); // Cap at 5 minutes

          return false;
        }
      }

      return this.isConnected;
    } catch (err) {
      console.error('MongoWatcher.attemptReconnect error:', err && (err.message || err));
      return false;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      readyState: mongoose.connection.readyState,
      reconnectAttempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      nextRetryIn: `${(this.reconnectDelay / 1000).toFixed(1)}s`
    };
  }
}

module.exports = MongoWatcher;
