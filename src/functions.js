const ms = require("ms");
const empty_begining = "[";
const emptyend = "]";
const emptyframe = "<:MW_WhiteLine:1109733643510882334>";
const filled = "<:redline:1109758438503886898>";

module.exports.duration = duration;
module.exports.createBar = createBar;
module.exports.format = format;
module.exports.arrayMove = arrayMove;

function duration(ms) {
  const sec = Math.floor((ms / 1000) % 60).toString();
  const min = Math.floor((ms / (60 * 1000)) % 60).toString();
  const hrs = Math.floor((ms / (60 * 60 * 1000)) % 60).toString();
  const days = Math.floor((ms / (24 * 60 * 60 * 1000)) % 60).toString();
  return `${days}Days,${hrs}Hours,${min}Minutes,${sec}Seconds`;
}

function createBar(player) {
  try {
    const size = 15;
    const { getQueueArray } = require('./utils/queue.js');
    const tracks = getQueueArray(player);
    if (!tracks || tracks.length === 0) return `**${empty_begining}${filled}${emptyframe.repeat(size - 1)}${emptyend}**\n**00:00:00 / 00:00:00**`;

    const currentTrack = tracks[0];
    const total = currentTrack.duration || 0;
    const current = player.position || 0;

    if (!total || currentTrack.isStream) {
      const bar = `${empty_begining}${filled}${emptyframe.repeat(size - 1)}${emptyend}`;
      return `**${bar}**\n**◉ LIVE**`;
    }

    const ratio = Math.max(0, Math.min(1, current / total));
    const leftside = Math.round(size * ratio);
    const rightside = size - leftside;
    const bar = `${empty_begining}${filled.repeat(leftside)}${emptyframe.repeat(rightside)}${emptyend}`;
    const curStr = new Date(current).toISOString().slice(11, 19);
    const totStr = new Date(total).toISOString().slice(11, 19);
    return `**${bar}**\n**${curStr} / ${totStr}**`;
  } catch (e) {
    console.error(e.stack || e);
    return `**${empty_begining}${filled}${emptyframe.repeat(14)}${emptyend}**\n**00:00:00 / 00:00:00**`;
  }
}

function format(millis) {
  try {
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const h = Math.floor(millis / 3600000);
    const m = Math.floor((millis % 3600000) / 60000);
    const s = Math.floor((millis % 60000) / 1000);
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  } catch (e) {
    console.error('Format error:', e);
    return '00:00';
  }
}

function arrayMove(array, from, to) {
  try {
    array = [...array];
    const startIndex = from < 0 ? array.length + from : from;
    if (startIndex < 0 || startIndex >= array.length) return array;
    const endIndex = to < 0 ? array.length + to : to;
    const [item] = array.splice(startIndex, 1);
    array.splice(endIndex, 0, item);
    return array;
  } catch (e) {
    console.error('Array move error:', e);
    return array;
  }
}








