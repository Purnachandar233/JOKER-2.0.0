const config = require('../../config.json');

module.exports = function getEmbedColor(ctx) {
  try {
    if (!ctx) return config.embedColor || '#ff0051';
    if (ctx.client && ctx.client.embedColor) return ctx.client.embedColor;
    if (ctx.embedColor) return ctx.embedColor;
    if (global?.client && global.client.embedColor) return global.client.embedColor;
  } catch (e) {}
  return config.embedColor || '#ff0051';
};
