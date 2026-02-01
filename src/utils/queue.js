/**
 * Normalize access to various Lavalink player queue shapes and return an array
 * of track objects. Handles different implementations that expose `size`,
 * `totalSize`, indexed access, `.items`, or iterators.
 * @param {object} player
 * @returns {Array}
 */
const safePlayer = require('./safePlayer');

function getQueueArray(player) {
  if (!player) return [];
  if (typeof safePlayer.getQueueArray === 'function') return safePlayer.getQueueArray(player);
  return [];
}

module.exports = { getQueueArray };
