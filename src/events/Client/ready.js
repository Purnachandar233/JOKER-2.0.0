const { readdirSync } = require("fs");
const { ActivityType } = require("discord.js");
const { LavalinkManager } = require("lavalink-client");
const Topgg = require("@top-gg/sdk");
const autojoin = require("../../schema/twentyfourseven.js");
const {
  TOPGG_RECOVERY_INTERVAL_MS,
  reconcileRecentTopggVotes,
} = require("../../utils/topggVoteSync");

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const LAVALINK_RESTORE_TIMEOUT_MS = toPositiveNumber(process.env.LAVALINK_RESTORE_TIMEOUT_MS, 60000);
const LAVALINK_COMMAND_WAIT_MS = toPositiveNumber(process.env.LAVALINK_COMMAND_WAIT_MS, 2500);
const LAVALINK_REQUEST_TIMEOUT_MS = toPositiveNumber(process.env.LAVALINK_REQUEST_TIMEOUT_MS, 45000);
const LAVALINK_RETRY_AMOUNT = toPositiveNumber(process.env.LAVALINK_RETRY_AMOUNT, 8);
const LAVALINK_RETRY_DELAY_MS = toPositiveNumber(process.env.LAVALINK_RETRY_DELAY_MS, 5000);
const LAVALINK_RETRY_TIMESPAN_MS = toPositiveNumber(process.env.LAVALINK_RETRY_TIMESPAN_MS, 90000);
const LAVALINK_HEARTBEAT_MS = toPositiveNumber(process.env.LAVALINK_HEARTBEAT_MS, 30000);
const LAVALINK_VOICE_BRIDGE_TIMEOUT_MS = toPositiveNumber(process.env.LAVALINK_VOICE_BRIDGE_TIMEOUT_MS, 15000);
const QUEUE_END_IDLE_LEAVE_MS = toPositiveNumber(process.env.QUEUE_END_IDLE_LEAVE_MS, 2 * 60 * 1000);
const LAVALINK_POSITION_UPDATE_INTERVAL_MS = toPositiveNumber(
  process.env.LAVALINK_POSITION_UPDATE_INTERVAL_MS,
  250
);

function oneLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return "";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return fallback;
}

const LAVALINK_LOG_NO_AUDIO_DEBUG = toBoolean(process.env.LAVALINK_NO_AUDIO_DEBUG, false);
const LAVALINK_DEBUG_EVENTS = toBoolean(process.env.LAVALINK_DEBUG_EVENTS, false);

function log(client, message, level = "info") {
  const line = oneLine(message);
  if (!line) return;

  try {
    if (client?.logger && typeof client.logger.log === "function") {
      client.logger.log(line, level);
      return;
    }
  } catch (_err) {}

  const prefix = `[${String(level || "info").toUpperCase()}]`;
  if (String(level).toLowerCase() === "error") {
    console.error(`${prefix} ${line}`);
    return;
  }
  if (String(level).toLowerCase() === "warn") {
    console.warn(`${prefix} ${line}`);
    return;
  }
  console.log(`${prefix} ${line}`);
}

function normalizeConfiguredNode(node, index = 0) {
  if (!node || typeof node !== "object") return null;

  const host = String(node.host || "").trim();
  const authorization = String(node.authorization || node.password || "").trim();
  const port = Number(node.port);

  if (!host || !authorization || !Number.isFinite(port) || port <= 0) {
    return null;
  }

  return {
    id: String(node.id || node.identifier || `node${index + 1}`),
    host,
    port,
    authorization,
    secure: toBoolean(node.secure, false),
    retryAmount: Number.isFinite(Number(node.retryAmount)) ? Number(node.retryAmount) : LAVALINK_RETRY_AMOUNT,
    retryDelay: Number.isFinite(Number(node.retryDelay)) ? Number(node.retryDelay) : LAVALINK_RETRY_DELAY_MS,
    retryTimespan: Number.isFinite(Number(node.retryTimespan)) ? Number(node.retryTimespan) : LAVALINK_RETRY_TIMESPAN_MS,
    requestSignalTimeoutMS: Number.isFinite(Number(node.requestSignalTimeoutMS))
      ? Number(node.requestSignalTimeoutMS)
      : LAVALINK_REQUEST_TIMEOUT_MS,
    heartBeatInterval: Number.isFinite(Number(node.heartBeatInterval))
      ? Number(node.heartBeatInterval)
      : LAVALINK_HEARTBEAT_MS,
    enablePingOnStatsCheck: node.enablePingOnStatsCheck !== undefined
      ? toBoolean(node.enablePingOnStatsCheck, true)
      : true,
  };
}

