module.exports = async (client, player, track, payload) => {
    try {
        const msg = player.get(`playingsongmsg`);
        if (msg) await msg.delete().catch(() => {});
    } catch (e) {}
    
    const autoplay = player.get("autoplay");
    if (autoplay === true) {
        try {
            const requester = player.get("requester");
            if (!requester) return;
            
            const currentTrack = player.queue.current;
            if (!currentTrack || !currentTrack.identifier) return;
            
            const identifier = currentTrack.identifier;
            const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
            const res = await player.search(search, requester);
            
            if (res && res.tracks && res.tracks.length > 0) {
                const trackToAdd = res.tracks[0];
                if (trackToAdd) {
                    player.queue.add(trackToAdd);
                }
            }
        } catch (error) {
            console.error('[ERROR] trackEnd autoplay:', error.message);
        }
    }
};