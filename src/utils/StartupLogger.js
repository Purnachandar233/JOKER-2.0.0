/**
 * Structured Startup Logging
 * Provides professional, organized startup/status messages
 */

class StartupLogger {
  constructor() {
    this.sections = new Map();
  }

  /**
   * Print header banner
   */
  printBanner(botName, version) {
    const width = 60;
    const padding = Math.floor((width - botName.length - version.length - 1) / 2);
    
    console.log('\n' + '═'.repeat(width));
    console.log(
      ' '.repeat(padding) + 
      `\x1b[36m${botName}\x1b[0m \x1b[90m${version}\x1b[0m`
    );
    console.log('═'.repeat(width) + '\n');
  }

  /**
   * Print section header
   */
  sectionStart(name) {
    console.log(`\n\x1b[36m┌${'─'.repeat(58)}┐\x1b[0m`);
    console.log(`\x1b[36m│\x1b[0m \x1b[1m${name.padEnd(56)}\x1b[0m \x1b[36m│\x1b[0m`);
    console.log(`\x1b[36m└${'─'.repeat(58)}┘\x1b[0m`);
    this.sections.set(name, []);
  }

  /**
   * Add success message to current section
   */
  success(message, detail = '') {
    const fullMsg = detail ? `${message} (${detail})` : message;
    console.log(`\x1b[32m  ✓\x1b[0m ${fullMsg}`);
    if (this.sections.size > 0) {
      const lastSection = Array.from(this.sections.keys()).pop();
      this.sections.get(lastSection).push({ type: 'success', msg: message, detail });
    }
  }

  /**
   * Add info message to current section
   */
  info(message, detail = '') {
    const fullMsg = detail ? `${message} (${detail})` : message;
    console.log(`\x1b[36m  ℹ\x1b[0m ${fullMsg}`);
    if (this.sections.size > 0) {
      const lastSection = Array.from(this.sections.keys()).pop();
      this.sections.get(lastSection).push({ type: 'info', msg: message, detail });
    }
  }

  /**
   * Add warning message to current section
   */
  warn(message, detail = '') {
    const fullMsg = detail ? `${message} (${detail})` : message;
    console.log(`\x1b[33m  ⚠\x1b[0m ${fullMsg}`);
    if (this.sections.size > 0) {
      const lastSection = Array.from(this.sections.keys()).pop();
      this.sections.get(lastSection).push({ type: 'warn', msg: message, detail });
    }
  }

  /**
   * Add error message to current section
   */
  error(message, detail = '') {
    const fullMsg = detail ? `${message} (${detail})` : message;
    console.log(`\x1b[31m  ✗\x1b[0m ${fullMsg}`);
    if (this.sections.size > 0) {
      const lastSection = Array.from(this.sections.keys()).pop();
      this.sections.get(lastSection).push({ type: 'error', msg: message, detail });
    }
  }

  /**
   * End current section
   */
  sectionEnd() {
    console.log('');
  }

  /**
   * Print completion status
   */
  complete(message = 'Startup complete') {
    console.log(`\n\x1b[32m█\x1b[0m ${message}`);
  }

  /**
   * Print ready status
   */
  ready(message, status = 'ONLINE') {
    const statusColor = status === 'ONLINE' ? '\x1b[32m' : '\x1b[33m';
    console.log(`\n\x1b[32m▶\x1b[0m ${message}`);
    console.log(`  Status: ${statusColor}${status}\x1b[0m\n`);
  }

  /**
   * Print error status
   */
  criticalError(message) {
    console.log(`\n\x1b[41m\x1b[37m ✗ CRITICAL ERROR \x1b[0m`);
    console.log(`\x1b[31m  ${message}\x1b[0m\n`);
  }

  /**
   * Print statistics
   */
  stats(title, items = {}) {
    console.log(`\n  ${title}:`);
    for (const [key, value] of Object.entries(items)) {
      const paddedKey = key.padEnd(20);
      console.log(`    ${paddedKey}: \x1b[36m${value}\x1b[0m`);
    }
  }

  /**
   * Print divider
   */
  divider() {
    console.log(`\n${'─'.repeat(60)}\n`);
  }
}

module.exports = StartupLogger;