function getConfiguredNodes(client) {
  const envHost = String(process.env.LAVALINK_HOST || "").trim();
  const envAuthorization = String(
    process.env.LAVALINK_AUTHORIZATION ||
    process.env.LAVALINK_PASSWORD ||
    process.env.LAVALINK_PASS ||
    ""
  ).trim();
  const envPort = Number(process.env.LAVALINK_PORT || 2333);

  if (envHost && envAuthorization && Number.isFinite(envPort) && envPort > 0) {
    return [
      normalizeConfiguredNode({
        id: process.env.LAVALINK_ID || "node1",
        host: envHost,
        port: envPort,
        authorization: envAuthorization,
        secure: process.env.LAVALINK_SECURE,
        retryAmount: process.env.LAVALINK_RETRY_AMOUNT,
        retryDelay: process.env.LAVALINK_RETRY_DELAY_MS,
        retryTimespan: process.env.LAVALINK_RETRY_TIMESPAN_MS,
        requestSignalTimeoutMS: process.env.LAVALINK_REQUEST_TIMEOUT_MS,
        heartBeatInterval: process.env.LAVALINK_HEARTBEAT_MS,
        enablePingOnStatsCheck: process.env.LAVALINK_ENABLE_PING_ON_STATS_CHECK,
      }, 0),
    ].filter(Boolean);
  }

  const configuredNodes = Array.isArray(client?.config?.nodes) ? client.config.nodes : [];
  return configuredNodes
    .map((node, index) => normalizeConfiguredNode(node, index))
    .filter(Boolean);
}

function attachNodeEvents(client) {
  if (!client?.lavalink?.nodeManager || client.__lavalinkNodeEventsAttached) return;

  const nodeCreate = require("../Player/nodeCreate.js");
  const nodeConnect = require("../Player/nodeConnect.js");
  const nodeDisconnect = require("../Player/nodeDisconnect.js");
  const nodeReconnect = require("../Player/nodeReconnect.js");
  const nodeError = require("../Player/nodeError.js");

  client.__lavalinkReconnectNodes = new Set();

  const getNodeKey = (node) => String(
    node?.id ||
    node?.options?.id ||
    node?.options?.identifier ||
    node?.options?.host ||
    "unknown"
  );

  client.lavalink.nodeManager.on("create", (node) => {
    nodeCreate(client, node).catch(() => {});
  });

  client.lavalink.nodeManager.on("reconnecting", (node) => {
    client.__lavalinkReconnectNodes.add(getNodeKey(node));
  });

  client.lavalink.nodeManager.on("connect", (node) => {
    const nodeKey = getNodeKey(node);
    const reconnecting = client.__lavalinkReconnectNodes.has(nodeKey);
    client.__lavalinkReconnectNodes.delete(nodeKey);

    if (reconnecting) {
      nodeReconnect(client, node).catch(() => {});
      return;
    }

    nodeConnect(client, node).catch(() => {});
  });

  client.lavalink.nodeManager.on("disconnect", (node, reason) => {
    client.__lavalinkReconnectNodes.delete(getNodeKey(node));
    nodeDisconnect(client, node, reason).catch(() => {});
  });

  client.lavalink.nodeManager.on("error", (node, error) => {
    nodeError(client, node, error).catch(() => {});
  });

  client.__lavalinkNodeEventsAttached = true;
}

