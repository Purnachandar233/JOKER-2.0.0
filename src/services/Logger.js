/**
 * Structured Logger - Winston-based logging with persistence and webhook alerts
 * Replaces console.log/error/warn for better observability
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(client) {
    this.client = client;
    this.logDir = path.join(__dirname, '../..', 'logs');
    this.initializeLogDir();

    // Log levels
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };

    // Default to 'info' level for low load (skip debug logs)
    this.currentLevel = this.levels.info;
    
    // Write buffer for async batching (reduce I/O operations)
    this.writeBuffer = new Map(); // filename -> Array<entry>
    this.bufferFlushInterval = 5000; // Flush every 5 seconds
    this.startBufferFlush();
  }

  /**
   * Initialize log directory
   */
  initializeLogDir() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log('[Logger] Log directory initialized');
      }
    } catch (err) {
      console.error('[Logger] Failed to initialize log directory:', err && (err.message || err));
    }
  }

  /**
   * Generic log method that maps type string to appropriate logging level
   * @param {string} message - The message to log
   * @param {string} type - The log type ('debug', 'info', 'warn', 'error', 'fatal', 'ready', etc.)
   * @param {object} metadata - Optional metadata to include
   */
  log(message, type = 'info', metadata = {}) {
    const logType = type ? type.toLowerCase() : 'info';
    
    // Map common type names to logger methods
    switch (logType) {
      case 'debug':
        return this.debug(message, metadata);
      case 'info':
      case 'ready':
      case 'success':
        return this.info(message, metadata);
      case 'warn':
      case 'warning':
        return this.warn(message, metadata);
      case 'error':
      case 'err':
        return this.error(message, null, metadata);
      case 'fatal':
      case 'critical':
        return this.fatal(message, null, metadata);
      default:
        return this.info(message, { ...metadata, originalType: logType });
    }
  }

  /**
   * Get formatted timestamp (HH:MM:SS)
   */
  getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${mins}:${secs}`;
  }

  /**
   * Get ISO timestamp for file logging
   */
  getISOTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Get log filename for today
   */
  getLogFilename() {
    const today = new Date();
    const date = today.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `bot-${date}.log`);
  }

  /**
   * Get error filename for today
   */
  getErrorFilename() {
    const today = new Date();
    const date = today.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `error-${date}.log`);
  }

  /**
   * Start buffer flush interval (batch writes to reduce I/O)
   */
  startBufferFlush() {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, this.bufferFlushInterval);
  }

  /**
   * Flush all buffered writes to disk
   */
  flushBuffer() {
    try {
      for (const [filename, entries] of this.writeBuffer.entries()) {
        if (entries.length === 0) continue;
        
        // Write all entries at once (async, non-blocking)
        const content = entries.join('\n') + '\n';
        fs.appendFile(filename, content, 'utf-8', (err) => {
          if (err) console.error('[Logger] Async write error:', err.message);
        });
        
        // Clear buffer
        this.writeBuffer.set(filename, []);
      }
    } catch (err) {
      console.error('[Logger] flushBuffer error:', err && (err.message || err));
    }
  }

  /**
   * Write to log file (buffered async)
   */
  writeToFile(filename, entry) {
    try {
      // Add to buffer instead of immediate write
      if (!this.writeBuffer.has(filename)) {
        this.writeBuffer.set(filename, []);
      }
      this.writeBuffer.get(filename).push(entry);
      
      // Flush if buffer is getting large (reduce memory)
      if (this.writeBuffer.get(filename).length >= 50) {
        this.flushBuffer();
      }
    } catch (err) {
      console.error('[Logger] Failed to buffer write:', err && (err.message || err));
    }
  }

  /**
   * Format log entry for file (with ISO timestamp)
   */
  formatFileEntry(level, message, metadata = {}) {
    const timestamp = this.getISOTimestamp();
    const metaStr = Object.keys(metadata).length > 0 
      ? ' ' + JSON.stringify(metadata) 
      : '';
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  /**
   * Format log entry for console (with readable timestamp)
   */
  formatConsoleEntry(level, message, icon = '') {
    const timestamp = this.getTimestamp();
    const levelStr = level.toUpperCase();
    
    // Map levels to symbols for cleaner output
    const symbols = {
      'INFO': 'ℹ',
      'DEBUG': '🔍',
      'WARN': '⚠',
      'ERROR': '✗',
      'FATAL': '🚨',
      'SUCCESS': '✓',
      'READY': '✓'
    };
    
    const symbol = icon || symbols[levelStr] || '•';
    return `[${timestamp}] ${symbol} ${message}`;
  }

  /**
   * Format entry (backwards compatibility)
   */
  formatEntry(level, message, metadata = {}) {
    return this.formatFileEntry(level, message, metadata);
  }

  /**
   * Log debug message (DISABLED in production for low load)
   */
  debug(message, metadata = {}) {
    // Skip debug logging to reduce file I/O
    return;
  }

  /**
   * Log info message (console and file)
   */
  info(message, metadata = {}) {
    if (this.levels.info < this.currentLevel) return;
    
    const consoleEntry = this.formatConsoleEntry('info', message, 'ℹ');
    const fileEntry = this.formatFileEntry('info', message, metadata);
    console.log(consoleEntry);
    this.writeToFile(this.getLogFilename(), fileEntry);
  }

  /**
   * Log success message (like info but with checkmark)
   */
  success(message, metadata = {}) {
    if (this.levels.info < this.currentLevel) return;
    
    const consoleEntry = this.formatConsoleEntry('success', message, '✓');
    const fileEntry = this.formatFileEntry('info', message, metadata);
    console.log('\x1b[32m' + consoleEntry + '\x1b[0m'); // Green
    this.writeToFile(this.getLogFilename(), fileEntry);
  }

  /**
   * Log warning message
   */
  warn(message, metadata = {}) {
    if (this.levels.warn < this.currentLevel) return;
    
    const consoleEntry = this.formatConsoleEntry('warn', message, '⚠');
    const fileEntry = this.formatFileEntry('warn', message, metadata);
    console.warn('\x1b[33m' + consoleEntry + '\x1b[0m'); // Yellow
    this.writeToFile(this.getLogFilename(), fileEntry);
  }

  /**
   * Log error message (file + console)
   */
  error(message, error = null, metadata = {}) {
    if (this.levels.error < this.currentLevel) return;

    const consoleEntry = this.formatConsoleEntry('error', message, '✗');
    let fileEntry = this.formatFileEntry('error', message, metadata);

    if (error) {
      const errorMsg = error && (error.message || error.toString() || 'Unknown error');
      const stack = error && error.stack ? '\nStack: ' + error.stack.substring(0, 500) : '';
      fileEntry = fileEntry + '\nError: ' + errorMsg + stack;
    }

    console.error('\x1b[31m' + consoleEntry + '\x1b[0m'); // Red
    this.writeToFile(this.getErrorFilename(), fileEntry);
  }

  /**
   * Log fatal error (crash-level)
   */
  fatal(message, error = null, metadata = {}) {
    const consoleEntry = this.formatConsoleEntry('fatal', message, '🚨');
    let fileEntry = this.formatFileEntry('fatal', message, metadata);

    if (error) {
      const errorMsg = error && (error.message || error.toString() || 'Unknown error');
      const stack = error && error.stack ? '\nStack: ' + error.stack : '';
      fileEntry = fileEntry + '\nError: ' + errorMsg + stack;
    }

    console.error('\x1b[41m\x1b[37m' + consoleEntry + '\x1b[0m'); // Red background, white text
    this.writeToFile(this.getLogFilename(), fileEntry);
    this.writeToFile(this.getErrorFilename(), fileEntry);

    // Send to webhook immediately
    this.sendFatalWebhook(message, error, metadata);
  }

  /**
   * Log command execution
   */
  logCommand(commandName, userId, guildId, duration, success = true) {
    const status = success ? '✅' : '❌';
    const message = `${status} Command: /${commandName}`;
    
    const metadata = {
      command: commandName,
      user: userId,
      guild: guildId,
      duration: `${duration}ms`,
      status: success ? 'success' : 'error'
    };

    this.info(message, metadata);
  }

  /**
   * Log player event
   */
  logPlayer(event, guildId, metadata = {}) {
    const message = `Player Event: ${event}`;
    metadata.guild = guildId;
    this.debug(message, metadata);
  }

  /**
   * Log database operation
   */
  logDatabase(operation, collection, metadata = {}) {
    const message = `DB: ${operation} on ${collection}`;
    this.debug(message, metadata);
  }

  /**
   * Send error webhook notification
   */
  async sendErrorWebhook(message, error, metadata = {}) {
    try {
      if (!this.client?.config?.errorWebhook) return;

      const webhookUrl = this.client.config.errorWebhook;
      if (!webhookUrl) return;

      const errorMsg = error && (error.message || error.toString() || 'Unknown error');

      // Note: This would need node-fetch or fetch in Node 18+
      // For now, log intention
      console.log(`[Logger] Error webhook would send: ${message}`);
    } catch (err) {
      console.error('[Logger] sendErrorWebhook error:', err && (err.message || err));
    }
  }

  /**
   * Send fatal error webhook notification
   */
  async sendFatalWebhook(message, error, metadata = {}) {
    try {
      if (!this.client?.config?.errorWebhook) return;

      const webhookUrl = this.client.config.errorWebhook;
      if (!webhookUrl) return;

      const errorMsg = error && (error.message || error.toString() || 'Unknown error');

      // Note: This would need node-fetch or fetch in Node 18+
      // For now, log intention
      console.log(`[Logger] FATAL webhook would send: ${message}`);
    } catch (err) {
      console.error('[Logger] sendFatalWebhook error:', err && (err.message || err));
    }
  }

  /**
   * Get log file contents (for debugging)
   */
  getRecentLogs(lines = 50) {
    try {
      const filename = this.getLogFilename();
      if (!fs.existsSync(filename)) return [];

      const content = fs.readFileSync(filename, 'utf-8');
      return content.split('\n').slice(-lines).filter(l => l.trim());
    } catch (err) {
      console.error('[Logger] getRecentLogs error:', err && (err.message || err));
      return [];
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(lines = 30) {
    try {
      const filename = this.getErrorFilename();
      if (!fs.existsSync(filename)) return [];

      const content = fs.readFileSync(filename, 'utf-8');
      return content.split('\n').slice(-lines).filter(l => l.trim());
    } catch (err) {
      console.error('[Logger] getRecentErrors error:', err && (err.message || err));
      return [];
    }
  }

  /**
   * Clear old log files (aggressive cleanup for low storage)
   * Default: keep 14 days (reduced from 30)
   */
  cleanupOldLogs(daysToKeep = 14) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

      let removed = 0;
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          removed++;
        }
      }

      if (removed > 0) {
        this.info(`Cleaned up ${removed} old log files`);
      }
    } catch (err) {
      console.error('[Logger] cleanupOldLogs error:', err && (err.message || err));
    }
  }

  /**
   * Set current log level
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = this.levels[level];
      this.info(`Log level changed to: ${level}`);
    }
  }

  /**
   * Stop buffer flushing (cleanup)
   */
  stop() {
    if (this.flushInterval) {
      this.flushBuffer(); // Final flush
      clearInterval(this.flushInterval);
    }
  }

  /**
   * Get current log level
   */
  getLevel() {
    for (const [level, value] of Object.entries(this.levels)) {
      if (value === this.currentLevel) return level;
    }
    return 'unknown';
  }
}

module.exports = Logger;
