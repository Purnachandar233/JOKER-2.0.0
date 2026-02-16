const { Client } = require("discord.js");
const mongoose = require('mongoose');
const { LavalinkManager, Node } = require("lavalink-client");
const { readdirSync } = require("fs");
const safePlayer = require('../utils/safePlayer');
const StartupLogger = require('../utils/StartupLogger');

// Import all services
const Logger = require('../services/Logger');
const CommandErrorHandler = require('../services/CommandErrorHandler');
const PermissionService = require('../services/PermissionService');
const PlayerController = require('../services/PlayerController');
const FilterManager = require('../services/FilterManager');
const cooldownManager = require('../utils/cooldownManager');

/**
 * @param {Client} client
 */
module.exports = async (client) => {

    client.on("raw", (d) => {
        if (client.lavalink) client.lavalink.sendRawData(d);
    });

    // Safe logger wrapper: prefer client.logger if available, fall back to console
    const safeLog = (message, type = 'info') => {
        try {
            const mappedType = (type === 'info') ? 'log' : type;
            if (client && client.logger && typeof client.logger.log === 'function') {
                client.logger.log(message, mappedType);
            } else {
                console.log(message);
            }
        } catch (e) {
            try { console.log(message); } catch (_) {}
        }
    };

    /**
     * Mongodb connection
     */

        const dbOptions = {
                autoIndex: false,
                connectTimeoutMS: 30000,
                serverSelectionTimeoutMS: 30000,
                family: 4,
            };

    const mongoUrl = process.env.MONGODB_URL || process.env.MONGOURI || client.config.mongourl;

    if (mongoUrl && typeof mongoUrl === 'string' && mongoUrl.startsWith('mongodb')) {
            // Connect to MongoDB with improved error handling
            const attemptConnect = async (retries = 3, delay = 1000) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        await mongoose.connect(mongoUrl, dbOptions);
                        safeLog('Connected to MongoDB successfully', 'info');

                        // Verify connection is working
                        await mongoose.connection.db.admin().ping();
                        safeLog('MongoDB connection verified and healthy', 'info');
                        return true;
                    } catch (err) {
                        if (i < retries - 1) {
                            safeLog(`[RETRY] MongoDB connection attempt ${i + 1} failed: ${err && err.message}. Retrying in ${delay}ms...`, 'warn');
                            await new Promise(r => setTimeout(r, delay));
                            delay *= 2; // exponential backoff
                        } else {
                            safeLog(`[ERROR] MongoDB connection failed after ${retries} attempts: ${err && (err.message || err)}. Database features may be unavailable.`, 'error');
                            return false;
                        }
                    }
                }
                return true;
            };

            // Start connection in background but log when ready
            attemptConnect()
                .then(success => {
                    if (success) {
                        safeLog('Database initialization complete', 'info');
                    } else {
                        safeLog('Database unavailable - bot will proceed with limited functionality', 'warn');
                    }
                })
                .catch(err => {
                    safeLog(`[ERROR] Database connection error: ${err && (err.message || err)}`, 'error');
                });
    } else {
        safeLog('[WARN] No valid MongoDB URL provided. Database features will be unavailable.', 'warn');
    }
    mongoose.connection.on('error', (err) => {
        safeLog(`Mongoose connection error: \n ${err && err.stack ? err.stack : err}`, 'error');
    });

    mongoose.connection.on('disconnected', () => {
        safeLog('MongoDB Disconnected', 'warn');
    });

    /**
     * Error Handler
     */
    client.on("disconnect", () => safeLog("Bot is disconnecting...", 'warn'))
    client.on("reconnecting", () => safeLog("Bot reconnecting...", 'warn'))
    client.on('warn', error => { safeLog(error && (error.stack || error.toString()), 'warn'); });
    client.on('error', error => { safeLog(error && (error.stack || error.toString()), 'error'); });
    // process-level handlers are registered in src/bot.js to avoid duplicate logging

 /**
 * Client Events
 */