function attachPlayerEvents(client) {
  if (!client?.lavalink || client.__lavalinkPlayerEventsAttached) return;

  const nodeEventFiles = new Set([
    "nodeCreate.js",
    "nodeConnect.js",
    "nodeDisconnect.js",
    "nodeReconnect.js",
    "nodeError.js",
  ]);

  const playerEventFiles = readdirSync("./src/events/Player/")
    .filter((file) => file.endsWith(".js") && !nodeEventFiles.has(file));

  for (const file of playerEventFiles) {
    const eventName = file.split(".")[0];
    const handler = require(`../Player/${file}`);
    client.lavalink.on(eventName, (...args) => {
      Promise.resolve(handler(client, ...args)).catch((error) => {
        log(client, `[LAVALINK] Player event ${eventName} failed: ${error?.message || error}`, "error");
      });
    });
  }

  client.lavalink.on("debug", (eventKey, eventData) => {
    if (eventKey !== "NoAudioDebug" || !LAVALINK_LOG_NO_AUDIO_DEBUG) return;

    const details = oneLine(eventData?.message || eventData?.debug || safeJson(eventData || {}));
    const level = eventData?.state === "error"
      ? "error"
      : eventData?.state === "warn"
        ? "warn"
        : "info";

    log(client, `[LAVALINK] ${eventKey}: ${details || "No audio debug event emitted."}`, level);
  });

  client.__lavalinkPlayerEventsAttached = true;
}

function patchLavalinkVoiceBridge(client) {
  if (!client?.lavalink || client.__lavalinkVoiceBridgePatched) return;

  const originalSendRawData = client.lavalink.sendRawData.bind(client.lavalink);

  client.lavalink.sendRawData = async (payload) => {
    if (!payload || payload.t !== "VOICE_SERVER_UPDATE") {
      return originalSendRawData(payload);
    }

    const update = "d" in payload ? payload.d : payload;
    const player = update?.guild_id ? client.lavalink.players.get(update.guild_id) : null;

    if (!player || player.get?.("internal_destroystatus") === true) {
      return originalSendRawData(payload);
    }

    const sessionId = player.voice?.sessionId || null;
    const channelId = player.voiceChannelId || player.options?.voiceChannelId || null;

    if (!update?.token || !update?.endpoint || !sessionId || !channelId || !player.node?.sessionId) {
      return originalSendRawData(payload);
    }

    player.voice = {
      ...(player.voice || {}),
      token: update.token,
      endpoint: update.endpoint,
      sessionId,
      channelId,
    };

    try {
      await player.node.updatePlayer({
        guildId: player.guildId,
        playerOptions: {
          voice: {
            token: update.token,
            endpoint: update.endpoint,
            sessionId,
            channelId,
          },
        },
      });
      return;
    } catch (error) {
      log(
        client,
        `[LAVALINK] Voice bridge update failed for guild ${player.guildId}: ${error?.message || error}`,
        "warn"
      );
      return originalSendRawData(payload);
    }
  };

  client.__lavalinkVoiceBridgePatched = true;
}

async function waitForVoiceBridge(guild, player, expectedChannelId, timeoutMs = LAVALINK_VOICE_BRIDGE_TIMEOUT_MS) {
  const startedAt = Date.now();

  while ((Date.now() - startedAt) < timeoutMs) {
    const botChannelId = guild.members.me?.voice?.channelId || null;
    const playerChannelId = player?.voiceChannelId || player?.options?.voiceChannelId || null;
    const hasVoiceBridge = Boolean(
      player?.voice?.sessionId &&
      player?.voice?.token &&
      player?.voice?.endpoint
    );

    if (botChannelId === expectedChannelId && playerChannelId === expectedChannelId && hasVoiceBridge) {
      return true;
    }

    await sleep(200);
  }

  return false;
}

function attachLavalinkHelpers(client) {
  client.waitForLavalinkReady = async (timeoutMs = LAVALINK_COMMAND_WAIT_MS) => {
    const parsedTimeout = Number(timeoutMs);
    const safeTimeout = Number.isFinite(parsedTimeout) && parsedTimeout >= 0
      ? parsedTimeout
      : LAVALINK_COMMAND_WAIT_MS;

    if (client?.lavalink?.useable) return true;
    if (!client?.lavalink) return false;

    const startedAt = Date.now();
    while ((Date.now() - startedAt) < safeTimeout) {
      if (client?.lavalink?.useable) return true;
      await sleep(250);
    }

    return Boolean(client?.lavalink?.useable);
  };
}

