(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DMA40Timeline = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FPS = 50;
  const DURATION = 330.58;
  const CHAPTERS = [
  {
    "title": "Opening: cube",
    "start_seconds": 0,
    "end_seconds": 1.48
  },
  {
    "title": "Opening: DMA logo",
    "start_seconds": 1.48,
    "end_seconds": 3.98
  },
  {
    "title": "Opening: bobs",
    "start_seconds": 3.98,
    "end_seconds": 8.98
  },
  {
    "title": "Opening: rasters",
    "start_seconds": 8.98,
    "end_seconds": 13.98
  },
  {
    "title": "Opening: chrome scroll",
    "start_seconds": 13.98,
    "end_seconds": 31.66
  },
  {
    "title": "Union transition: four demos",
    "start_seconds": 31.66,
    "end_seconds": 36.66
  },
  {
    "title": "Four demos and traveling sprites",
    "start_seconds": 36.66,
    "end_seconds": 68.66
  },
  {
    "title": "Four demos: fade to black",
    "start_seconds": 68.66,
    "end_seconds": 70.66
  },
  {
    "title": "Union transition: There Is No Spoon",
    "start_seconds": 70.66,
    "end_seconds": 75.66
  },
  {
    "title": "Vectorball flight",
    "start_seconds": 75.66,
    "end_seconds": 81.66
  },
  {
    "title": "The balls gather",
    "start_seconds": 81.66,
    "end_seconds": 85.66
  },
  {
    "title": "Vectorball spoon",
    "start_seconds": 85.66,
    "end_seconds": 87.66
  },
  {
    "title": "The metal spoon",
    "start_seconds": 87.66,
    "end_seconds": 90.66
  },
  {
    "title": "There Is No Spoon",
    "start_seconds": 90.66,
    "end_seconds": 98.66
  },
  {
    "title": "Volumetric flight",
    "start_seconds": 98.66,
    "end_seconds": 112.66
  },
  {
    "title": "Matrix rain",
    "start_seconds": 112.66,
    "end_seconds": 120.66
  },
  {
    "title": "No More Secrets",
    "start_seconds": 120.66,
    "end_seconds": 137.66
  },
  {
    "title": "The Pac-Men sweep",
    "start_seconds": 137.66,
    "end_seconds": 141.82
  },
  {
    "title": "Into the circular scroll",
    "start_seconds": 141.82,
    "end_seconds": 142.26
  },
  {
    "title": "Circular scroll and water",
    "start_seconds": 142.26,
    "end_seconds": 148.26
  },
  {
    "title": "Circular scroll, DMA and magnifier",
    "start_seconds": 148.26,
    "end_seconds": 169.54
  },
  {
    "title": "Pixels become a DeLorean",
    "start_seconds": 169.54,
    "end_seconds": 173.54
  },
  {
    "title": "The city drive",
    "start_seconds": 173.54,
    "end_seconds": 181.54
  },
  {
    "title": "Elon, does it fly?",
    "start_seconds": 181.54,
    "end_seconds": 185.04
  },
  {
    "title": "Elon's reply",
    "start_seconds": 185.04,
    "end_seconds": 188.54
  },
  {
    "title": "See you soon, Elon",
    "start_seconds": 188.54,
    "end_seconds": 192.54
  },
  {
    "title": "Preparing for flight",
    "start_seconds": 192.54,
    "end_seconds": 193.54
  },
  {
    "title": "The flying car",
    "start_seconds": 193.54,
    "end_seconds": 201.54
  },
  {
    "title": "DMA rooftops",
    "start_seconds": 201.54,
    "end_seconds": 208.54
  },
  {
    "title": "Through DMA to Noname",
    "start_seconds": 208.54,
    "end_seconds": 211.54
  },
  {
    "title": "Noname",
    "start_seconds": 211.54,
    "end_seconds": 251.54
  },
  {
    "title": "The DMA logo handoff",
    "start_seconds": 251.54,
    "end_seconds": 253.54
  },
  {
    "title": "DMA: the shared still",
    "start_seconds": 253.54,
    "end_seconds": 253.74
  },
  {
    "title": "DMA: transformation",
    "start_seconds": 253.74,
    "end_seconds": 254.04
  },
  {
    "title": "The glenz logo",
    "start_seconds": 254.04,
    "end_seconds": 256.74
  },
  {
    "title": "The falling checkerboard",
    "start_seconds": 256.74,
    "end_seconds": 258.74
  },
  {
    "title": "The point sphere",
    "start_seconds": 258.74,
    "end_seconds": 260.74
  },
  {
    "title": "The jelly enclosure",
    "start_seconds": 260.74,
    "end_seconds": 263.74
  },
  {
    "title": "The jelly drop",
    "start_seconds": 263.74,
    "end_seconds": 264.54
  },
  {
    "title": "Jelly rebound",
    "start_seconds": 264.54,
    "end_seconds": 267.74
  },
  {
    "title": "The 360-degree orbit",
    "start_seconds": 267.74,
    "end_seconds": 278.74
  },
  {
    "title": "Flocking birds",
    "start_seconds": 278.74,
    "end_seconds": 292.74
  },
  {
    "title": "The birds form a portrait",
    "start_seconds": 292.74,
    "end_seconds": 297.74
  },
  {
    "title": "The portrait rebounds",
    "start_seconds": 297.74,
    "end_seconds": 301.94
  },
  {
    "title": "The portrait settles",
    "start_seconds": 301.94,
    "end_seconds": 304.34
  },
  {
    "title": "The farewell deciphers",
    "start_seconds": 304.34,
    "end_seconds": 311.84
  },
  {
    "title": "Is the audience listening?",
    "start_seconds": 311.84,
    "end_seconds": 313.84
  },
  {
    "title": "Pi",
    "start_seconds": 313.84,
    "end_seconds": 314.54
  },
  {
    "title": "The cursor approaches",
    "start_seconds": 314.54,
    "end_seconds": 316.64
  },
  {
    "title": "Clicking pi",
    "start_seconds": 316.64,
    "end_seconds": 316.94
  },
  {
    "title": "Deciphering pi",
    "start_seconds": 316.94,
    "end_seconds": 325.58
  },
  {
    "title": "The complete pi page and musical fade",
    "start_seconds": 325.58,
    "end_seconds": 330.58
  }
];
  const SCENES = [
  {
    "key": "opening",
    "start_seconds": 0,
    "end_seconds": 31.66
  },
  {
    "key": "four-loader",
    "start_seconds": 31.66,
    "end_seconds": 36.66
  },
  {
    "key": "four",
    "start_seconds": 36.66,
    "end_seconds": 68.66
  },
  {
    "key": "four-fade",
    "start_seconds": 68.66,
    "end_seconds": 70.66
  },
  {
    "key": "spoon-loader",
    "start_seconds": 70.66,
    "end_seconds": 75.66
  },
  {
    "key": "vectorballs",
    "start_seconds": 75.66,
    "end_seconds": 90.66
  },
  {
    "key": "spoon",
    "start_seconds": 90.66,
    "end_seconds": 98.66
  },
  {
    "key": "flight",
    "start_seconds": 98.66,
    "end_seconds": 112.66
  },
  {
    "key": "matrix",
    "start_seconds": 112.66,
    "end_seconds": 120.66
  },
  {
    "key": "secrets",
    "start_seconds": 120.66,
    "end_seconds": 137.66
  },
  {
    "key": "pacmen",
    "start_seconds": 137.66,
    "end_seconds": 141.82
  },
  {
    "key": "circle",
    "start_seconds": 141.82,
    "end_seconds": 169.54
  },
  {
    "key": "city",
    "start_seconds": 169.54,
    "end_seconds": 211.54
  },
  {
    "key": "noname",
    "start_seconds": 211.54,
    "end_seconds": 251.54
  },
  {
    "key": "handoff",
    "start_seconds": 251.54,
    "end_seconds": 253.74
  },
  {
    "key": "jelly",
    "start_seconds": 253.74,
    "end_seconds": 278.74
  },
  {
    "key": "flock",
    "start_seconds": 278.74,
    "end_seconds": 304.34
  },
  {
    "key": "greeting",
    "start_seconds": 304.34,
    "end_seconds": 313.84
  },
  {
    "key": "pi",
    "start_seconds": 313.84,
    "end_seconds": 330.58
  },
  {
    "key": "complete",
    "start_seconds": 330.58,
    "end_seconds": 330.58
  }
];

  const clampTime = value => Math.max(0, Math.min(DURATION, Number(value) || 0));
  function findAt(entries, seconds) {
    const time = clampTime(seconds);
    return entries.find((entry, index) => time >= entry.start_seconds && (time < entry.end_seconds || index === entries.length - 1));
  }
  const chapterAt = seconds => findAt(CHAPTERS, seconds);
  const sceneAt = seconds => findAt(SCENES, seconds);
  function nextSceneTime(seconds) {
    const current = sceneAt(seconds);
    if (!current) return 0;
    return current.key === "complete" ? 0 : Math.min(DURATION, current.end_seconds + 1 / FPS);
  }
  return {FPS, DURATION, CHAPTERS, SCENES, clampTime, chapterAt, sceneAt, nextSceneTime};
});
