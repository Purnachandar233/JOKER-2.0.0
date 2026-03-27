/**
 * Promise helpers with low-noise error handling.
 */

const defaultLogger = console;
const interactionResponder = require('./interactionResponder');

function withErrorLogging(promise, context = 'Operation', logger = defaultLogger) {
  if (!promise || typeof promise.catch !== 'function') {
    return promise;
  }

  return promise.catch(err => {
    try {
      const msg = err && (err.message || (err.toString ? err.toString() : String(err)));
      const stack = err && err.stack;

      if (logger && typeof logger.log === 'function') {
        logger.log(`${context} failed: ${msg}${stack ? '\n' + stack : ''}`, 'error');
      } else if (logger && typeof logger.error === 'function') {
        logger.error(`${context} failed:`, err);
      }
    } catch (_logErr) {}

    return null;
  });
}

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

async function replySafely(target, options = {}, logger = defaultLogger) {
  try {
    if (!target) return false;

    if (target.isRepliable && typeof target.isRepliable === 'function' && target.isRepliable()) {
      return await interactionResponder.reply(target, options);
    }

    if (target.reply && typeof target.reply === 'function') {
      return await target.reply(options).catch(() => false);
    }

    return false;
  } catch (err) {
    logger?.log?.(`replySafely error: ${err?.message}`, 'error');
    return false;
  }
}

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

function withTimeout(promise, timeoutMs = 5000, message = 'Operation timeout') {
  if (!promise || typeof promise.then !== 'function') {
    return Promise.reject(new Error('Invalid promise'));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(message);
      err.code = 'TIMEOUT';
      reject(err);
    }, timeoutMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    Promise.resolve(promise).then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

module.exports = {
  withErrorLogging,
  handleSilently,
  replySafely,
  safeWebhookSend,
  withTimeout
};