// Load Client event handlers and report which files were loaded
try {
    const clientEventFiles = readdirSync("./src/events/Client/");
    const loadedClientEvents = [];
    clientEventFiles.forEach(file => {
        try {
            const event = require(`../events/Client/${file}`);
            let eventName = file.split(".")[0];

            // Discord.js v15 removes the deprecated `ready` event name.
            // Route ready.js to `clientReady` now, while keeping other events unchanged.
            if (eventName === 'ready') {
                client.on('clientReady', event.bind(null, client));
                loadedClientEvents.push('clientReady (from ready.js)');
            } else {
                client.on(eventName, event.bind(null, client));
                loadedClientEvents.push(eventName);
            }
        } catch (err) {
            safeLog(`[ERROR] Failed to load Client event file ${file}: ${err && (err.stack || err.message || err)}`, 'error');
        }
    });
    safeLog(`Loaded Client events: ${loadedClientEvents.join(', ')}`, 'info');
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
        const setupLavalink = async () => {
            // Prevent double-initialization when both `ready` and `clientReady`
            // fire during startup in different environments.
            if (client.lavalink) {
                safeLog('Lavalink already initialized; skipping setup.', 'info');
                return;
            }
            safeLog('Starting Lavalink setup...', 'info');
         // Initialize Lavalink Manager
        const nodes = client.config?.nodes || [];

            // Log node configuration (mask authorization) for debugging in hosted environments
            try {
                const nodeSummary = Array.isArray(nodes) && nodes.length > 0 ? nodes.map(n => `${n.host}`).join(', ') : 'none';
                safeLog(`Lavalink nodes : ${Array.isArray(nodes) ? nodes.length : 0} -> ${nodeSummary}`, 'info');
            } catch (e) {
                safeLog(`Error summarizing Lavalink nodes: ${e && (e.stack || e.message || e)}`, 'warn');
            }

            if (!nodes || nodes.length === 0) {
            safeLog('[WARN] No Lavalink nodes configured in config.json. Music features will be unavailable.', 'warn');
            return;
        }

         try {
             client.lavalink = new LavalinkManager({
                 nodes: nodes,
                 sendToShard: (guildId, payload) => {
                     const guild = client.guilds.cache.get(guildId);
                     if (guild) guild.shard.send(payload);
                 },
                 autoSkip: true,
                 clientName: "JokerMusic",
                 clientId: client.user.id,
             });

             client.lavalink.init({ ...client.user });

             // Lavalink Node Manager Logging
             client.lavalink.nodeManager.on("connect", (node) => {
                 safeLog(`LAVALINK => [NODE] ${node.id} connected successfully.`, 'info');
             });
             client.lavalink.nodeManager.on("disconnect", (node) => {
                 safeLog(`LAVALINK => [NODE] ${node.id} disconnected.`, 'warn');
             });
             client.lavalink.nodeManager.on("error", (node, error) => {
                 safeLog(`LAVALINK => [NODE] ${node.id} encountered an error: ${error && error.message}`, 'error');
             });

             // Handle Lavalink player errors
             client.lavalink.on("playerError", (player, error) => {
                 safeLog(`LAVALINK => [PLAYER] ${player.guildId} encountered an error: ${error && error.message}`, 'error');
                 // Optionally destroy the player on error
                 if (player) {
                     safePlayer.safeDestroy(player).catch(err => {
                         safeLog(`safeDestroy error after playerError: ${err && (err.message || err)}`, 'error');
                     });
                 }
             });
             client.lavalink.nodeManager.on("reconnect", (node) => {
                 safeLog(`LAVALINK => [NODE] ${node.id} reconnecting...`, 'info');
             });
             client.lavalink.nodeManager.on("create", (node) => {
                 safeLog(`LAVALINK => [NODE] ${node.id} created.`, 'info');
             });

             /**
              * Lavalink Manager Events
              */
             readdirSync("./src/events/Player/").forEach(file => {
                 const event = require(`../events/Player/${file}`);
                 let eventName = file.split(".")[0];
               //  client.logger.log(`Loading Events Lavalink ${eventName}`);
                 client.lavalink.on(eventName, event.bind(null, client));
             });

            // Registration of global slash commands moved to `ready` handler
         } catch (error) {
             safeLog(`[ERROR] Failed to initialize Lavalink Manager: ${error && error.message}`, 'error');
             safeLog(error && (error.stack || error.toString()), 'error');
         }
    };

    client.once("ready", async () => {
        const startup = new StartupLogger();

        startup.sectionStart('CLIENT CONNECTION');
        startup.success(`Discord Connected: ${client.user && client.user.tag ? client.user.tag : client.user}`);
        startup.sectionEnd();

        // Register global slash commands on ready (independent of Lavalink)
        try {
            if (Array.isArray(data) && data.length > 0) {
                if (client.application && client.application.commands && typeof client.application.commands.set === 'function') {
                    startup.sectionStart('SLASH COMMANDS');
                    // Register slash commands in background to avoid blocking ready.
                    client.application.commands.set(data).then(() => {
                        startup.success(`Registered ${data.length} global commands`);
                    }).catch((e) => {
                        startup.error(`Failed to register commands: ${e && (e.message || e.toString())}`);
                    });
                } else {
                    startup.warn('client.application.commands not available yet');
                }
            } else {
                startup.info('No slash commands to register');
            }
        } catch (e) {
            startup.error(`Command registration error: ${e && (e.message || e.toString())}`);
        }
        // Note: Lavalink setup is performed on the `clientReady` event to
        // avoid duplicate initialization. `ready` still registers slash
        // commands and logs client readiness.
    });
    client.once("clientReady", async () => {
        const startup = new StartupLogger();

        try {
            startup.printBanner('JOKER MUSIC', 'v2.0.0');

            // Initialize Lavalink
            startup.sectionStart('LAVALINK SETUP');
            await setupLavalink();
            startup.success('Lavalink nodes initialized');
            startup.sectionEnd();

            // Initialize Services
            startup.sectionStart('SERVICE INITIALIZATION');

            // 1. Initialize Logger (critical for all other services)
            client.logger = new Logger(client);
            startup.success('Logger', 'Ready for structured logging');

            // 2. Initialize CommandErrorHandler
            client.errorHandler = new CommandErrorHandler(client);
            startup.success('CommandErrorHandler', 'Error handling enabled');

            // 3. Initialize PermissionService
            client.permissionService = new PermissionService(client);
            startup.success('PermissionService', 'Permission checks enabled');

            // 4. Initialize PlayerController (critical for music commands)
            client.playerController = new PlayerController(client);
            startup.success('PlayerController', 'Player management ready');

            // 5. Initialize FilterManager
            client.filterManager = new FilterManager(client);
            startup.success('FilterManager', 'Audio filters available');

            // 6. Attach cooldownManager (singleton pattern, no .start() needed)
            client.cooldownManager = cooldownManager;
            startup.success('CooldownManager', 'Command cooldowns enabled');

            startup.success('All 7 services initialized', 'COMPLETE');
            startup.sectionEnd();

            // Start maintenance tasks
            startup.sectionStart('MAINTENANCE TASKS');

            // Logger cleanup every 72 hours
            setInterval(async () => {
                try {
                    if (client.logger) {
                        client.logger.cleanupOldLogs(14);
                    }
                } catch (err) {
                    safeLog(`Logger cleanup error: ${err && (err.message || err)}`, 'warn');
                }
            }, 72 * 60 * 60 * 1000);
            startup.info('Log cleanup scheduled', '72h interval');

            // Permission cache cleanup every hour
            setInterval(() => {
                try {
                    if (client.permissionService) {
                        client.permissionService.cleanCache();
                    }
                } catch (err) {
                    safeLog(`Cache cleanup error: ${err && (err.message || err)}`, 'warn');
                }
            }, 60 * 60 * 1000);
            startup.info('Cache cleanup scheduled', '1h interval');

            startup.sectionEnd();

            startup.complete('All systems initialized and ready');

        } catch (e) {
            const startup = new StartupLogger();
            startup.criticalError(`Initialization failed: ${e && (e.message || e.toString())}`);
            safeLog(e && (e.stack || e.toString()), 'error');
        }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        try {
            safeLog('[SHUTDOWN] Flushing logs...', 'info');
            if (client.logger) {
                client.logger.stop(); // Flush buffer
            }
            safeLog('[SHUTDOWN] Bot shutting down.', 'info');
            process.exit(0);
        } catch (err) {
            console.error('[SHUTDOWN] Error during shutdown:', err && (err.message || err));
            process.exit(1);
        }
    });

}
