// SPDX-License-Identifier: MIT
// The AI that sketches: Sketch-RNN from Google Magenta. It draws like a person, stroke by stroke.
// It learned from the drawings of the game Quick, Draw!, one small model (about 3 MB) for each thing.
// The library and each model are loaded only when they are needed.
// The library is a copy on our own server. The models come straight from Google, see lib/NOTICE.txt.

import { maxStrokes } from "./validate.js";

const library = "lib/magentasketch.min.js";
const modelUrl = "https://storage.googleapis.com/quickdraw-models/sketchRNN/models/";

// The things it can draw.
export const categories = [
  "alarm_clock", "ambulance", "angel", "ant", "backpack", "barn", "basket", "bat", "bear", "bee",
  "bicycle", "bird", "book", "brain", "bridge", "bulldozer", "bus", "butterfly", "cactus", "cake",
  "calendar", "cannon", "castle", "cat", "chair", "computer", "couch", "crab", "cruise_ship", "diamond",
  "diving_board", "dog", "dolphin", "duck", "elephant", "eye", "face", "fan", "fire_hydrant", "firetruck",
  "flamingo", "flower", "frog", "garden", "hand", "hedgehog", "helicopter", "hot_air_balloon", "jail",
  "kangaroo", "key", "lantern", "lighthouse", "lion", "lobster", "map", "mermaid", "monkey", "mosquito",
  "octopus", "owl", "paintbrush", "palm_tree", "parrot", "passport", "peas", "penguin", "pig", "pineapple",
  "pool", "postcard", "power_outlet", "purse", "rabbit", "radio", "rain", "rhinoceros", "roller_coaster",
  "sandwich", "scorpion", "sea_turtle", "sheep", "skull", "smiley_face", "snail", "snowflake",
  "soccer_ball", "speedboat", "spider", "squirrel", "steak", "stop_sign", "stove", "strawberry", "sun",
  "swan", "swing_set", "tiger", "toothbrush", "toothpaste", "tractor", "trombone", "truck", "whale",
  "windmill", "yoga"
];

let loading = null;
const models = new Map();

// The library is a normal script with TensorFlow.js inside. It puts itself into window.ms.
function loadLibrary() {
  if (!loading) {
    loading = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = library;
      script.onload = function () { resolve(window.ms); };
      script.onerror = function () { reject(new Error("could not load Sketch-RNN")); };
      document.head.appendChild(script);
    });
    loading.catch(function () { loading = null; });
  }
  return loading;
}

function modelFor(category) {
  if (!models.has(category)) {
    const model = loadLibrary().then(async function (ms) {
      const m = new ms.SketchRNN(modelUrl + category + ".gen.json");
      await m.initialize();
      m.setPixelFactor(1.0);
      return m;
    });
    models.set(category, model);
    model.catch(function () { models.delete(category); });
  }
  return models.get(category);
}

// A sketch as strokes for a drawn look, in the box from -35 to 35.
// Each sketch is a little different. A low temperature makes cleaner lines.
export async function sketch(category, color) {
  if (!categories.includes(category)) throw new Error("can not sketch " + category);
  const model = await modelFor(category);

  // The model gives moves (dx, dy) and the pen: down, lifted after this point, or the end.
  let state = model.update(model.zeroInput(), model.zeroState());
  const lines = [[[0, 0]]];
  let x = 0;
  let y = 0;
  for (let i = 0; i < 300; i++) {
    const step = model.sample(model.getPDF(state, 0.25));
    x += step[0];
    y += step[1];
    lines[lines.length - 1].push([x, y]);
    if (step[4] === 1) break;
    if (step[3] === 1) lines.push([]);
    state = model.update(step, state);
  }

  // Fit the sketch into the box.
  const points = lines.flat();
  const xs = points.map(function (p) { return p[0]; });
  const ys = points.map(function (p) { return p[1]; });
  const middleX = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
  const middleY = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
  const scale = 70 / Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys), 1);
  const half = function (n) { return Math.round(n * 2) / 2; };

  return lines.filter(function (line) { return line.length > 0; }).slice(0, maxStrokes).map(function (line) {
    return {
      color: color,
      width: 2,
      points: line.map(function (p) { return [half((p[0] - middleX) * scale), half((p[1] - middleY) * scale)]; })
    };
  });
}
