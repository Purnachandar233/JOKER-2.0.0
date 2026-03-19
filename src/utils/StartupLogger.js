/**
 * Startup logger with clear, simple structure.
 */
class StartupLogger {
  constructor() {
    this.section = "GENERAL";
  }

  getTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  normalize(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  format(level, message, detail = "") {
    const cleanMessage = this.normalize(message);
    const cleanDetail = this.normalize(detail);
    const suffix = cleanDetail ? ` | ${cleanDetail}` : "";
    return `[${this.getTime()}] [${level}] [${this.section}] ${cleanMessage}${suffix}`;
  }

  emit(level, message, detail = "") {
    const line = this.format(level, message, detail);
    if (level === "ERROR") {
      console.error(line);
      return;
    }
    if (level === "WARN") {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  printBanner(botName, version) {
    this.section = "BOOT";
    this.info("Startup", `${botName} ${version}`);
  }

  sectionStart(name) {
    this.section = this.normalize(name || "GENERAL").toUpperCase();
    console.log(`\n[${this.getTime()}] [INFO] [${this.section}] ---`);
  }

  sectionEnd() {
    this.section = "GENERAL";
  }

  success(message, detail = "") {
    this.emit("INFO", message, detail);
  }

  info(message, detail = "") {
    this.emit("INFO", message, detail);
  }

  warn(message, detail = "") {
    this.emit("WARN", message, detail);
  }

  error(message, detail = "") {
    this.emit("ERROR", message, detail);
  }

  complete(message = "Startup complete") {
    this.section = "READY";
    this.emit("INFO", message);
  }

  ready(message, status = "ONLINE") {
    const level = status === "ONLINE" ? "INFO" : "WARN";
    this.emit(level, message, `status=${status}`);
  }

  criticalError(message) {
    this.emit("ERROR", message, "critical=true");
  }

  stats(title, items = {}) {
    const pairs = Object.entries(items)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    this.info(title, pairs);
  }

  divider() {
    console.log(`[${this.getTime()}] [INFO] [${this.section}] ----------------`);
  }
}

module.exports = StartupLogger;
