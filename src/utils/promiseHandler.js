/**
 * Promise error handling utilities
 * Provides safe wrapping of promises with proper error logging
 */

const defaultLogger = console;

/**
 * Safely handle promise rejection with logging
 * @param {Promise} promise - Promise to handle
 * @param {string} context - Context description for logging
 * @param {object} logger - Logger instance (defaults to console)
 * @returns {Promise} Original promise
 */
function withErrorLogging(promise, context = 'Operation', logger = defaultLogger) {
  if (!promise || typeof promise.catch !== 'function') {
    return promise;
  }

  return promise.catch(err => {
    try {
      const msg = err && (err.message || err.toString ? err.toString() : String(err));
      const stack = err && err.stack;
      
      if (logger && typeof logger.log === 'function') {
        logger.log(`${context} failed: ${msg}${stack ? '\n' + stack : ''}`, 'error');
      } else if (logger && typeof logger.error === 'function') {
        logger.error(`${context} failed:`, err);
      } else {
        console.error(`${context} failed:`, err);
      }
    } catch (logErr) {
      console.error('Error logging promise rejection:', logErr);
    }
    
    // Don't re-throw - we've logged it
    return null;
  });
}

/**
 * Silently handle promise with optional logging
 * Used for fire-and-forget operations
 * @param {Promise} promise - Promise to handle
 * @param {string} context - Optional context for logging silent failures
 * @param {object} logger - Logger instance
 * @returns {Promise<boolean>} Resolves with success status
 */
function handleSilently(promise, context = null, logger = defaultLogger) {
  if (!promise || typeof promise.catch !== 'function') {
    return Promise.resolve(false);
  }

  return promise
    .then(() => true)
    .catch(err => {
      if (context && logger && typeof logger.log === 'function') {
        const msg = err && (err.message || String(err));
        logger.log(`${context} (silently handled): ${msg}`, 'warn');
      }
      return false;
    });
}

/**
 * Safe Discord interaction/message reply with proper error handling
 * Handles both interaction and message objects
 * @param {object} target - Interaction or Message object
 * @param {object} options - Reply options
 * @param {string} fallbackMessage - Fallback if all else fails
 * @param {object} logger - Logger instance
 * @returns {Promise<boolean>} Success status
 */
async function safeReply(target, options = {}, fallbackMessage = 'An error occurred.', logger = defaultLogger) {
  try {
    if (!target) {
      logger?.log?.('safeReply: Target is null/undefined', 'warn');
      return false;
    }

    // Handle Interaction
    if (target.isRepliable && typeof target.isRepliable === 'function' && target.isRepliable?.()) {
      try {
        if (target.deferred || target.replied) {
          return await target.editReply(options).catch(err => {
            logger?.log?.(`Failed to edit reply: ${err?.message}`, 'warn');
            return false;
          });
        } else {
          return await target.reply(options).catch(err => {
            logger?.log?.(`Failed to reply: ${err?.message}`, 'warn');
            return false;
          });
        }
      } catch (err) {
        logger?.log?.(`Interaction reply error: ${err?.message}`, 'error');
        return false;
      }
    }

    // Handle Message
    if (target.reply && typeof target.reply === 'function') {
      try {
        return await target.reply(options).catch(err => {
          logger?.log?.(`Failed to send message reply: ${err?.message}`, 'warn');
          return false;
        });
      } catch (err) {
        logger?.log?.(`Message reply error: ${err?.message}`, 'error');
        return false;
      }
    }

    logger?.log?.('safeReply: Target is not a valid interaction or message', 'warn');
    return false;
  } catch (err) {
    logger?.log?.(`safeReply unexpected error: ${err?.message}`, 'error');
    return false;
  }
}

/**
 * Safely send to webhook with proper error handling
 * @param {WebhookClient} webhook - Webhook instance
 * @param {object} options - Send options
 * @param {string} context - Context for logging
 * @param {object} logger - Logger instance
 * @returns {Promise<boolean>} Success status
 */
async function safeWebhookSend(webhook, options = {}, context = 'Webhook send', logger = defaultLogger) {
  try {
    if (!webhook || typeof webhook.send !== 'function') {
      logger?.log?.(`${context}: Invalid webhook`, 'warn');
      return false;
    }

    await webhook.send(options);
    return true;
  } catch (err) {
    logger?.log?.(`${context} failed: ${err?.message}`, 'warn');
    return false;
  }
}

/**
 * Wrap a promise with timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} message - Timeout error message
 * @returns {Promise} Promise that rejects on timeout
 */
function withTimeout(promise, timeoutMs = 5000, message = 'Operation timeout') {
  if (!promise || typeof promise.then !== 'function') {
    return Promise.reject(new Error('Invalid promise'));
  }

  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        const err = new Error(message);
        err.code = 'TIMEOUT';
        reject(err);
      }, timeoutMs)
    )
  ]);
}

module.exports = {
  withErrorLogging,
  handleSilently,
  safeReply,
  safeWebhookSend,
  withTimeout
};
