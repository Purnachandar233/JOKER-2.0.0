const GuildFilters = require('../schema/guildFilters');

async function getFilter(guildId, name) {
  if (!guildId || !name) return false;
  try {
    const doc = await GuildFilters.findOne({ guildId }).lean();
    return !!(doc && doc.filters && doc.filters[name]);
  } catch (e) {
    return false;
  }
}

async function setFilter(guildId, name, value) {
  if (!guildId || !name) return null;
  try {
    const update = {};
    update[`filters.${name}`] = !!value;
    const doc = await GuildFilters.findOneAndUpdate(
      { guildId },
      { $set: update },
      { upsert: true, new: true }
    );
    return doc;
  } catch (e) {
    return null;
  }
}

module.exports = { getFilter, setFilter };
