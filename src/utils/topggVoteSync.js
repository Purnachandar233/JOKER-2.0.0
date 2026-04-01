const Premium = require("../schema/Premium");
const User = require("../schema/User");

const TOPGG_VOTE_WINDOW_MS = 12 * 60 * 60 * 1000;
const parsedRecoveryIntervalMs = Number(process.env.TOPGG_RECOVERY_INTERVAL_MS || 5 * 60 * 1000);
const TOPGG_RECOVERY_INTERVAL_MS = Number.isFinite(parsedRecoveryIntervalMs) && parsedRecoveryIntervalMs > 0
  ? parsedRecoveryIntervalMs
  : 5 * 60 * 1000;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUserId(userId) {
  const value = String(userId || "").trim();
  return value || null;
}

function resolveTopggStatusCode(error) {
  const statusCode = Number(error?.response?.statusCode || error?.statusCode || 0);
  return Number.isFinite(statusCode) && statusCode > 0 ? statusCode : null;
}

function classifyTopggFetchFailure(error) {
  const statusCode = resolveTopggStatusCode(error);
  const errorMessage = String(error?.message || error || "Unknown Top.gg error").trim() || "Unknown Top.gg error";

  if (/missing token/i.test(errorMessage)) {
    return {
      status: "missing_token",
      retryable: false,
      errorCode: statusCode,
      errorMessage,
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      status: "auth_error",
      retryable: false,
      errorCode: statusCode,
      errorMessage,
    };
  }

  if (statusCode === 404) {
    return {
      status: "endpoint_unavailable",
      retryable: false,
      errorCode: statusCode,
      errorMessage,
    };
  }

  return {
    status: "failed",
    retryable: true,
    errorCode: statusCode,
    errorMessage,
  };
}

async function grantTopggVotePremiumWindow(userId, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const allowExtension = options.allowExtension !== false;
  const explicitExpireAt = Number(options.expireAt);
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

  const existingExpire = Math.max(0, toNumber(existing?.Expire, 0));
  if (!allowExtension && existingExpire > now) {
    return {
      status: "already_active",
      expire: existingExpire,
      permanent: false,
    };
  }

  const targetExpire = Number.isFinite(explicitExpireAt) && explicitExpireAt > 0
    ? explicitExpireAt
    : now + TOPGG_VOTE_WINDOW_MS;

  if (targetExpire <= now && existingExpire <= now) {
    return {
      status: "expired",
      expire: Math.max(0, targetExpire),
      permanent: false,
    };
  }

  const nextExpire = Math.max(existingExpire, targetExpire);
  if (existing && nextExpire <= existingExpire) {
    return {
      status: "unchanged",
      expire: existingExpire,
      permanent: false,
    };
  }

  await Premium.findOneAndUpdate(
    { Id: normalizedUserId, Type: "user" },
    {
      $set: {
        Expire: nextExpire,
        Permanent: false,
        PlanType: "Top.gg Vote",
      },
      $setOnInsert: {
        Id: normalizedUserId,
        Type: "user",
        ActivatedAt: now,
      },
    },
    { upsert: true }
  ).catch(() => {});

  return {
    status: existing ? (existingExpire > now ? "extended" : "renewed") : "created",
    expire: nextExpire,
    permanent: false,
  };
}

async function tryClaimTopggVoteRecord(userId, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const source = String(options.source || "unknown");
  const normalizedUserId = normalizeUserId(userId);

  if (!normalizedUserId) return false;

  const result = await User.updateOne(
    {
      userId: normalizedUserId,
      $or: [
        { "topgg.lastVoteRecordedAt": { $exists: false } },
        { "topgg.lastVoteRecordedAt": { $lte: now - TOPGG_VOTE_WINDOW_MS } },
      ],
    },
    {
      $setOnInsert: { userId: normalizedUserId },
      $set: {
        "topgg.lastVoteRecordedAt": now,
        "topgg.lastVoteSource": source,
      },
    },
    { upsert: true }
  ).catch(() => null);

  if (!result) return false;

  return (
    Number(result.modifiedCount || 0) > 0 ||
    Number(result.upsertedCount || 0) > 0
  );
}

