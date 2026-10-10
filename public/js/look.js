// SPDX-License-Identifier: MIT
// Drawing the look of an object. c is the canvas context to draw on.
// The AI only says what and where. The code makes it look good:
// a soft light from the top, a darker outline and a shadow.

import { height } from "./validate.js";
import { pose, actionsOf } from "./behavior.js";
import { drawParticles } from "./particles.js";

// A whole object as it is right now: its shadow on the ground, its look with the effects,
// its particles and its speech bubble. Used by the sandbox and by the workbench.
export function drawObject(c, o, ground) {
  const p = pose(o);
  drawParticles(c, o, true);
  if (!p.hidden) {
    // A soft shadow on the ground. It gets smaller when the object is high in the air.
    const air = Math.max(0, ground - (o.y + o.bottom) - p.dy);
    const shadow = Math.max(0.2, 1 - air / 100);
    c.fillStyle = "rgba(0, 0, 0, " + 0.12 * shadow + ")";
    c.beginPath();
    c.ellipse(o.x + p.dx, ground, o.size * 0.6 * p.scaleX * shadow, 2.5, 0, 0, Math.PI * 2);
    c.fill();

    c.save();
    c.globalAlpha = p.alpha;
    if (p.glow) {
      c.shadowColor = p.glow;
      c.shadowBlur = 15;
    }
    if (p.hue) c.filter = "hue-rotate(" + p.hue + "deg)";
    c.translate(o.x + p.dx, o.y + p.dy);
    c.rotate(p.angle);
    c.scale(p.scaleX, p.scaleY);
    drawLook(c, o);
    c.restore();
  }
  drawParticles(c, o, false);
  actionsOf(o).forEach(function (a) { if (a.do === "say") drawBubble(c, o, a.emoji); });
}

// A speech bubble with one emoji above the object.
function drawBubble(c, o, emoji) {
  const x = o.x;
  const y = Math.max(14, o.y - o.size - 14);
  c.save();
  c.fillStyle = "white";
  c.strokeStyle = "black";
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(x - 13, y - 12, 26, 24, 8);
  c.moveTo(x - 4, y + 12);
  c.lineTo(x, y + 18);
  c.lineTo(x + 4, y + 12);
  c.fill();
  c.stroke();
  c.translate(x, y);
  drawIcon(c, { emoji: emoji, size: 18 });
  c.restore();
}

export function drawLook(c, o) {
  if (o.parts) {
    o.parts.forEach(function (p) {
      drawPart(c, p, false);
      if (p.mirror) drawPart(c, p, true);
    });
  } else if (o.look.type === "icon") {
    drawIcon(c, o.look);
  } else if (o.look.type === "drawing") {
    // A drawing draws itself when it comes into the sandbox, in about one second.
    const total = o.look.strokes.reduce(function (sum, s) { return sum + s.points.length; }, 0);
    drawStrokes(c, o.look.strokes, o.time * Math.max(2, total / 60));
  }
}

// ---------- Icons ----------
// Twemoji pictures, loaded once. Until a picture is loaded,
// or if it can not load, the emoji of the system is drawn.

const twemoji = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/";
const icons = new Map();

export function drawIcon(c, look) {
  const text = look.emoji.includes("‍") ? look.emoji : look.emoji.replace(/️/g, "");
  const url = twemoji + Array.from(text).map(function (ch) { return ch.codePointAt(0).toString(16); }).join("-") + ".svg";
  let image = icons.get(url);
  if (!image) {
    image = new Image();
    image.src = url;
    icons.set(url, image);
  }
  const s = look.size;
  if (image.complete && image.naturalWidth) {
    c.drawImage(image, -s / 2, -s / 2, s, s);
  } else {
    // An emoji takes the see-through of the fill color, so the color must be solid.
    c.fillStyle = "black";
    c.font = s * 0.85 + "px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(look.emoji, 0, 0);
  }
}

// ---------- Drawings ----------

