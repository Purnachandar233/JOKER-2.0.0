const chalk = require("./chalkCompat");
const moment = require("moment");
const config = require('../../config.json');
const { WebhookClient, EmbedBuilder } = require('discord.js');
const sanitize = require('./sanitize');

module.exports = class Logger {
	static log (content, type = "log") {
		const date = `${moment().format("DD-MM-YYYY hh:mm:ss")}`;

		// Respect configured log level to avoid noisy output under load.
		const LEVELS = { error: 0, warn: 1, log: 2, debug: 3 };
		const mappedType = (type === 'cmd' || type === 'event' || type === 'ready') ? 'log' : (type || 'log');
		const configured = (process.env.LOG_LEVEL || config?.logLevel || 'debug').toLowerCase();
		const cfgVal = LEVELS[configured] ?? 3;
		const msgVal = LEVELS[mappedType] ?? 2;
		if (msgVal > cfgVal) return; // message is lower priority than configured; skip logging

		// If content is an Error object, extract stack trace and file info
		let message = content;
		let stackInfo = '';

		if (content instanceof Error) {
			message = content.message;
			if (content.stack) {
				const stackLines = content.stack.split('\n');
				// Extract file, line, and column from the first relevant stack frame
				const stackMatch = stackLines[1]?.match(/at\s+.*?\s+\((.*?):(\d+):(\d+)\)/) ||
				                  stackLines[1]?.match(/at\s+(.*?):(\d+):(\d+)/);
				if (stackMatch) {
					const [, file, line, column] = stackMatch;
					const fileName = file.split('/').pop() || file.split('\\').pop();
					stackInfo = ` [${fileName}:${line}:${column}]`;
				}
			}
		}

		// Sanitize message and other content to avoid leaking tokens/credentials
    try {
      message = sanitize(String(message));
    } catch (e) {
      console.error('logger sanitize error:', e && (e.message || e));
    }

		switch (type) {

		case "log": {
 			const out = `[${chalk.gray(date)}]: [${chalk.black.bgBlue(type.toUpperCase())}] ${message}${stackInfo}`;
 			try { console.log(out); } catch (e) {}
 			// send to guild webhook if configured and enabled
 			try {
 				const url = process.env.LOG_WEBHOOK_URL || (config?.webhooks?.guildLogs || '');
 				if (url) {
 					const web = new WebhookClient({ url });
					const embed = new EmbedBuilder().setTitle('Log').setDescription(String(sanitize(message)).slice(0, 1900)).setColor(config.embedColor || '#000000').setTimestamp();
 					web.send({ embeds: [embed] }).catch(err => {
            try { console.warn('Log webhook error:', err?.message); } catch (e) {}
          });
 				}
 			} catch (e) {}
 			return out;
		}
		case "warn": {
 			const out = `[${chalk.gray(date)}]: [${chalk.black.bgYellow(type.toUpperCase())}] ${message}${stackInfo}`;
 			try { console.log(out); } catch (e) {}
 			try {
 				const url = process.env.LOG_WEBHOOK_URL || (config?.webhooks?.guildLogs || '');
 				if (url) {
 					const web = new WebhookClient({ url });
					const embed = new EmbedBuilder().setTitle('Warning').setDescription(String(sanitize(message)).slice(0, 1900)).setColor(config.embedColor || '#000000').setTimestamp();
 					web.send({ embeds: [embed] }).catch(err => {
            try { console.warn('Warn webhook error:', err?.message); } catch (e) {}
          });
 				}
 			} catch (e) {}
 			return out;
		}
		case "error": {
 			const out = `[${chalk.gray(date)}]: [${chalk.black.bgRed(type.toUpperCase())}] ${message}${stackInfo}`;
 			try { console.log(out); } catch (e) {}
 			// Also log full stack trace for errors
 			if (content instanceof Error && content.stack) {
 				try { console.log(chalk.red(content.stack)); } catch (e) {}
 			}
 			// send to error webhook if configured
 			try {
 				const url = process.env.ERROR_WEBHOOK_URL || (config?.webhooks?.errorLogs || '');
 				if (url) {
 					const web = new WebhookClient({ url });
										const embed = new EmbedBuilder()
											.setTitle('Error')
											.setDescription(`\`\`\`js\n${String(sanitize(message))}\n\`\`\``)
											.setColor(config.embedColor || '#000000')
											.addFields({ name: 'Stack', value: (content && content.stack) ? String(sanitize(content.stack)).slice(0, 1024) : 'N/A' })
											.setTimestamp();
 					web.send({ embeds: [embed] }).catch(err => {
            try { console.warn('Error webhook error:', err?.message); } catch (e) {}
          });
 				}
 			} catch (e) {}
 			return out;
		}
		case "debug": {
			return console.log(`[${chalk.gray(date)}]: [${chalk.black.bgGreen(type.toUpperCase())}] ${message}${stackInfo}`);
		}
		case "cmd": {
			return console.log(`[${chalk.gray(date)}]: [${chalk.black.bgWhite(type.toUpperCase())}] ${message}${stackInfo}`);
		}
		case "event": {
			return console.log(`[${chalk.gray(date)}]: [${chalk.black.bgWhite(type.toUpperCase())}] ${message}${stackInfo}`);
		}
		case "ready": {
			return console.log(`[${chalk.gray(date)}]: [${chalk.black.bgBlueBright(type.toUpperCase())}] ${message}${stackInfo}`);
		}
		default: throw new TypeError("Logger type must be either warn, debug, log, ready, cmd or error.");
		}
	}
};
