const Premium = require("../schema/Premium");
const TOPGG_VOTE_WINDOW_MS = 12 * 60 * 60 * 1000;
const parsedCacheMs = Number(process.env.TOPGG_FALLBACK_CACHE_MS || 60000);
const TOPGG_FALLBACK_CACHE_MS = Number.isFinite(parsedCacheMs) && parsedCacheMs > 0 ? parsedCacheMs : 60000;
const topggVoteCache = new Map();

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUserId(userId) {
  const value = String(userId || "").trim();
  return value || null;
}

function calculateMergedVoteExpire(existingDoc, now = Date.now()) {
  const existingExpire = Math.max(0, toNumber(existingDoc?.Expire, 0));
  const voteWindowExpire = now + TOPGG_VOTE_WINDOW_MS;
  return Math.max(existingExpire, voteWindowExpire);
}

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

async function grantVotePremiumWindow(userId, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) {
    return { status: "invalid_user", expire: 0, permanent: false };
  }

  const existing = await Premium.findOne({ Id: normalizedUserId, Type: "user" }).catch(() => null);

  if (existing?.Permanent) {
    return {
      status: "kept_permanent",
      expire: Math.max(0, toNumber(existing.Expire, 0)),
      permanent: true,
    };
  }

  const nextExpire = calculateMergedVoteExpire(existing, now);
  const previousExpire = Math.max(0, toNumber(existing?.Expire, 0));

  if (existing && nextExpire <= previousExpire) {
    return {
      status: "unchanged",
      expire: previousExpire,
      permanent: false,
    };
  }

  await Premium.findOneAndUpdate(
    { Id: normalizedUserId, Type: "user" },
    {
      $set: {
        Expire: nextExpire,
        Permanent: false,
      },
      $setOnInsert: {
        Id: normalizedUserId,
        Type: "user",
        ActivatedAt: now,
        PlanType: "Standard",
      },
    },
    { upsert: true }
  ).catch(() => {});

  return {
    status: existing ? "extended" : "created",
    expire: nextExpire,
    permanent: false,
  };
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
      await grantVotePremiumWindow(normalizedUserId, { now }).catch(() => {});
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
  grantVotePremiumWindow,
  isPremiumActive,
  resolvePremiumAccess
};