async function setupLavalink(client) {
  if (client.lavalink) {
    attachLavalinkHelpers(client);
    attachNodeEvents(client);
    attachPlayerEvents(client);
    patchLavalinkVoiceBridge(client);
    return client.lavalink;
  }

  const nodes = getConfiguredNodes(client);
  if (!nodes.length) {
    log(client, "[LAVALINK] No valid nodes configured. Lavalink startup skipped.", "warn");
    return null;
  }

  client.lavalink = new LavalinkManager({
    nodes,
    sendToShard(guildId, payload) {
      client.guilds.cache.get(guildId)?.shard?.send(payload);
    },
    autoSkip: true,
    playerOptions: {
      applyVolumeAsFilter: false,
      clientBasedPositionUpdateInterval: LAVALINK_POSITION_UPDATE_INTERVAL_MS,
      useUnresolvedData: true,
      onDisconnect: {
        autoReconnect: true,
        destroyPlayer: false,
      },
    },
    advancedOptions: {
      enableDebugEvents: LAVALINK_DEBUG_EVENTS,
      debugOptions: {
        noAudio: false,
        playerDestroy: {
          dontThrowError: true,
          debugLog: false,
        },
      },
    },
  });

  attachLavalinkHelpers(client);
  attachNodeEvents(client);
  attachPlayerEvents(client);
  patchLavalinkVoiceBridge(client);

  try {
    await client.lavalink.init({
      id: client.user.id,
      username: client.user.username,
    });

    if (client.lavalink.useable) {
      log(client, "[LAVALINK] Ready: at least one node is connected.", "info");
    } else {
      log(client, "[LAVALINK] Setup completed but no usable nodes are available yet.", "warn");
    }
  } catch (error) {
    log(client, `[LAVALINK] Setup failed: ${error?.message || error}`, "error");
  }

  return client.lavalink;
}