// Used for the sandbox and for the drawing pad.
// A mirrored stroke is drawn again on the other side.
// With a limit, only that many points are drawn, so the drawing can appear step by step.
export function drawStrokes(c, list, limit) {
  let left = limit === undefined ? Infinity : limit;
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const stroke of list) {
    if (left <= 0) break;
    const part = left >= stroke.points.length ? stroke : Object.assign({}, stroke, { points: stroke.points.slice(0, Math.ceil(left)) });
    left -= stroke.points.length;
    drawStroke(c, part);
    if (stroke.mirror) {
      c.save();
      c.scale(-1, 1);
      drawStroke(c, part);
      c.restore();
    }
  }
}

function drawStroke(c, stroke) {
  const p = stroke.points;
  // A rect or an ellipse needs both of its corners.
  if (stroke.shape && p.length < 2) return;
  c.strokeStyle = stroke.color;
  c.fillStyle = stroke.color;
  c.lineWidth = stroke.width;
  c.beginPath();
  if (stroke.shape === "rect") {
    c.rect(p[0][0], p[0][1], p[1][0] - p[0][0], p[1][1] - p[0][1]);
  } else if (stroke.shape === "ellipse") {
    c.ellipse((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2,
      Math.abs(p[1][0] - p[0][0]) / 2, Math.abs(p[1][1] - p[0][1]) / 2, 0, 0, Math.PI * 2);
  } else {
    p.forEach(function (point, i) {
      if (i === 0) c.moveTo(point[0], point[1]);
      c.lineTo(point[0], point[1]);
    });
    // A filled line is closed into a shape.
    if (stroke.fill) c.closePath();
  }
  if (stroke.fill) c.fill();
  c.stroke();
}

// ---------- Shapes ----------

// A mirrored part is drawn on the other side and flipped.
function drawPart(c, p, flip) {
  const w = p.width / 2;
  const h = height(p) / 2;
  c.save();
  c.translate(flip ? -p.x : p.x, p.y);
  if (flip) c.scale(-1, 1);
  c.rotate((p.rotation || 0) * Math.PI / 180);
  if (prefabs[p.shape]) {
    prefabs[p.shape](c, w, h, p.color);
  } else if (p.shape === "ring" || p.shape === "arc") {
    line(c, p.shape, w, h, p.color);
  } else {
    outline(c, p.shape, w, h, p.points);
    paint(c, p.color, w, h);
  }
  c.restore();
}

const pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
const tones = new Map();

// The color made lighter (amount > 0) or darker (amount < 0).
function tone(color, amount) {
  const key = color + "|" + amount;
  if (!tones.has(key)) {
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = color;
    pixel.fillRect(0, 0, 1, 1);
    const rgba = pixel.getImageData(0, 0, 1, 1).data;
    const target = amount > 0 ? 255 : 0;
    const mix = function (value) { return Math.round(value + (target - value) * Math.abs(amount)); };
    tones.set(key, "rgba(" + mix(rgba[0]) + "," + mix(rgba[1]) + "," + mix(rgba[2]) + "," + rgba[3] / 255 + ")");
  }
  return tones.get(key);
}

// Fill the path with light from the top and draw a darker outline.
function paint(c, color, w, h) {
  const light = c.createLinearGradient(0, -h, 0, h);
  light.addColorStop(0, tone(color, 0.35));
  light.addColorStop(1, color);
  c.fillStyle = light;
  c.fill();
  c.strokeStyle = tone(color, -0.45);
  c.lineWidth = Math.min(1, Math.min(w, h) / 3);
  c.stroke();
}

// The path of a filled shape inside its box: from -w to w and from -h to h.
function outline(c, shape, w, h, points) {
  c.beginPath();
  if (shape === "circle") c.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  if (shape === "semicircle") c.ellipse(0, h, w, h * 2, 0, Math.PI, Math.PI * 2);
  if (shape === "rect") c.rect(-w, -h, w * 2, h * 2);
  if (shape === "roundrect") c.roundRect(-w, -h, w * 2, h * 2, Math.min(w, h) / 2);
  if (shape === "triangle") { c.moveTo(0, -h); c.lineTo(w, h); c.lineTo(-w, h); }
  if (shape === "star") {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.5 : 1;
      const a = i * Math.PI / 5 - Math.PI / 2;
      c.lineTo(Math.cos(a) * w * r, Math.sin(a) * h * r);
    }
  }
  if (shape === "polygon") {
    points.forEach(function (point) { c.lineTo(point[0] * w, point[1] * h); });
  }
  if (shape === "heart") {
    c.moveTo(0, h);
    c.bezierCurveTo(-w * 0.2, h * 0.6, -w, h * 0.2, -w, -h * 0.35);
    c.bezierCurveTo(-w, -h * 0.85, -w * 0.3, -h * 1.05, 0, -h * 0.5);
    c.bezierCurveTo(w * 0.3, -h * 1.05, w, -h * 0.85, w, -h * 0.35);
    c.bezierCurveTo(w, h * 0.2, w * 0.2, h * 0.6, 0, h);
  }
  if (shape === "drop") {
    c.moveTo(0, -h);
    c.bezierCurveTo(w * 0.5, -h * 0.5, w, 0, w, h * 0.35);
    c.ellipse(0, h * 0.35, w, h * 0.65, 0, 0, Math.PI);
    c.bezierCurveTo(-w, 0, -w * 0.5, -h * 0.5, 0, -h);
  }
  // A circle with a second circle cut out on the right side.
  if (shape === "crescent") {
    const d = 0.6;
    const y = Math.sqrt(1 - d * d / 4);
    c.save();
    c.scale(w, h);
    c.arc(0, 0, 1, Math.atan2(-y, d / 2), Math.atan2(y, d / 2), true);
    c.arc(d, 0, 1, Math.atan2(y, -d / 2), Math.atan2(-y, -d / 2), false);
    c.restore();
  }
  c.closePath();
}

