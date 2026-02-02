const { Client } = require("discord.js");
const chalk = require("chalk");
const mongoose = require('mongoose');
const { LavalinkManager, Node } = require("lavalink-client");
const { readdirSync } = require("fs");
const safePlayer = require('../utils/safePlayer');


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
    const mongoSource = process.env.MONGODB_URL ? 'env' : (process.env.MONGOURI ? 'env(MONGOURI)' : (client.config.mongourl && client.config.mongourl !== 'MONGODB_URL' ? 'config' : 'none'));
    safeLog(`MongoDB URL source: ${mongoSource}`, 'info');
    mongoose.Promise = global.Promise;

    if (mongoUrl && typeof mongoUrl === 'string' && mongoUrl.startsWith('mongodb')) {
            try {
            await mongoose.connect(mongoUrl, dbOptions);
            safeLog('Connected to MongoDB', 'info');
        } catch (err) {
            safeLog(`[ERROR] MongoDB connection failed: ${err.message || err}`, 'error');
        }
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
    process.on('unhandledRejection', error => { safeLog(error && (error.stack || error.toString()), 'error'); });
    process.on('uncaughtException', error => { safeLog(error && (error.stack || error.toString()), 'error'); });

 /**
 * Client Events
 */
readdirSync("./src/events/Client/").forEach(file => {
    const event = require(`../events/Client/${file}`);
    let eventName = file.split(".")[0];
   // client.logger.log(`Loading Events Client ${eventName}`);
    client.on(eventName, event.bind(null, client));
});


const data = [];
readdirSync("./src/slashCommands/").forEach((dir) => {
        const slashCommandFile = readdirSync(`./src/slashCommands/${dir}/`).filter((files) => files.endsWith(".js"));
    
        for (const file of slashCommandFile) {
            const slashCommand = require(`../slashCommands/${dir}/${file}`);

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
            client.commands.set(command.name.toLowerCase(), command);
            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach((alias) => client.aliases.set(alias.toLowerCase(), command.name.toLowerCase()));
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
                client.commands.set(command.name.toLowerCase(), command);
                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach((alias) => client.aliases.set(alias.toLowerCase(), command.name.toLowerCase()));
                }
            }
        });
    });
   

    // The discord.js v15 ready event was renamed to `clientReady`. Register the
    // same initialization for both event names to remain backwards compatible
    // and avoid the deprecation warning.
        const setupLavalink = async () => {
            safeLog('Starting Lavalink setup...', 'info');
         // Initialize Lavalink Manager
         const nodes = client.config?.nodes || [];
         
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
                     safePlayer.safeDestroy(player);
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
        safeLog(`Discord client ready: ${client.user && client.user.tag ? client.user.tag : client.user}`, 'info');
        // Register global slash commands on ready (independent of Lavalink)
        try {
            if (Array.isArray(data) && data.length > 0) {
                if (client.application && client.application.commands && typeof client.application.commands.set === 'function') {
                    await client.application.commands.set(data);
                    safeLog(`Registered ${data.length} global slash commands.`, 'info');
                } else {
                    safeLog('client.application.commands not available to register slash commands yet', 'warn');
                }
            } else {
                safeLog('No slash command data to register', 'info');
            }
        } catch (e) {
            safeLog(`Failed to register global slash commands: ${e && (e.stack || e.toString())}`, 'error');
        }
        try {
            await setupLavalink();
        } catch (e) {
            safeLog(e && (e.stack || e.toString()), 'error');
        }
    });
    client.once("clientReady", async () => {
        safeLog('clientReady event fired', 'info');
        try {
            await setupLavalink();
        } catch (e) {
            safeLog(e && (e.stack || e.toString()), 'error');
        }
    });

  

}
