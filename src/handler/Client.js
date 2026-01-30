const { Client } = require("discord.js");
const chalk = require("chalk");
const mongoose = require('mongoose');
const { LavalinkManager, Node } = require("lavalink-client");
const { readdirSync } = require("fs");


/**
 * @param {Client} client
 */
module.exports = async (client) => {

    client.on("raw", (d) => {
        if (client.lavalink) client.lavalink.sendRawData(d);
    });




    /**
     * Mongodb connection
     */
    
    const dbOptions = {
        autoIndex: false,
        connectTimeoutMS: 10000,
        family: 4,
      };
        const mongoUrl = process.env.MONGODB_URL || client.config.mongourl;
        if (mongoUrl && mongoUrl.startsWith('mongodb')) {
          mongoose.connect(mongoUrl, dbOptions);
        } else {
          console.log('[WARN] No valid MongoDB URL provided. Database features will be unavailable.');
        }
        mongoose.Promise = global.Promise;
          mongoose.connection.on('connected', () => {
              console.log('Connected to MongoDB');
              });
          mongoose.connection.on('error', (err) => {
                  console.log(`Mongoose connection error: \n ${err.stack}`);
              });
          mongoose.connection.on('disconnected', () => {
                  console.log('MongoDB Disconnected');
              });
        
    /**
     * Error Handler
     */
    client.on("disconnect", () => console.log("Bot is disconnecting..."))
    client.on("reconnecting", () => console.log("Bot reconnecting..."))
    client.on('warn', error => { console.log(error)});
    client.on('error', error => { console.log(error)});
    process.on('unhandledRejection', error => { console.log(error)});
    process.on('uncaughtException', error => {console.log(error) });

 /**
 * Client Events
 */
readdirSync("./src/events/Client/").forEach(file => {
    const event = require(`../events/Client/${file}`);
    let eventName = file.split(".")[0];
   // client.logger.log(`Loading Events Client ${eventName}`);
    client.on(eventName, event.bind(null, client));
});

// Load standard events
const welcomeEvent = require("../events/guildMemberAdd");
welcomeEvent(client);


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
   

    client.once("ready", async () => {
         // Initialize Lavalink Manager
         const nodes = client.config?.nodes || [];
         
         if (!nodes || nodes.length === 0) {
             console.warn('[WARN] No Lavalink nodes configured in config.json. Music features will be unavailable.');
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
                 console.log(`LAVALINK => [NODE] ${node.id} connected successfully.`);
             });
             client.lavalink.nodeManager.on("disconnect", (node) => {
                 console.log(`LAVALINK => [NODE] ${node.id} disconnected.`);
             });
             client.lavalink.nodeManager.on("error", (node, error) => {
                 console.error(`LAVALINK => [NODE] ${node.id} encountered an error:`, error.message);
             });
             client.lavalink.nodeManager.on("reconnect", (node) => {
                 console.log(`LAVALINK => [NODE] ${node.id} reconnecting...`);
             });
             client.lavalink.nodeManager.on("create", (node) => {
                 console.log(`LAVALINK => [NODE] ${node.id} created.`);
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

             client.application.commands.set(data).catch((e) => console.log(e));
         } catch (error) {
             console.error('[ERROR] Failed to initialize Lavalink Manager:', error.message);
             console.error(error);
         }
    });

  

}
