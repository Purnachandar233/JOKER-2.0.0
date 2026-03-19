const Premium = require("../schema/Premium");
const TOPGG_VOTE_WINDOW_MS = 12 * 60 * 60 * 1000;
const parsedCacheMs = Number(process.env.TOPGG_FALLBACK_CACHE_MS || 60000);
const TOPGG_FALLBACK_CACHE_MS = Number.isFinite(parsedCacheMs) && parsedCacheMs > 0 ? parsedCacheMs : 60000;
const topggVoteCache = new Map();

function isPremiumActive(doc, now = Date.now()) {
  if (!doc) return false;
  if (doc.Permanent) return true;
  const expireAt = Number(doc.Expire || 0);
  return expireAt > now;
}

async function cleanupExpiredPremium(doc, now = Date.now()) {
  if (!doc || doc.Permanent) return;
  const expireAt = Number(doc.Expire || 0);
  if (expireAt > now) return;
  await doc.deleteOne().catch(() => {});
}

function getCachedVoteState(userId, now = Date.now()) {
  const key = String(userId);
  const cached = topggVoteCache.get(key);
  if (!cached) return null;
  if (now - cached.checkedAt > TOPGG_FALLBACK_CACHE_MS) {
    topggVoteCache.delete(key);
    return null;
  }
  return cached.voted;
}

function setCachedVoteState(userId, voted, now = Date.now()) {
  topggVoteCache.set(String(userId), { voted: Boolean(voted), checkedAt: now });
}

async function checkTopggVoteFallback(client, userId, now = Date.now()) {
  if (!client?.topgg || typeof client.topgg.hasVoted !== "function") return false;

  const cached = getCachedVoteState(userId, now);
  if (cached !== null) return cached;

  try {
    const voted = Boolean(await client.topgg.hasVoted(String(userId)));
    setCachedVoteState(userId, voted, now);
    return voted;
  } catch (_err) {
    return false;
  }
}

async function resolvePremiumAccess(userId, guildId, client = null) {
  const now = Date.now();
  const normalizedUserId = userId ? String(userId) : null;
  const normalizedGuildId = guildId ? String(guildId) : null;

  const [userDoc, guildDoc] = await Promise.all([
    normalizedUserId
      ? Premium.findOne({ Id: normalizedUserId, Type: "user" }).catch(() => null)
      : Promise.resolve(null),
    normalizedGuildId
      ? Premium.findOne({ Id: normalizedGuildId, Type: "guild" }).catch(() => null)
      : Promise.resolve(null)
  ]);

  let userPremium = isPremiumActive(userDoc, now);
  const guildPremium = isPremiumActive(guildDoc, now);

  if (!userPremium) await cleanupExpiredPremium(userDoc, now);
  if (!guildPremium) await cleanupExpiredPremium(guildDoc, now);

  let topggFallbackVoted = false;
  if (!userPremium && normalizedUserId) {
    topggFallbackVoted = await checkTopggVoteFallback(client, normalizedUserId, now);
    if (topggFallbackVoted) {
      userPremium = true;

      // Backfill DB window when webhook was missed, so later checks stay local.
      await Premium.findOneAndUpdate(
        { Id: normalizedUserId, Type: "user" },
        {
          Id: normalizedUserId,
          Type: "user",
          Permanent: false,
          Expire: now + TOPGG_VOTE_WINDOW_MS
        },
        { upsert: true }
      ).catch(() => {});
    }
  }

  return {
    userDoc,
    guildDoc,
    userPremium,
    guildPremium,
    topggFallbackVoted,
    hasAccess: userPremium || guildPremium
  };
}

module.exports = {
  isPremiumActive,
  resolvePremiumAccess
};