async function restore247Players(client) {
  client.__lavalinkRestoreState = {
    status: "starting",
    startedAt: Date.now(),
  };

  let lavalinkReady = false;

  try {
    lavalinkReady = await client.waitForLavalinkReady(LAVALINK_RESTORE_TIMEOUT_MS);
  } catch (_err) {
    lavalinkReady = false;
  }

  if (!client.lavalink) {
    client.__lavalinkRestoreState = {
      ...client.__lavalinkRestoreState,
      status: "skipped",
      finishedAt: Date.now(),
      reason: "Lavalink manager unavailable",
    };
    log(client, "Skipping 24/7 restore: Lavalink manager unavailable.", "warn");
    return;
  }

  if (!lavalinkReady || !client.lavalink.useable) {
    client.__lavalinkRestoreState = {
      ...client.__lavalinkRestoreState,
      status: "skipped",
      finishedAt: Date.now(),
      reason: "No usable Lavalink nodes are available yet",
    };
    log(client, "Skipping 24/7 restore: no usable Lavalink nodes are available yet.", "warn");
    return;
  }

  try {
    const data = await autojoin.find().catch(() => []);
    let connectedCount = 0;
    let autoplayCount = 0;
    let failedCount = 0;
    const failedExamples = [];

    for (const vc of data) {
      const guild = client.guilds.cache.get(vc.guildID);
      if (!guild) continue;

      const voiceChannel = guild.channels.cache.get(vc.voiceChannel);
      if (!voiceChannel) continue;

      const textChannel = guild.channels.cache.get(vc.textChannel);
      if (!textChannel) continue;

      try {
        let player = client.lavalink.players.get(vc.guildID);
        if (!player) {
          player = client.lavalink.createPlayer({
            guildId: vc.guildID,
            textChannelId: vc.textChannel,
            voiceChannelId: vc.voiceChannel,
            selfDeafen: true,
          });
        }

        player.textChannelId = vc.textChannel;
        player.options.textChannelId = vc.textChannel;
        player.voiceChannelId = vc.voiceChannel;
        player.options.voiceChannelId = vc.voiceChannel;
        await player.connect();
        const voiceBridgeReady = await waitForVoiceBridge(guild, player, vc.voiceChannel);
        if (!voiceBridgeReady) {
          throw new Error("Voice bridge did not become ready in time.");
        }
        connectedCount += 1;

        const autoplaySchema = require("../../schema/autoplay.js");
        const savedAutoplay = await autoplaySchema.findOne({ guildID: vc.guildID });
        if (savedAutoplay && savedAutoplay.enabled) {
          player.set("autoplay", true);
          player.set("requester", null);
          player.set("requesterId", savedAutoplay.requesterId || null);
          player.set("identifier", savedAutoplay.identifier);
          player.set("autoplayQuery", savedAutoplay.query || null);
          autoplayCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        if (failedExamples.length < 3) {
          const reason = oneLine(error && (error.message || error)).slice(0, 140);
          failedExamples.push(`${guild.name}: ${reason}`);
        }
      }
    }

    if (connectedCount > 0 || autoplayCount > 0 || failedCount > 0) {
      const summary = `[24/7] restore summary | connected=${connectedCount} autoplay=${autoplayCount} failed=${failedCount}`;
      if (failedCount > 0) {
        const detail = failedExamples.length ? ` | examples: ${failedExamples.join(" ; ")}` : "";
        log(client, `${summary}${detail}`, "warn");
      } else {
        log(client, summary, "info");
      }
    }

    client.__lavalinkRestoreState = {
      ...client.__lavalinkRestoreState,
      status: failedCount > 0 ? "completed_with_failures" : "completed",
      finishedAt: Date.now(),
      connectedCount,
      autoplayCount,
      failedCount,
      failedExamples,
    };
  } catch (error) {
    client.__lavalinkRestoreState = {
      ...client.__lavalinkRestoreState,
      status: "failed",
      finishedAt: Date.now(),
      reason: error && (error.message || String(error)),
    };
    log(client, `24/7 restore loop error: ${error && (error.message || error)}`, "error");
  }
}

module.exports = async (client) => {
  log(client, `[READY] ${client.user.username} online`, "info");

  client.user.setPresence({
    status: "online",
    activities: [{
      name: "/play ",
      type: ActivityType.Listening,
    }],
  });

  if (process.env.TOPGG_TOKEN) {
    client.topgg = new Topgg.Api(process.env.TOPGG_TOKEN);
  }

  if (client.topgg && typeof client.topgg.getVotes === "function" && !client.topggVoteRecoveryTimer) {
    const runTopggRecovery = async (source = "reconcile") => {
      if (client.topggVoteRecoveryInFlight) return;
      client.topggVoteRecoveryInFlight = true;

      try {
        const result = await reconcileRecentTopggVotes(client, { source });
        if (source === "startup_reconcile" || result.recorded > 0 || result.errors > 0) {
          log(
            client,
            `[TOPGG] ${source}: processed=${result.processed}, recorded=${result.recorded}, alreadyRecorded=${result.alreadyRecorded}, errors=${result.errors}`,
            result.errors > 0 ? "warn" : "info"
          );
        }
      } catch (error) {
        log(client, `[TOPGG] ${source} failed: ${error?.message || error}`, "warn");
      } finally {
        client.topggVoteRecoveryInFlight = false;
      }
    };

    const startupRecoveryTimer = setTimeout(() => {
      runTopggRecovery("startup_reconcile").catch(() => {});
    }, 5000);
    if (typeof startupRecoveryTimer.unref === "function") {
      startupRecoveryTimer.unref();
    }
    client.topggVoteStartupRecoveryTimer = startupRecoveryTimer;

    const recoveryTimer = setInterval(() => {
      runTopggRecovery("reconcile").catch(() => {});
    }, TOPGG_RECOVERY_INTERVAL_MS);
    if (typeof recoveryTimer.unref === "function") {
      recoveryTimer.unref();
    }
    client.topggVoteRecoveryTimer = recoveryTimer;
  }

  await setupLavalink(client);

  const restoreTimer = setTimeout(() => {
    restore247Players(client).catch((error) => {
      log(client, `24/7 restore loop error: ${error?.message || error}`, "error");
    });
  }, 2000);
  if (typeof restoreTimer.unref === "function") {
    restoreTimer.unref();
  }
};