function buildVoteThankYouText(result) {
  const rewardCatalog = User.REWARD_CATALOG || {};
  const rewardLabels = Array.isArray(result?.milestoneUpdate?.grantedRewards)
    ? result.milestoneUpdate.grantedRewards
        .map((key) => rewardCatalog[key]?.label)
        .filter(Boolean)
    : [];
  const rewardNote = rewardLabels.length
    ? `\nMilestone reward unlocked: ${rewardLabels.join(", ")}.`
    : "";
  const badgeCount = Array.isArray(result?.milestoneUpdate?.unlockedBadges)
    ? result.milestoneUpdate.unlockedBadges.length
    : 0;
  const badgeNote = badgeCount
    ? `\nNew badge${badgeCount > 1 ? "s" : ""} unlocked in your profile.`
    : "";
  const weightNote = Number(result?.voteWeight || 1) > 1
    ? `\nThis vote counted as ${Number(result.voteWeight)} votes.`
    : "";

  if (result?.voteGrant?.status === "kept_permanent") {
    return `Thank you for voting! Your permanent Premium is already active.${weightNote}${badgeNote}`;
  }

  if (String(result?.source || "").startsWith("webhook")) {
    return `Thank you for voting! You received 12 hours of Premium access!${weightNote}${rewardNote}${badgeNote}`;
  }

  return `Thank you for voting! Your Top.gg vote was recovered automatically and Premium access is now active.${weightNote}${rewardNote}${badgeNote}`;
}

async function notifyUserAboutVote(client, userId, result) {
  if (!client?.users?.fetch || !result?.recorded) return;

  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;

  const text = buildVoteThankYouText(result);
  await user.send(text).catch(() => {});
}

async function recordTopggVote(userId, options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  const source = String(options.source || "unknown");
  const fromWebhook = source.startsWith("webhook");
  const voteWeight = Math.max(1, Math.floor(Number(options.voteWeight) || 1));
  const normalizedUserId = normalizeUserId(userId);

  if (!normalizedUserId) {
    return {
      status: "invalid_user",
      recorded: false,
      recovered: false,
      voteGrant: { status: "invalid_user", expire: 0, permanent: false },
      milestoneUpdate: { unlockedBadges: [], grantedRewards: [] },
      totalVotes: 0,
      source,
    };
  }

  const recorded = await tryClaimTopggVoteRecord(normalizedUserId, { now, source });
  const voteGrant = await grantTopggVotePremiumWindow(normalizedUserId, {
    now,
    allowExtension: recorded,
    expireAt: options.expireAt,
  });
  const milestoneUpdate = recorded
    ? await User.applyProgressMilestones(normalizedUserId, {
        incrementVotes: voteWeight,
      }).catch(() => ({ unlockedBadges: [], grantedRewards: [] }))
    : { unlockedBadges: [], grantedRewards: [] };

  const userData = await User.findOne({ userId: normalizedUserId }).lean().catch(() => null);
  const result = {
    status: recorded ? "recorded" : "already_recorded",
    recorded,
    recovered: !fromWebhook && (recorded || voteGrant.status === "renewed" || voteGrant.status === "created"),
    voteGrant,
    milestoneUpdate,
    totalVotes: Number(userData?.totalVotes || 0),
    voteWeight,
    source,
  };

  if (options.notifyUser) {
    await notifyUserAboutVote(options.client, normalizedUserId, result).catch(() => {});
  }

  return result;
}

async function reconcileRecentTopggVotes(client, options = {}) {
  if (!client?.topgg || typeof client.topgg.getVotes !== "function") {
    return {
      status: "unavailable",
      processed: 0,
      recorded: 0,
      alreadyRecorded: 0,
      errors: 0,
      retryable: false,
      errorCode: null,
      errorMessage: "Top.gg vote history API is not configured.",
    };
  }

  const source = String(options.source || "reconcile");
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  let votes = null;

  try {
    votes = await client.topgg.getVotes();
  } catch (error) {
    const failure = classifyTopggFetchFailure(error);
    return {
      ...failure,
      processed: 0,
      recorded: 0,
      alreadyRecorded: 0,
      errors: 1,
    };
  }

  if (!Array.isArray(votes)) {
    return {
      status: "unexpected_response",
      processed: 0,
      recorded: 0,
      alreadyRecorded: 0,
      errors: 1,
      retryable: false,
      errorCode: null,
      errorMessage: `Unexpected Top.gg votes response type: ${typeof votes}`,
    };
  }

  let processed = 0;
  let recorded = 0;
  let alreadyRecorded = 0;
  let errors = 0;

  for (const entry of votes) {
    const userId = normalizeUserId(entry?.id || entry?.user);
    if (!userId) continue;

    processed += 1;

    try {
      const result = await recordTopggVote(userId, {
        now,
        source,
        client,
        notifyUser: false,
      });

      if (result.recorded) recorded += 1;
      else alreadyRecorded += 1;
    } catch (_err) {
      errors += 1;
    }
  }

  return {
    status: "ok",
    processed,
    recorded,
    alreadyRecorded,
    errors,
    retryable: true,
    errorCode: null,
    errorMessage: "",
  };
}

module.exports = {
  TOPGG_RECOVERY_INTERVAL_MS,
  TOPGG_VOTE_WINDOW_MS,
  grantTopggVotePremiumWindow,
  recordTopggVote,
  reconcileRecentTopggVotes,
};