// Shapes that are only a line: a ring and an arc. They stay inside their box.
function line(c, shape, w, h, color) {
  const width = shape === "ring" ? Math.max(1, Math.min(w, h) / 3) : Math.max(1.5, Math.min(w / 4, h));
  c.beginPath();
  if (shape === "ring") c.ellipse(0, 0, w - width / 2, h - width / 2, 0, 0, Math.PI * 2);
  if (shape === "arc") c.ellipse(0, -h, w - width / 2, h * 2 - width / 2, 0, 0, Math.PI);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.stroke();
}

function dot(c, x, y, r, color) {
  c.save();
  c.translate(x, y);
  outline(c, "circle", r, r);
  paint(c, color, r, r);
  c.restore();
}

// Ready made parts: one part in the script, a few shapes on the screen.
const prefabs = {
  eye: function (c, w, h, color) {
    const r = Math.min(w, h);
    outline(c, "circle", w, h);
    paint(c, "white", w, h);
    dot(c, 0, 0, r * 0.6, color);
    dot(c, 0, 0, r * 0.3, "black");
    c.fillStyle = "white";
    c.beginPath();
    c.arc(-r * 0.2, -r * 0.25, r * 0.15, 0, Math.PI * 2);
    c.fill();
  },
  wheel: function (c, w, h, color) {
    const r = Math.min(w, h);
    dot(c, 0, 0, r, "#222");
    dot(c, 0, 0, r * 0.6, color);
    dot(c, 0, 0, r * 0.2, "#444");
  },
  window: function (c, w, h, color) {
    const f = Math.max(1, Math.min(w, h) * 0.2);
    outline(c, "rect", w, h);
    paint(c, color, w, h);
    outline(c, "rect", w - f, h - f);
    paint(c, "lightblue", w - f, h - f);
    // A shine in the top left corner of the glass.
    c.fillStyle = "rgba(255, 255, 255, 0.6)";
    c.beginPath();
    c.moveTo(-w + f, -h + f);
    c.lineTo(0, -h + f);
    c.lineTo(-w + f, 0);
    c.fill();
    c.fillStyle = color;
    c.fillRect(-f / 4, -h + f, f / 2, (h - f) * 2);
    c.fillRect(-w + f, -f / 4, (w - f) * 2, f / 2);
  },
  flower: function (c, w, h, color) {
    const r = Math.min(w, h);
    for (let i = 0; i < 5; i++) {
      c.save();
      c.rotate(i * Math.PI * 2 / 5);
      c.translate(0, -r * 0.5);
      outline(c, "circle", r * 0.3, r * 0.5);
      paint(c, color, r * 0.3, r * 0.5);
      c.restore();
    }
    dot(c, 0, 0, r * 0.3, "gold");
  }
};
