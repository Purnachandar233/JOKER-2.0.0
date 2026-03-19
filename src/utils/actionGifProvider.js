const ACTION_ENDPOINTS = Object.freeze({
  hug: "https://api.waifu.pics/sfw/hug",
  kiss: "https://api.waifu.pics/sfw/kiss",
  cuddle: "https://api.waifu.pics/sfw/cuddle",
  pat: "https://api.waifu.pics/sfw/pat",
  highfive: "https://api.waifu.pics/sfw/highfive",
  happy: "https://api.waifu.pics/sfw/happy",
  slap: "https://api.waifu.pics/sfw/slap",
  bonk: "https://api.waifu.pics/sfw/bonk"
});

const FALLBACK_GIFS = Object.freeze({
  hug: [
    "https://i.waifu.pics/hvmqZ4H.gif",
    "https://i.waifu.pics/S7HrqqC.gif",
    "https://i.waifu.pics/_5gCZMa.gif",
    "https://i.waifu.pics/hl7ZFQ2.gif",
    "https://i.waifu.pics/SdoexEO.gif"
  ],
  kiss: [
    "https://i.waifu.pics/s2vaEPB.gif",
    "https://i.waifu.pics/Nz~~57H.gif",
    "https://i.waifu.pics/AdAV2Pz.gif",
    "https://i.waifu.pics/7Rp0WDH.gif",
    "https://i.waifu.pics/cN4wUO6.gif"
  ],
  cuddle: [
    "https://i.waifu.pics/SWs69XJ.gif",
    "https://i.waifu.pics/UAkc3_y.gif",
    "https://i.waifu.pics/gl3~Tb4.gif",
    "https://i.waifu.pics/~XVQpk0.gif",
    "https://i.waifu.pics/WSLUoer.gif"
  ],
  pat: [
    "https://i.waifu.pics/4z7nzIy.gif",
    "https://i.waifu.pics/S-Zv~-w.gif",
    "https://i.waifu.pics/Z5pp~gx.gif",
    "https://i.waifu.pics/fyGPXe_.gif",
    "https://i.waifu.pics/esNCuKp.gif"
  ],
  highfive: [
    "https://i.waifu.pics/qGP4M1L.gif",
    "https://i.waifu.pics/NUusyu4.gif",
    "https://i.waifu.pics/UPcalVj.gif",
    "https://i.waifu.pics/gJaFVbX.gif",
    "https://i.waifu.pics/~VszWlE.gif"
  ],
  happy: [
    "https://i.waifu.pics/HgmErDD.gif",
    "https://i.waifu.pics/ll1i0po.gif",
    "https://i.waifu.pics/XxWZu_I.gif",
    "https://i.waifu.pics/M4kkraV.gif",
    "https://i.waifu.pics/vgmgptj.gif"
  ],
  slap: [
    "https://i.waifu.pics/JOKXwLd.gif",
    "https://i.waifu.pics/QFGN4vE.gif",
    "https://i.waifu.pics/mXj8i8S.gif",
    "https://i.waifu.pics/Q9-IX~O.gif",
    "https://i.waifu.pics/28V06Sq.gif"
  ],
  bonk: [
    "https://i.waifu.pics/yA9Tv9O.gif",
    "https://i.waifu.pics/NJo1_Fd.gif",
    "https://i.waifu.pics/RVJv71M.gif",
    "https://i.waifu.pics/35fhCi8.gif",
    "https://i.waifu.pics/D5LKEXC.gif"
  ],
  romance: [
    "https://i.waifu.pics/s2vaEPB.gif",
    "https://i.waifu.pics/Nz~~57H.gif",
    "https://i.waifu.pics/AdAV2Pz.gif",
    "https://i.waifu.pics/SWs69XJ.gif",
    "https://i.waifu.pics/UAkc3_y.gif",
    "https://i.waifu.pics/hvmqZ4H.gif",
    "https://i.waifu.pics/S7HrqqC.gif",
    "https://i.waifu.pics/_5gCZMa.gif"
  ]
});

function getRandomItem(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

async function fetchAnimeGif(action) {
  const endpoint = ACTION_ENDPOINTS[action];
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return null;

    const data = await response.json();
    const url = typeof data?.url === "string" ? data.url : null;
    if (!url || !/^https?:\/\//i.test(url)) return null;
    if (!/\.gif(\?|$)/i.test(url)) return null;
    return url;
  } catch {
    return null;
  }
}

async function getActionGif(action, fallbackKey = action) {
  const apiGif = await fetchAnimeGif(action);
  if (apiGif) return apiGif;

  const fallbackPool =
    FALLBACK_GIFS[fallbackKey] ||
    FALLBACK_GIFS[action] ||
    FALLBACK_GIFS.romance;

  return getRandomItem(fallbackPool);
}

module.exports = {
  getActionGif
};
