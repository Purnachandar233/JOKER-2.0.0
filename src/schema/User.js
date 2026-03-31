const mongoose = require("mongoose");

const { grantTimedUserPremiumWindow } = require("../utils/premiumAccess");

const DAY_MS = 24 * 60 * 60 * 1000;

const BADGE_CATALOG = Object.freeze({
  vote5: { label: "Early Supporter", metric: "votes", threshold: 5 },
  vote10: { label: "Rising Supporter", metric: "votes", threshold: 10 },
  vote25: { label: "Fan Favorite", metric: "votes", threshold: 25 },
  vote50: { label: "Star Supporter", metric: "votes", threshold: 50 },
  vote100: { label: "Legendary Supporter", metric: "votes", threshold: 100 },
  songs25: { label: "First Beat", metric: "songs", threshold: 25 },
  songs100: { label: "Groove Keeper", metric: "songs", threshold: 100 },
  songs250: { label: "Night Rider", metric: "songs", threshold: 250 },
  songs500: { label: "Sound Master", metric: "songs", threshold: 500 },
  songs1000: { label: "Playlist Legend", metric: "songs", threshold: 1000 },
  commands100: { label: "Explorer", metric: "commands", threshold: 100 },
  commands500: { label: "Veteran", metric: "commands", threshold: 500 },
  commands1000: { label: "Master User", metric: "commands", threshold: 1000 },
});

const REWARD_CATALOG = Object.freeze({
  vote5Premium: {
    badgeKey: "vote5",
    metric: "votes",
    threshold: 5,
    durationMs: 7 * DAY_MS,
    label: "7 days of Premium access",
  },
  vote10Premium: {
    badgeKey: "vote10",
    metric: "votes",
    threshold: 10,
    durationMs: 15 * DAY_MS,
    label: "15 days of Premium access",
  },
  vote25Premium: {
    badgeKey: "vote25",
    metric: "votes",
    threshold: 25,
    durationMs: 30 * DAY_MS,
    label: "1 month of Premium access",
  },
  vote50Premium: {
    badgeKey: "vote50",
    metric: "votes",
    threshold: 50,
    durationMs: 180 * DAY_MS,
    label: "6 months of Premium access",
  },
  vote100Premium: {
    badgeKey: "vote100",
    metric: "votes",
    threshold: 100,
    permanent: true,
    label: "Permanent Premium access",
  },
});

function toPositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function normalizeUserId(userId) {
  const normalized = String(userId || "").trim();
  return normalized || null;
}

function getMetricTotals(doc) {
  return {
    votes: Number(doc?.totalVotes || 0),
    songs: Number(doc?.songsListened || 0),
    commands: Number(doc?.count || 0),
  };
}

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  totalVotes: { type: Number, default: 0 },
  songsListened: { type: Number, default: 0 },
  totalListenTimeMs: { type: Number, default: 0 },
  topgg: {
    lastVoteRecordedAt: { type: Number, default: 0 },
    lastVoteSource: { type: String, default: "" },
  },
  badge: {
    dev: { type: Boolean, default: false },
    owner: { type: Boolean, default: false },
    supporter: { type: Boolean, default: false },
    bug: { type: Boolean, default: false },
    premium: { type: Boolean, default: false },
    partner: { type: Boolean, default: false },
    staff: { type: Boolean, default: false },
    manager: { type: Boolean, default: false },
    booster: { type: Boolean, default: false },
    vip: { type: Boolean, default: false },
  },
  milestones: {
    vote5: { type: Boolean, default: false },
    vote10: { type: Boolean, default: false },
    vote25: { type: Boolean, default: false },
    vote50: { type: Boolean, default: false },
    vote100: { type: Boolean, default: false },
    songs25: { type: Boolean, default: false },
    songs100: { type: Boolean, default: false },
    songs250: { type: Boolean, default: false },
    songs500: { type: Boolean, default: false },
    songs1000: { type: Boolean, default: false },
    commands100: { type: Boolean, default: false },
    commands500: { type: Boolean, default: false },
    commands1000: { type: Boolean, default: false },
  },
  rewards: {
    vote5Premium: { type: Boolean, default: false },
    vote10Premium: { type: Boolean, default: false },
    vote25Premium: { type: Boolean, default: false },
    vote50Premium: { type: Boolean, default: false },
    vote100Premium: { type: Boolean, default: false },
  },
}, { timestamps: true });

