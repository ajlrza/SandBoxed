// SPDX-License-Identifier: MIT
// Draw the look yourself.
// The pad shows the object box from -40 to 40, three pixels for each step.

import { show } from "./ui.js";
import { limit, maxStrokes, maxStrokePoints } from "./validate.js";
import { drawStrokes } from "./look.js";
import { getDraft, applyLook } from "./workbench.js";

const padBox = document.getElementById("padBox");
const pad = document.getElementById("pad");
const padCtx = pad.getContext("2d");
const penTool = document.getElementById("penTool");
const penColor = document.getElementById("penColor");
const penWidth = document.getElementById("penWidth");
const penFill = document.getElementById("penFill");
const penMirror = document.getElementById("penMirror");
const padText = document.getElementById("padText");
let strokes = [];
let stroke = null;
let erasing = false;
// Earlier drawings for Undo, and undone drawings for Redo.
let undoList = [];
let redoList = [];

export function showPad(visible) {
  padBox.hidden = !visible;
  drawPad();
}

export function getStrokes() {
  return strokes;
}

penMirror.onchange = drawPad;

// Quick colors next to the color picker.
["#000000", "#ffffff", "#9e9e9e", "#795548", "#e53935", "#fb8c00",
  "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#f48fb1"].forEach(function (color) {
  const button = document.createElement("button");
  button.className = "swatch";
  button.style.background = color;
  button.title = color;
  button.onclick = function () { penColor.value = color; };
  document.getElementById("swatches").appendChild(button);
});

function drawPad() {
  padCtx.clearRect(0, 0, pad.width, pad.height);
  // A light cross shows the center of the object. With mirror on, the middle line is darker.
  padCtx.fillStyle = "#eee";
  padCtx.fillRect(0, pad.height / 2, pad.width, 1);
  padCtx.fillStyle = penMirror.checked ? "#999" : "#eee";
  padCtx.fillRect(pad.width / 2, 0, 1, pad.height);
  padCtx.save();
  padCtx.translate(pad.width / 2, pad.height / 2);
  padCtx.scale(pad.width / 80, pad.height / 80);
  drawStrokes(padCtx, strokes);
  padCtx.restore();
}

// A point on the pad, in steps of a half.
function padPoint(e) {
  const box = pad.getBoundingClientRect();
  return [
    limit(Math.round(((e.clientX - box.left) / box.width * 80 - 40) * 2) / 2, -40, 40, 0),
    limit(Math.round(((e.clientY - box.top) / box.height * 80 - 40) * 2) / 2, -40, 40, 0)
  ];
}

function remember() {
  undoList.push(JSON.stringify(strokes));
  if (undoList.length > 100) undoList.shift();
  redoList = [];
}

function pointCount() {
  return strokes.reduce(function (sum, s) { return sum + s.points.length; }, 0);
}

pad.onpointerdown = function (e) {
  const point = padPoint(e);
  pad.setPointerCapture(e.pointerId);
  show(padText, "", "wait");
  if (penTool.value === "eraser") {
    remember();
    erasing = true;
    erase(point);
    return;
  }
  if (strokes.length >= maxStrokes) {
    show(padText, "too many strokes (max " + maxStrokes + ")", "bad");
    return;
  }
  remember();
  // A line by hand grows point by point. The other tools have a start and an end point.
  const tool = penTool.value;
  stroke = {};
  if (tool === "rect" || tool === "ellipse") stroke.shape = tool;
  stroke.color = penColor.value;
  stroke.width = Number(penWidth.value);
  if (penFill.checked) stroke.fill = true;
  if (penMirror.checked) stroke.mirror = true;
  stroke.points = tool === "line" ? [point] : [point, point];
  strokes.push(stroke);
  drawPad();
};

pad.onpointermove = function (e) {
  const point = padPoint(e);
  if (erasing) {
    erase(point);
    return;
  }
  if (!stroke) return;
  if (penTool.value === "line") {
    const last = stroke.points[stroke.points.length - 1];
    if (point[0] === last[0] && point[1] === last[1]) return;
    if (pointCount() >= maxStrokePoints) {
      show(padText, "the drawing is too big (max " + maxStrokePoints + " points)", "bad");
      return;
    }
    stroke.points.push(point);
  } else {
    stroke.points[1] = point;
  }
  drawPad();
};

pad.onpointerup = function () {
  stroke = null;
  erasing = false;
};

// The eraser removes whole strokes it touches.
function erase(point) {
  const before = strokes.length;
  strokes = strokes.filter(function (s) {
    return !touches(s, point) && !(s.mirror && touches(s, [-point[0], point[1]]));
  });
  if (strokes.length !== before) drawPad();
}

function touches(s, point) {
  const reach = s.width / 2 + 2;
  const p = s.points;
  if (s.shape) {
    const inside = function (grow) {
      return point[0] >= Math.min(p[0][0], p[1][0]) - grow && point[0] <= Math.max(p[0][0], p[1][0]) + grow &&
        point[1] >= Math.min(p[0][1], p[1][1]) - grow && point[1] <= Math.max(p[0][1], p[1][1]) + grow;
    };
    // An empty rect or ellipse is only touched at its edge.
    return inside(reach) && (s.fill || !inside(-reach));
  }
  return p.some(function (a, i) { return distance(point, a, p[i + 1] || a) <= reach; });
}

// The distance from point q to the line from a to b.
function distance(q, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = dx || dy ? limit(((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1, 0) : 0;
  return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
}

document.getElementById("padUndo").onclick = function () {
  if (undoList.length === 0) return;
  redoList.push(JSON.stringify(strokes));
  strokes = JSON.parse(undoList.pop());
  drawPad();
};
document.getElementById("padRedo").onclick = function () {
  if (redoList.length === 0) return;
  undoList.push(JSON.stringify(strokes));
  strokes = JSON.parse(redoList.pop());
  drawPad();
};
document.getElementById("padClear").onclick = function () {
  if (strokes.length === 0) return;
  remember();
  strokes = [];
  drawPad();
};

// Take the drawing of the object on the workbench to the pad, to change it.
document.getElementById("padLoad").onclick = function () {
  const draft = getDraft();
  if (!draft || draft.look.type !== "drawing") {
    show(padText, "there is no drawn object on the workbench", "wait");
    return;
  }
  remember();
  strokes = JSON.parse(JSON.stringify(draft.look.strokes));
  drawPad();
  show(padText, "loaded: " + draft.name, "ok");
};

// Give the object on the workbench the drawing from the pad, or make a new one.
// It goes through its script, so it is checked by the same rules.
document.getElementById("padApply").onclick = function () {
  if (strokes.length === 0) {
    show(padText, "draw something first", "wait");
    return;
  }
  const status = applyLook({ type: "drawing", strokes: strokes });
  show(padText, status[0], status[1]);
};
