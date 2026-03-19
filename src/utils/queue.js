const formatDuration = require("./formatDuration");

function getQueueArray(player) {
  if (!player) return [];
  return [
    player?.queue?.current,
    ...(Array.isArray(player?.queue?.tracks) ? player.queue.tracks : [])
  ].filter(Boolean);
}

function truncateText(value, maxLength = 60) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function escapeLinkLabel(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function getTrackUrl(track) {
  const url = String(
    track?.info?.uri ||
    track?.info?.url ||
    track?.uri ||
    track?.url ||
    ""
  ).trim();

  return /^https?:\/\//i.test(url) ? url : null;
}

function getTrackThumbnail(track) {
  const candidates = [
    track?.info?.artworkUrl,
    track?.pluginInfo?.artworkUrl,
    track?.info?.thumbnail,
    track?.thumbnail,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (/^https?:\/\//i.test(value)) return value;
  }

  return null;
}

function formatQueueTrackTitle(track, maxLength = 60) {
  const title = truncateText(track?.info?.title || track?.title || "Unknown Title", maxLength);
  const url = getTrackUrl(track);
  return url ? `[${escapeLinkLabel(title)}](${url})` : title;
}

function isLiveTrack(track) {
  return Boolean(track?.info?.isStream || track?.isStream);
}

function getTrackDurationMs(track) {
  if (!track || isLiveTrack(track)) return null;
  const ms = Number(track?.info?.duration || track?.duration || 0);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms;
}

function formatTrackLength(track) {
  if (isLiveTrack(track)) return "LIVE";
  const ms = getTrackDurationMs(track);
  if (!ms) return "Unknown";
  return formatDuration(ms, { verbose: false, unitCount: 2 });
}

function getRequesterInfo(track, options = {}) {
  const fallbackRequester = options.fallbackRequester || null;
  const fallbackRequesterId = options.fallbackRequesterId || null;
  const fallbackTag = options.fallbackTag || null;

  const id =
    track?.requester?.id ||
    track?.requester?.user?.id ||
    track?.info?.requester?.id ||
    (typeof track?.requester === "string" ? track.requester : null) ||
    fallbackRequester?.id ||
    fallbackRequester?.user?.id ||
    fallbackRequesterId ||
    null;

  const tag =
    track?.requester?.tag ||
    track?.requester?.user?.tag ||
    track?.info?.requester?.tag ||
    fallbackRequester?.tag ||
    fallbackRequester?.user?.tag ||
    fallbackTag ||
    "Unknown";

  return {
    id,
    tag,
    mention: id ? `<@${id}>` : null,
    label: id ? `<@${id}>` : tag,
  };
}

function formatQueueTrackMeta(track, requesterLabel) {
  const author = truncateText(track?.info?.author || track?.author || "Unknown", 40);
  const duration = formatTrackLength(track);
  return `*by ${author} - ${duration} - ${requesterLabel || "Unknown"}*`;
}

function sumTrackDurations(tracks) {
  const list = Array.isArray(tracks) ? tracks : [tracks];
  let totalMs = 0;
  let hasLive = false;

  for (const track of list.filter(Boolean)) {
    const durationMs = getTrackDurationMs(track);
    if (durationMs == null) {
      if (isLiveTrack(track)) hasLive = true;
      continue;
    }
    totalMs += durationMs;
  }

  return { totalMs, hasLive };
}

function getQueueTiming(player, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const tracks = getQueueArray(player);
  const current = tracks[0] || null;
  const upcoming = tracks.slice(1);

  const playerPosition = Math.max(0, Number(player?.position || player?.lastPosition || 0));
  const currentDurationMs = getTrackDurationMs(current);
  const remainingCurrentMs = currentDurationMs == null
    ? null
    : Math.max(0, currentDurationMs - Math.min(playerPosition, currentDurationMs));

  const upcomingDurations = sumTrackDurations(upcoming);
  const totalDurations = sumTrackDurations(tracks);
  const remainingKnownMs = (remainingCurrentMs || 0) + upcomingDurations.totalMs;
  const hasLive = Boolean(
    (current && isLiveTrack(current)) ||
    upcomingDurations.hasLive
  );

  return {
    current,
    upcoming,
    totalTracks: tracks.length,
    upcomingTracks: upcoming.length,
    currentDurationMs,
    remainingCurrentMs,
    upcomingDurationMs: upcomingDurations.totalMs,
    totalDurationMs: totalDurations.totalMs,
    remainingKnownMs,
    hasLive,
    finishAt: !hasLive && remainingKnownMs > 0 ? now + remainingKnownMs : null,
  };
}

function formatDurationLabel(milliseconds) {
  const raw = Number(milliseconds);
  if (!Number.isFinite(raw) || raw <= 0) return "0s";
  return formatDuration(raw, { verbose: false, unitCount: 3 });
}

function formatDiscordTimestamp(timestampMs, style = "t") {
  const raw = Number(timestampMs);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return `<t:${Math.floor(raw / 1000)}:${style}>`;
}

module.exports = {
  escapeLinkLabel,
  formatDiscordTimestamp,
  formatDurationLabel,
  formatQueueTrackMeta,
  formatQueueTrackTitle,
  formatTrackLength,
  getQueueArray,
  getQueueTiming,
  getRequesterInfo,
  getTrackDurationMs,
  getTrackThumbnail,
  getTrackUrl,
  isLiveTrack,
  sumTrackDurations,
  truncateText,
};