UserSchema.statics.applyProgressMilestones = async function(userId, changes = {}) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return { unlockedBadges: [], grantedRewards: [] };
  }

  const incrementCommands = toPositiveInteger(changes.incrementCommands);
  const incrementVotes = toPositiveInteger(changes.incrementVotes);
  const incrementSongs = toPositiveInteger(changes.incrementSongs);
  const incrementListenTimeMs = toPositiveInteger(changes.incrementListenTimeMs);

  const inc = {};
  if (incrementCommands > 0) inc.count = incrementCommands;
  if (incrementVotes > 0) inc.totalVotes = incrementVotes;
  if (incrementSongs > 0) inc.songsListened = incrementSongs;
  if (incrementListenTimeMs > 0) inc.totalListenTimeMs = incrementListenTimeMs;

  if (Object.keys(inc).length === 0) {
    return { unlockedBadges: [], grantedRewards: [] };
  }

  let doc = await this.findOneAndUpdate(
    { userId: normalizedUserId },
    {
      $inc: inc,
      $setOnInsert: { userId: normalizedUserId },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).catch(() => null);

  if (!doc) {
    return { unlockedBadges: [], grantedRewards: [] };
  }

  const touchedMetrics = new Set();
  if (incrementVotes > 0) touchedMetrics.add("votes");
  if (incrementSongs > 0) touchedMetrics.add("songs");
  if (incrementCommands > 0) touchedMetrics.add("commands");

  const progress = getMetricTotals(doc);
  const unlockedBadges = [];
  const grantedRewards = [];
  const badgeSetOps = {};

  for (const [badgeKey, definition] of Object.entries(BADGE_CATALOG)) {
    if (!touchedMetrics.has(definition.metric)) continue;
    if ((doc?.milestones?.[badgeKey]) === true) continue;
    if ((progress[definition.metric] || 0) < definition.threshold) continue;

    badgeSetOps[`milestones.${badgeKey}`] = true;
    unlockedBadges.push(badgeKey);
  }

  if (Object.keys(badgeSetOps).length > 0) {
    await this.updateOne({ userId: normalizedUserId }, { $set: badgeSetOps }).catch(() => {});
    doc = doc.toObject();
    doc.milestones = { ...(doc.milestones || {}) };
    for (const badgeKey of unlockedBadges) {
      doc.milestones[badgeKey] = true;
    }
  }

  const rewardSetOps = {};
  for (const [rewardKey, definition] of Object.entries(REWARD_CATALOG)) {
    if (!touchedMetrics.has(definition.metric)) continue;
    if ((doc?.rewards?.[rewardKey]) === true) continue;
    if ((progress[definition.metric] || 0) < definition.threshold) continue;

    const rewardResult = await grantTimedUserPremiumWindow(normalizedUserId, {
      durationMs: definition.durationMs,
      permanent: Boolean(definition.permanent),
      now: Date.now(),
      planType: definition.label || "Milestone Reward",
    }).catch(() => ({ status: "error" }));

    if (!rewardResult || rewardResult.status === "invalid_user" || rewardResult.status === "invalid_duration" || rewardResult.status === "error") {
      continue;
    }

    rewardSetOps[`rewards.${rewardKey}`] = true;
    grantedRewards.push(rewardKey);
  }

  if (Object.keys(rewardSetOps).length > 0) {
    await this.updateOne({ userId: normalizedUserId }, { $set: rewardSetOps }).catch(() => {});
  }

  return { unlockedBadges, grantedRewards, progress };
};

const UserModel = mongoose.model("user", UserSchema);
UserModel.BADGE_CATALOG = BADGE_CATALOG;
UserModel.REWARD_CATALOG = REWARD_CATALOG;

module.exports = UserModel;
