/**
 * Structured Logger - console + in-memory history only.
 * File-based logging is intentionally disabled.
 */

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (_err) {
    return "[unserializable-metadata]";
  }
}

function toSingleLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

class Logger {
  constructor(client) {
    this.client = client;

    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };

    // Default to info to keep noise low.
    this.currentLevel = this.levels.info;

    // Keep a small in-memory tail for diagnostics commands.
    this.maxHistory = toPositiveInt(process.env.LOG_HISTORY_LIMIT, 500);
    this.recentLogs = [];
    this.recentErrors = [];
  }

  log(message, type = "info", metadata = {}) {
    const logType = String(type || "info").toLowerCase();

    switch (logType) {
      case "debug":
        return this.debug(message, metadata);
      case "info":
      case "ready":
      case "success":
        return this.info(message, metadata);
      case "warn":
      case "warning":
        return this.warn(message, metadata);
      case "error":
      case "err":
        return this.error(
          message instanceof Error ? (message.message || String(message)) : message,
          message instanceof Error ? message : null,
          metadata
        );
      case "fatal":
      case "critical":
        return this.fatal(
          message instanceof Error ? (message.message || String(message)) : message,
          message instanceof Error ? message : null,
          metadata
        );
      default:
        return this.info(message, { ...metadata, originalType: logType });
    }
  }

  getTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const secs = String(now.getSeconds()).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  }

  getISOTimestamp() {
    return new Date().toISOString();
  }

  formatConsoleEntry(level, message) {
    const timestamp = this.getTimestamp();
    const levelLabel = String(level || "info").toUpperCase();
    return `[${timestamp}] [${levelLabel}] ${toSingleLine(message)}`;
  }

  formatEntry(level, message, metadata = {}) {
    const ts = this.getISOTimestamp();
    const meta = metadata && Object.keys(metadata).length > 0 ? ` ${safeStringify(metadata)}` : "";
    return `[${ts}] [${String(level || "info").toUpperCase()}] ${toSingleLine(message)}${meta}`;
  }

  pushHistory(bucket, entry) {
    bucket.push(entry);
    if (bucket.length > this.maxHistory) {
      bucket.splice(0, bucket.length - this.maxHistory);
    }
  }

  debug(_message, _metadata = {}) {
    // Intentionally disabled by default to reduce runtime overhead.
  }

  info(message, metadata = {}) {
    if (this.levels.info < this.currentLevel) return;

    const consoleEntry = this.formatConsoleEntry("info", message);
    console.log(consoleEntry);

    this.pushHistory(this.recentLogs, this.formatEntry("info", message, metadata));
  }

  success(message, metadata = {}) {
    if (this.levels.info < this.currentLevel) return;

    const consoleEntry = this.formatConsoleEntry("success", message);
    console.log(consoleEntry);

    this.pushHistory(this.recentLogs, this.formatEntry("info", message, metadata));
  }

  warn(message, metadata = {}) {
    if (this.levels.warn < this.currentLevel) return;

    const consoleEntry = this.formatConsoleEntry("warn", message);
    console.warn(consoleEntry);

    const entry = this.formatEntry("warn", message, metadata);
    this.pushHistory(this.recentLogs, entry);
    this.pushHistory(this.recentErrors, entry);
  }

  error(message, error = null, metadata = {}) {
    if (this.levels.error < this.currentLevel) return;

    const includeStack = String(process.env.LOG_STACKS || "false").toLowerCase() === "true";
    let printable = toSingleLine(message);
    if (error) {
      const errorMsg = toSingleLine(error.message || String(error));
      printable = `${printable} | error=${errorMsg}`;
      if (includeStack && error.stack) {
        printable = `${printable} | stack=${toSingleLine(error.stack).slice(0, 600)}`;
      }
    }

    const consoleEntry = this.formatConsoleEntry("error", printable);
    console.error(consoleEntry);

    const entry = this.formatEntry("error", printable, metadata);
    this.pushHistory(this.recentLogs, entry);
    this.pushHistory(this.recentErrors, entry);
  }

  fatal(message, error = null, metadata = {}) {
    const includeStack = String(process.env.LOG_STACKS || "false").toLowerCase() === "true";
    let printable = toSingleLine(message);
    if (error) {
      const errorMsg = toSingleLine(error.message || String(error));
      printable = `${printable} | error=${errorMsg}`;
      if (includeStack && error.stack) {
        printable = `${printable} | stack=${toSingleLine(error.stack).slice(0, 900)}`;
      }
    }

    const consoleEntry = this.formatConsoleEntry("fatal", printable);
    console.error(consoleEntry);

    const entry = this.formatEntry("fatal", printable, metadata);
    this.pushHistory(this.recentLogs, entry);
    this.pushHistory(this.recentErrors, entry);

    this.sendFatalWebhook(message, error, metadata).catch(() => {});
  }

  logCommand(commandName, userId, guildId, duration, success = true) {
    const shouldLogCommands = String(process.env.LOG_COMMAND_USAGE || "false").toLowerCase() === "true";
    if (!shouldLogCommands) return;

    const status = success ? "OK" : "ERR";
    this.info(`${status} Command: /${commandName}`, {
      command: commandName,
      user: userId,
      guild: guildId,
      duration: `${duration}ms`,
      status: success ? "success" : "error"
    });
  }

  logPlayer(event, guildId, metadata = {}) {
    this.debug(`Player Event: ${event}`, { ...metadata, guild: guildId });
  }

  logDatabase(operation, collection, metadata = {}) {
    this.debug(`DB: ${operation} on ${collection}`, metadata);
  }

  async sendErrorWebhook(message, _error, _metadata = {}) {
    try {
      if (!this.client?.config?.errorWebhook) return;
      console.log(`[Logger] Error webhook would send: ${message}`);
    } catch (err) {
      console.error("[Logger] sendErrorWebhook error:", err && (err.message || err));
    }
  }

  async sendFatalWebhook(message, _error, _metadata = {}) {
    try {
      if (!this.client?.config?.errorWebhook) return;
      console.log(`[Logger] FATAL webhook would send: ${message}`);
    } catch (err) {
      console.error("[Logger] sendFatalWebhook error:", err && (err.message || err));
    }
  }

  getRecentLogs(lines = 50) {
    const count = toPositiveInt(lines, 50);
    return this.recentLogs.slice(-count);
  }

  getRecentErrors(lines = 30) {
    const count = toPositiveInt(lines, 30);
    return this.recentErrors.slice(-count);
  }

  cleanupOldLogs(_daysToKeep = 14) {
    // File logging is disabled, so there is nothing to clean up.
    return 0;
  }

  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = this.levels[level];
      this.info(`Log level changed to: ${level}`);
    }
  }

  stop() {
    // No background file flushers to stop in console-only mode.
  }

  getLevel() {
    for (const [level, value] of Object.entries(this.levels)) {
      if (value === this.currentLevel) return level;
    }
    return "unknown";
  }
}

module.exports = Logger;
