const { Client } = require("discord.js");
const mongoose = require('mongoose');
const { readdirSync } = require("fs");
const StartupLogger = require('../utils/StartupLogger');

// Import all services
const Logger = require('../services/Logger');
const CommandErrorHandler = require('../services/CommandErrorHandler');
const cooldownManager = require('../utils/cooldownManager');



/**
 * @param {Client} client
 */
module.exports = async (client) => {
    if (!(client.logger instanceof Logger)) {
        client.logger = new Logger(client);
    } else {
        client.logger.client = client;
    }

    client.on("raw", (d) => {
        if (!client.lavalink) return;

        try {
            client.lavalink.sendRawData(d);
        } catch (_e) {}
    });

    // Safe logger wrapper: prefer client.logger if available, fall back to console.
    // Output stays one-line and structured to avoid noisy startup logs.
    const safeLog = (message, type = 'info') => {
        const normalizedType = ['ready', 'success'].includes(String(type).toLowerCase()) ? 'info' : String(type || 'info').toLowerCase();
        const safeMessage = String(message ?? "").replace(/\s+/g, " ").trim();
        if (!safeMessage) return;

        try {
            if (client && client.logger && typeof client.logger.log === 'function') {
                client.logger.log(safeMessage, normalizedType);
                return;
            }
        } catch (_e) {}

        const line = `[${new Date().toISOString()}] [${normalizedType.toUpperCase()}] ${safeMessage}`;
        if (normalizedType === 'error' || normalizedType === 'fatal' || normalizedType === 'critical') {
            console.error(line);
            return;
        }
        if (normalizedType === 'warn' || normalizedType === 'warning') {
            console.warn(line);
            return;
        }
        console.log(line);
    };

    /**
     * MongoDB connection (resilient reconnect + health checks)
     */
    const dbOptions = {
        autoIndex: false,
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
        family: 4,
    };

    const mongoUrl = process.env.MONGODB_URL || process.env.MONGOURI || client.config.mongourl;
    const hasValidMongoUrl = Boolean(
        mongoUrl &&
        typeof mongoUrl === 'string' &&
        mongoUrl.startsWith('mongodb')
    );

    const mongoState = {
        connecting: false,
        reconnectTimer: null,
        healthTimer: null,
        reconnectAttempts: 0,
        healthy: false,
    };

    const MONGO_HEALTH_CHECK_MS = Number(process.env.MONGO_HEALTH_CHECK_MS || 60000);
    const MONGO_MAX_RECONNECT_DELAY_MS = Number(process.env.MONGO_MAX_RECONNECT_DELAY_MS || 60000);

    const isMongoConnected = () => mongoose.connection.readyState === 1;

    const clearMongoReconnectTimer = () => {
        if (mongoState.reconnectTimer) {
            clearTimeout(mongoState.reconnectTimer);
            mongoState.reconnectTimer = null;
        }
    };

    const scheduleMongoReconnect = (reason = 'unknown') => {
        if (!hasValidMongoUrl || mongoState.reconnectTimer || mongoState.connecting || isMongoConnected()) {
            return;
        }

        mongoState.reconnectAttempts += 1;
        const backoff = Math.min(
            1000 * Math.pow(2, Math.max(0, mongoState.reconnectAttempts - 1)),
            MONGO_MAX_RECONNECT_DELAY_MS
        );
        const jitter = Math.floor(Math.random() * 750);
        const delay = backoff + jitter;

        safeLog(`[MONGO] Reconnect attempt ${mongoState.reconnectAttempts} in ${delay}ms (${reason}).`, 'warn');
        mongoState.reconnectTimer = setTimeout(() => {
            mongoState.reconnectTimer = null;
            connectMongo('scheduled-reconnect').catch(() => {});
        }, delay);

        if (mongoState.reconnectTimer && typeof mongoState.reconnectTimer.unref === 'function') {
            mongoState.reconnectTimer.unref();
        }
    };

    const connectMongo = async (reason = 'startup') => {
        if (!hasValidMongoUrl) return false;
        if (mongoState.connecting) return false;

        const state = mongoose.connection.readyState;
        if (state === 1 || state === 2) {
            return state === 1;
        }

        mongoState.connecting = true;

        try {
            await mongoose.connect(mongoUrl, dbOptions);
            await mongoose.connection.db.admin().ping();

            mongoState.healthy = true;
            mongoState.reconnectAttempts = 0;
            clearMongoReconnectTimer();

            return true;
        } catch (err) {
            mongoState.healthy = false;
            safeLog(`[MONGO] Connection failed (${reason}): ${err && (err.message || err)}`, 'error');
            scheduleMongoReconnect('connect-failed');
            return false;
        } finally {
            mongoState.connecting = false;
        }
    };

    const startMongoHealthChecks = () => {
        if (!hasValidMongoUrl || mongoState.healthTimer) return;

        mongoState.healthTimer = setInterval(async () => {
            if (!isMongoConnected()) {
                mongoState.healthy = false;
                scheduleMongoReconnect('healthcheck-disconnected');
                return;
            }

            try {
                await mongoose.connection.db.admin().ping();
                if (!mongoState.healthy) {
                    safeLog('[MONGO] Connection recovered and ping is healthy.', 'info');
                }
                mongoState.healthy = true;
            } catch (err) {
                mongoState.healthy = false;
                safeLog(`[MONGO] Health check ping failed: ${err && (err.message || err)}`, 'warn');
                scheduleMongoReconnect('healthcheck-ping-failed');
            }
        }, MONGO_HEALTH_CHECK_MS);

        if (mongoState.healthTimer && typeof mongoState.healthTimer.unref === 'function') {
            mongoState.healthTimer.unref();
        }
    };

    if (hasValidMongoUrl) {
        connectMongo('startup').catch(() => {});
        startMongoHealthChecks();
    } else {
        safeLog('[WARN] No valid MongoDB URL provided. Database features will be unavailable.', 'warn');
    }

    mongoose.connection.on('connected', () => {
        mongoState.healthy = true;
        mongoState.reconnectAttempts = 0;
        clearMongoReconnectTimer();
        safeLog('[MONGO] Connected successfully.', 'info');
    });

    mongoose.connection.on('reconnected', () => {
        mongoState.healthy = true;
        mongoState.reconnectAttempts = 0;
        clearMongoReconnectTimer();
        safeLog('[MONGO] Reconnected successfully.', 'info');
    });

    mongoose.connection.on('error', (err) => {
        mongoState.healthy = false;
        safeLog(`[MONGO] Connection error: ${err && (err.message || err)}`, 'error');
        scheduleMongoReconnect('mongoose-error');
    });

    mongoose.connection.on('disconnected', () => {
        mongoState.healthy = false;
        safeLog('MongoDB disconnected.', 'warn');
        scheduleMongoReconnect('mongoose-disconnected');
    });

    /**
     * Error Handler
     */
    client.on("disconnect", () => safeLog("Bot is disconnecting...", 'warn'))
    client.on("reconnecting", () => safeLog("Bot reconnecting...", 'warn'))
    client.on('warn', error => { safeLog(`[CLIENT] ${error && (error.message || error.toString())}`, 'warn'); });
    client.on('error', error => { safeLog(`[CLIENT] ${error && (error.message || error.toString())}`, 'error'); });
    // process-level handlers are registered in src/bot.js to avoid duplicate logging

 /**
 * Client Events
 */
// Load Client event handlers and report which files were loaded
try {
    const clientEventFiles = readdirSync("./src/events/Client/");
    clientEventFiles.forEach(file => {
        try {
            const event = require(`../events/Client/${file}`);
            let eventName = file.split(".")[0];

            // Discord.js v15 removes the deprecated `ready` event name.
            // Route ready.js to `clientReady` now, while keeping other events unchanged.
            if (eventName === 'ready') {
                client.on('clientReady', event.bind(null, client));
            } else {
                client.on(eventName, event.bind(null, client));
            }
        } catch (err) {
            safeLog(`[ERROR] Failed to load Client event file ${file}: ${err && (err.stack || err.message || err)}`, 'error');
        }
    });
} catch (err) {
    safeLog(`[ERROR] Unable to read Client events folder: ${err && (err.stack || err.message || err)}`, 'error');
}

const data = [];
readdirSync("./src/slashCommands/").forEach((dir) => {
        const slashCommandFile = readdirSync(`./src/slashCommands/${dir}/`).filter((files) => files.endsWith(".js"));

        for (const file of slashCommandFile) {
            const slashCommand = require(`../slashCommands/${dir}/${file}`);
            // Attach filename so error handlers can surface the originating file
            try { slashCommand._filename = `src/slashCommands/${dir}/${file}`; } catch (e) {}

            if(!slashCommand.name) return console.error(`slashCommandNameError: ${file.split(".")[0]} application command name is required.`);

            if(!slashCommand.description) return console.error(`slashCommandDescriptionError: ${file.split(".")[0]} application command description is required.`);

            client.sls.set(slashCommand.name, slashCommand);

            data.push(slashCommand);
        }
    });

    readdirSync("./src/commands/").forEach((dir) => {
        const fullDir = `./src/commands/${dir}/`;
        const CommandFile = readdirSync(fullDir).filter((files) => files.endsWith(".js"));

        for (const file of CommandFile) {
            const command = require(`../commands/${dir}/${file}`);
            if(!command.name) continue;
            try { command._filename = `src/commands/${dir}/${file}`; } catch (_e) {}
            const commandName = command.name.toLowerCase();
            client.commands.set(commandName, command);
            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach((alias) => {
                    const aliasKey = String(alias).toLowerCase();
                    const existing = client.aliases.get(aliasKey);
                    if (existing && existing !== commandName) {
                        safeLog(`[WARN] Alias collision skipped: "${aliasKey}" already mapped to "${existing}", ignoring "${commandName}"`, 'warn');
                        return;
                    }
                    if (client.commands.has(aliasKey) && aliasKey !== commandName) {
                        safeLog(`[WARN] Alias collision skipped: "${aliasKey}" matches command name, ignoring alias for "${commandName}"`, 'warn');
                        return;
                    }
                    client.aliases.set(aliasKey, commandName);
                });
            }
        }

        // Load nested commands in one level deeper
        const subDirs = readdirSync(fullDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        subDirs.forEach(subDir => {
            const subCommandFiles = readdirSync(`${fullDir}${subDir}/`).filter((files) => files.endsWith(".js"));
            for (const file of subCommandFiles) {
                const command = require(`../commands/${dir}/${subDir}/${file}`);
                if(!command.name) continue;
                try { command._filename = `src/commands/${dir}/${subDir}/${file}`; } catch (_e) {}
                const commandName = command.name.toLowerCase();
                client.commands.set(commandName, command);
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach((alias) => {
                        const aliasKey = String(alias).toLowerCase();
                        const existing = client.aliases.get(aliasKey);
                        if (existing && existing !== commandName) {
                            safeLog(`[WARN] Alias collision skipped: "${aliasKey}" already mapped to "${existing}", ignoring "${commandName}"`, 'warn');
                            return;
                        }
                        if (client.commands.has(aliasKey) && aliasKey !== commandName) {
                            safeLog(`[WARN] Alias collision skipped: "${aliasKey}" matches command name, ignoring alias for "${commandName}"`, 'warn');
                            return;
                        }
                        client.aliases.set(aliasKey, commandName);
                    });
                }
            }
        });
    });

    // The discord.js v15 ready event was renamed to `clientReady`. Register the
    // same initialization for both event names to remain backwards compatible
    // and avoid the deprecation warning.
    client.once("clientReady", async () => {
        const startup = new StartupLogger();

        startup.sectionStart('DISCORD');
        startup.success(`Discord connected: ${client.user && client.user.tag ? client.user.tag : client.user}`);
        startup.sectionEnd();

        // Register global slash commands on ready (independent of Lavalink)
        try {
            startup.sectionStart('COMMANDS');
            if (Array.isArray(data) && data.length > 0) {
                if (client.application && client.application.commands && typeof client.application.commands.set === 'function') {
                    // Register slash commands in background to avoid blocking ready.
                    client.application.commands.set(data).then(() => {
                        startup.success(`Slash commands registered`, `count=${data.length}`);
                    }).catch((e) => {
                        startup.error(`Failed to register commands: ${e && (e.message || e.toString())}`);
                    });
                } else {
                    startup.warn('Slash registration skipped: client.application.commands unavailable');
                }
            } else {
                startup.info('No slash commands to register');
            }
            startup.sectionEnd();
        } catch (e) {
            startup.error(`Command registration error: ${e && (e.message || e.toString())}`);
        }
        // Lavalink setup is performed from src/events/Client/ready.js, which
        // also runs on clientReady. This block only handles Discord startup
        // logging and slash command registration.
    });
    client.once("clientReady", async () => {
        const startup = new StartupLogger();

        try {
            // 1. Ensure structured logger is available
            startup.sectionStart('SERVICES');
            if (!(client.logger instanceof Logger)) {
                client.logger = new Logger(client);
            } else {
                client.logger.client = client;
            }

            // 2. Initialize CommandErrorHandler
            client.errorHandler = new CommandErrorHandler(client);

            // 3. Attach cooldownManager (singleton pattern, no .start() needed)
            client.cooldownManager = cooldownManager;
            startup.success('Core services ready');
            startup.sectionEnd();

            startup.complete('All systems initialized and ready');

        } catch (e) {
            const startup = new StartupLogger();
            startup.criticalError(`Initialization failed: ${e && (e.message || e.toString())}`);
            safeLog(`Initialization failed: ${e && (e.message || e.toString())}`, 'error');
        }
    });

    // Graceful shutdown
    const handleShutdown = async (signal) => {
        try {
            safeLog(`[SHUTDOWN] Received ${signal}. Cleaning up resources...`, 'info');

            if (mongoState.healthTimer) {
                clearInterval(mongoState.healthTimer);
                mongoState.healthTimer = null;
            }
            clearMongoReconnectTimer();

            if (mongoose.connection.readyState !== 0) {
                await mongoose.connection.close().catch(() => {});
            }

            if (client.logger && typeof client.logger.stop === 'function') {
                client.logger.stop(); // Flush logger buffers if supported
            }

            safeLog('[SHUTDOWN] Bot shutdown complete.', 'info');
            process.exit(0);
        } catch (err) {
            console.error('[SHUTDOWN] Error during shutdown:', err && (err.message || err));
            process.exit(1);
        }
    };

    process.on('SIGINT', () => { handleShutdown('SIGINT'); });
    process.on('SIGTERM', () => { handleShutdown('SIGTERM'); });

}
