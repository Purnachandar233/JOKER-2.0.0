// WeakMap to hold fallback queues for players when the lavalink `player.queue`
// object is not present. Using WeakMap prevents us from mutating lavalink
// internals and avoids memory leaks when players are garbage-collected.
const fallbackQueues = new WeakMap();

function getQueueObj(player) {
  if (!player) return null;
  if (player.queue) return player.queue;
  let fb = fallbackQueues.get(player);
  if (!fb) {
    fb = { tracks: [], previous: null, current: null, items: [] };
    fallbackQueues.set(player, fb);
  }
  return fb;
}

module.exports = {
  async safeCall(player, method, ...args) {
    try {
      if (!player) return false;
      const fn = player[method];
      if (typeof fn !== 'function') return false;

      // Execute the player's method but don't wait indefinitely — race with timeout.
      const callPromise = Promise.resolve(fn.apply(player, args)).catch(err => {
        // Surface for downstream handling but swallow here to avoid unhandled rejections
        throw err;
      });

      // Use longer timeouts for network-heavy operations
      // setVolume is particularly important as it's called frequently
      let timeoutMs = 3000;
      if (method === 'setVolume') {
        timeoutMs = 10000; // Extra long timeout for volume operations
      } else if (['destroy', 'updatePlayer', 'play', 'connect'].includes(method)) {
        timeoutMs = 8000; // Long timeout for critical operations
      }

      let res;
      try {
        res = await Promise.race([
          callPromise,
          new Promise((_r, rej) => setTimeout(() => {
            const err = new Error('safeCall: timeout');
            err.method = method;
            rej(err);
          }, timeoutMs))
        ]);
        return res;
      } catch (err) {
        const msg = (err && (err.message || err.toString())) || '';
        if (/already paused|not able to pause|already destroyed/i.test(msg)) {
          try { console.warn(`safePlayer.${method} warning:`, msg); } catch (e) {}
        } else if (/timeout/i.test(msg) || msg.includes('TimeoutError') || msg.includes('safeCall: timeout')) {
          try { console.warn(`safePlayer.${method} timeout after ${timeoutMs}ms (Lavalink node may be slow):`, msg); } catch (e) {}
        } else {
          try { console.error(`safePlayer.${method} error:`, err); } catch (e) {}
        }
        return false;
      }
    } catch (err) {
      try { console.error(`safePlayer.${method} unexpected error:`, err); } catch (e) {}
      return false;
    }
  },
  async queueAdd(player, tracks) {
    try {
      if (!player) return false;
      const q = getQueueObj(player);
      if (!q) return false;
      if (!q) return false;

      // If the underlying queue object exposes an add method, prefer it.
      if (q && typeof q.add === 'function') {
        try {
          if (Array.isArray(tracks)) {
            for (const t of tracks) {
              try { q.add(t); } catch (e) { /* continue */ }
            }
          } else {
            try { q.add(tracks); } catch (e) { /* continue */ }
          }
        } catch (e) {
          // ignore and fall through to array push fallback
        }
      }

      // Fallback: ensure tracks are appended into internal arrays when
      // implementations don't populate them via `add`. Avoid pushing exact
      // duplicates by checking a stable identifier.
      if (!Array.isArray(q.tracks)) q.tracks = [];
      const idFor = (t) => {
        if (!t) return null;
        const id = t?.info?.identifier || t?.identifier || t?.id || t?.uri || null;
        if (id) return String(id);
        const title = t?.info?.title || t?.title || '';
        const dur = t?.info?.duration || t?.duration || 0;
        if (title) return `title:${String(title).slice(0,200)}|dur:${dur}`;
        return null;
      };

      // If q.tracks exists, push non-duplicates there
      if (q && q.tracks && Array.isArray(q.tracks)) {
        const present = new Set(q.tracks.map(idFor).filter(Boolean));
        if (Array.isArray(tracks)) {
          for (const t of tracks) {
            const tid = idFor(t);
            if (tid && present.has(tid)) continue;
            q.tracks.push(t);
            present.add(tid);
          }
        } else {
          const tid = idFor(tracks);
          if (!tid || !present.has(tid)) q.tracks.push(tracks);
        }
        // Mirror into items if present
        try {
          if (q.items && !Array.isArray(q.items)) q.items = [];
          if (q.items && Array.isArray(q.items)) {
            const presentItems = new Set(q.items.map(idFor).filter(Boolean));
            if (Array.isArray(tracks)) {
              for (const t of tracks) {
                const tid = idFor(t);
                if (tid && presentItems.has(tid)) continue;
                q.items.push(t);
                presentItems.add(tid);
              }
            } else {
              const tid = idFor(tracks);
              if (!tid || !presentItems.has(tid)) q.items.push(tracks);
            }
          }
        } catch (e) {
          console.error('safePlayer.queueAdd items fallback error:', e && (e.message || e));
        }
        return true;
      }

      // If there's a tracks array (lavalink queue shape), push into it.
      if (q && q.tracks && Array.isArray(q.tracks)) {
        if (Array.isArray(tracks)) q.tracks.push(...tracks);
        else q.tracks.push(tracks);
        // mirror into items if present
        try { if (q.items && Array.isArray(q.items)) { if (Array.isArray(tracks)) q.items.push(...tracks); else q.items.push(tracks); } } catch(e) {}
        return true;
      }

      // If there's an items array available, push into it.
      if (q && q.items && Array.isArray(q.items)) {
        if (Array.isArray(tracks)) q.items.push(...tracks);
        else q.items.push(tracks);
        return true;
      }

      return false;
    } catch (err) {
      console.error('safePlayer.queueAdd error:', err && (err.stack || err.message || err));
      return false;
    }
  },
  queueRemove(player, start, end) {
    try {
      const q = getQueueObj(player);
      if (!q) return false;
      if (typeof q.remove === 'function') return q.remove(start, end);

      // Fallback for simple items array
      if (Array.isArray(q.items)) return q.items.splice(start, (end - start) + 1);
      return false;
    } catch (err) {
      console.error('safePlayer.queueRemove error:', err && (err.stack || err.message || err));
      return false;
    }
  },
  queueShuffle(player) {
    try {
      const q = getQueueObj(player);
      if (!q) return false;
      if (typeof q.shuffle === 'function') return q.shuffle();

      if (Array.isArray(q.items)) {
        for (let i = q.items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [q.items[i], q.items[j]] = [q.items[j], q.items[i]];
        }
        return q.items;
      }
      return false;
    } catch (err) {
      console.error('safePlayer.queueShuffle error:', err && (err.stack || err.message || err));
      return false;
    }
  },
  queueClear(player) {
    try {
      const q = getQueueObj(player);
      if (!q) return false;
      if (typeof q.clear === 'function') return q.clear();
      if (Array.isArray(q.items)) { q.items.length = 0; }
      if (Array.isArray(q.tracks)) { q.tracks.length = 0; }
      if (Array.isArray(q.previous)) { q.previous.length = 0; }
      return true;
    } catch (err) {
      console.error('safePlayer.queueClear error:', err && (err.stack || err.message || err));
      return false;
    }
  },
  queueSize(player) {
    try {
      const q = getQueueObj(player);
      if (!q) return 0;
      if (typeof q.size === 'number') return q.size;
      if (typeof q.totalSize === 'number') return q.totalSize;
      if (Array.isArray(q.items)) return q.items.length;
      if (Array.isArray(q.tracks)) return q.tracks.length;
      return 0;
    } catch (err) {
      return 0;
    }
  },
  getQueueArray(player) {
    try {
      const q = getQueueObj(player);
      if (!q) return [];

      // If lavalink provides current track separately, include it first
      const result = [];
      const cur = q.current || (typeof player.get === 'function' ? player.get('lastTrack') : null);
      // helper to compute a stable id for deduplication
      const idFor = (t) => {
        if (!t) return null;
        const id = t?.info?.identifier || t?.identifier || t?.id || t?.uri || null;
        if (id) return String(id);
        const title = t?.info?.title || t?.title || '';
        const dur = t?.info?.duration || t?.duration || 0;
        if (title) return `title:${String(title).slice(0,200)}|dur:${dur}`;
        return null;
      };

      const seen = new Set();
      if (cur) {
        result.push(cur);
        const curId = idFor(cur);
        if (curId) seen.add(curId);
      }

      // Prefer items, then tracks
      const list = Array.isArray(q.items) && q.items.length ? q.items.slice() : (Array.isArray(q.tracks) && q.tracks.length ? q.tracks.slice() : []);

      // Append items/tracks but avoid duplicating entries already seen
      for (const t of list) {
        const tid = idFor(t);
        if (tid && seen.has(tid)) continue;
        if (tid) seen.add(tid);
        result.push(t);
      }
      if (result.length) return result;
      if (typeof q.values === 'function') {
        try { return Array.from(q.values()).filter(Boolean); } catch (e) {
        console.error('safePlayer.getQueueArray Array.from error:', e && (e.message || e));
      }
      }
      const numericKeys = Object.keys(q).filter(k => /^[0-9]+$/.test(k)).sort((a,b)=>a-b);
      if (numericKeys.length) return numericKeys.map(k => q[k]).filter(Boolean);
      return [];
    } catch (err) {
      return [];
    }
  },
  async safeDestroy(player) {
    try {
      // Call destroy but don't wait indefinitely — race with a timeout.
      const destroyPromise = Promise.resolve(this.safeCall(player, 'destroy'))
        .catch(err => {
      try { console.error('safePlayer.destroy internal error:', err); } catch (e) {}
          return false;
        });

      // Attach a catcher to log any unhandled rejections if we time out
      destroyPromise.catch(err => {
        try {
          console.warn('safePlayer.destroy promise error:', err && (err.stack || err.message || err));
        } catch (e) {}
      });

      const timeoutMs = 5000;
      const res = await Promise.race([
        destroyPromise,
        new Promise(resolve => setTimeout(() => resolve(false), timeoutMs))
      ]);

      if (res === false) {
        try { console.warn('safePlayer.safeDestroy: destroy timed out or failed'); } catch (e) {}
      }
      return res;
    } catch (err) {
      console.error('safePlayer.safeDestroy error:', err && (err.stack || err.message || err));
      return false;
    }
  },
  async safeStop(player) {
    try {
      const stopped = await this.safeCall(player, 'stop');
      if (stopped) return true;

      // Only attempt to skip if there are tracks in queue
      const queueSize = this.queueSize(player);
      if (queueSize > 0) {
        const skipped = await this.safeCall(player, 'skip');
        if (skipped) return true;
      }

      return await this.safeDestroy(player);
    } catch (err) {
      try { console.error('safePlayer.safeStop error:', err); } catch (e) {}
      return false;
    }
  },
  async safeSetVolume(player, volume) {
    try {
      if (!player || typeof volume !== 'number') return false;

      // Try setvolume with retry logic
      let result = await this.safeCall(player, 'setVolume', volume);

      // If first attempt timed out, wait a moment and retry
      if (!result) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          result = await this.safeCall(player, 'setVolume', volume);
        } catch (e) {
          console.warn('safePlayer.safeSetVolume retry failed:', e?.message);
        }
      }

      return result || false;
    } catch (err) {
      console.error('safePlayer.safeSetVolume error:', err);
      return false;
    }
  }
};
