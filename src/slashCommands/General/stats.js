const { EmbedBuilder } = require("discord.js");
const os = require("os");

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Number(ms) || 0) / 1000;
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = (totalSeconds % 60).toFixed(1);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function sum(values) {
  return values.reduce((acc, value) => acc + (Number(value) || 0), 0);
}

function readCpuTimes() {
  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    const times = cpu.times || {};
    const cpuIdle = Number(times.idle) || 0;
    const cpuTotal =
      (Number(times.user) || 0) +
      (Number(times.nice) || 0) +
      (Number(times.sys) || 0) +
      (Number(times.irq) || 0) +
      cpuIdle;

    idle += cpuIdle;
    total += cpuTotal;
  }

  return { idle, total };
}

async function sampleCpu(sampleMs = 350) {
  const cpuStart = readCpuTimes();
  const procStart = process.cpuUsage();
  const timeStart = process.hrtime.bigint();

  await new Promise(resolve => setTimeout(resolve, sampleMs));

  const cpuEnd = readCpuTimes();
  const procDiff = process.cpuUsage(procStart);
  const timeEnd = process.hrtime.bigint();

  const elapsedMicros = Number((timeEnd - timeStart) / 1000n) || 1;
  const cores = os.cpus()?.length || 1;
  const botUsage = ((procDiff.user + procDiff.system) / (elapsedMicros * cores)) * 100;

  const idleDiff = cpuEnd.idle - cpuStart.idle;
  const totalDiff = cpuEnd.total - cpuStart.total;
  const idlePercent = totalDiff > 0 ? (idleDiff / totalDiff) * 100 : 0;
  const systemPercent = Math.max(0, 100 - idlePercent);

  return {
    botUsage: Math.max(0, botUsage),
    systemPercent,
    idlePercent
  };
}

async function getTotals(client) {
  let servers = client.guilds.cache.size;
  let members = client.guilds.cache.reduce((acc, guild) => acc + (Number(guild.memberCount) || 0), 0);
  let channels = client.guilds.cache.reduce((acc, guild) => acc + (guild.channels?.cache?.size || 0), 0);
  let players = Array.from(client?.lavalink?.nodeManager?.nodes?.values?.() || [])
    .reduce((acc, node) => acc + (Number(node?.stats?.players) || 0), 0);

  if (client.cluster) {
    try {
      servers = sum(await client.cluster.fetchClientValues("guilds.cache.size"));
    } catch (_err) {}

    try {
      const clusterMembers = await client.cluster.broadcastEval(c =>
        c.guilds.cache.reduce((acc, guild) => acc + (Number(guild.memberCount) || 0), 0)
      );
      members = sum(clusterMembers);
    } catch (_err) {}

    try {
      const clusterChannels = await client.cluster.broadcastEval(c =>
        c.guilds.cache.reduce((acc, guild) => acc + (Number(guild.channels?.cache?.size) || 0), 0)
      );
      channels = sum(clusterChannels);
    } catch (_err) {}

    try {
      const clusterPlayers = await client.cluster.broadcastEval(c =>
        Array.from(c?.lavalink?.nodeManager?.nodes?.values?.() || [])
          .reduce((acc, node) => acc + (Number(node?.stats?.players) || 0), 0)
      );
      players = sum(clusterPlayers);
    } catch (_err) {}
  }

  return { servers, members, channels, players };
}

module.exports = {
  name: "stats",
  description: "Returns bot statistics",
  owneronly: false,
  wl: true,
  run: async (client, interaction) => {
    const embedColor = client?.embedColor || "#ff0051";

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const totals = await getTotals(client);
    const cpu = await sampleCpu(350);
    const cpuModel = os.cpus()?.[0]?.model || "Unknown";
    const line = (label, value) => `${label.padEnd(10)} :: ${value}`;

    const statsText = [
      "STATS",
      line("Servers", totals.servers),
      line("Members", totals.members),
      line("Players", `${totals.players} player(s)`),
      line("Channels", totals.channels),
      line("Uptime", formatDuration(client.uptime || 0)),
      line("Server Up", formatDuration((os.uptime() || 0) * 1000)),
      line("CPU Model", cpuModel),
      line("Bots Usage", `${cpu.botUsage.toFixed(2)}%`),
      line("System", `${cpu.systemPercent.toFixed(2)}%`),
      line("Idle", `${cpu.idlePercent.toFixed(3)}%`),
      line("Platform", process.platform)
    ].join("\n");

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle("Stats")
      .setDescription(`\`\`\`asciidoc\n${statsText}\n\`\`\``);

    return interaction.editReply({ embeds: [embed] });
  }
};

