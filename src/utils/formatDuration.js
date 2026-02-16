function formatUnit(value, shortUnit, longUnit, verbose) {
  const safeValue = Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, "");
  if (!verbose) return `${safeValue}${shortUnit}`;
  const suffix = value === 1 ? "" : "s";
  return `${safeValue} ${longUnit}${suffix}`;
}

function formatDuration(milliseconds, options = {}) {
  const { verbose = false, secondsDecimalDigits = 0, unitCount } = options;

  const raw = Number(milliseconds);
  if (!Number.isFinite(raw)) return verbose ? "0 seconds" : "0s";

  const sign = raw < 0 ? "-" : "";
  let remaining = Math.abs(raw);

  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minuteMs = 60 * 1000;

  const days = Math.floor(remaining / dayMs);
  remaining -= days * dayMs;

  const hours = Math.floor(remaining / hourMs);
  remaining -= hours * hourMs;

  const minutes = Math.floor(remaining / minuteMs);
  remaining -= minutes * minuteMs;

  let seconds = remaining / 1000;
  const digits = Math.max(0, Number(secondsDecimalDigits) || 0);
  const factor = 10 ** digits;
  seconds = Math.floor((seconds + Number.EPSILON) * factor) / factor;
  if (digits === 0) seconds = Math.floor(seconds);

  const parts = [];

  if (days > 0) parts.push(formatUnit(days, "d", "day", verbose));
  if (hours > 0) parts.push(formatUnit(hours, "h", "hour", verbose));
  if (minutes > 0) parts.push(formatUnit(minutes, "m", "minute", verbose));

  if (seconds > 0 || parts.length === 0) {
    parts.push(formatUnit(seconds, "s", "second", verbose));
  }

  const limitedParts = typeof unitCount === "number"
    ? parts.slice(0, Math.max(1, unitCount))
    : parts;

  return sign + limitedParts.join(" ");
}

module.exports = formatDuration;
