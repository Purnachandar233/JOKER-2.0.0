let chalkInstance;

try {
  const loaded = require("chalk");
  chalkInstance = loaded?.default || loaded;
} catch (_err) {
  // Fallback for environments where chalk is ESM-only or unavailable.
  const passthrough = text => String(text);
  let chain;
  chain = new Proxy(passthrough, {
    apply(_target, _thisArg, args) {
      return String(args[0] ?? "");
    },
    get() {
      return chain;
    }
  });

  chalkInstance = new Proxy({}, {
    get() {
      return chain;
    }
  });
}

module.exports = chalkInstance;
