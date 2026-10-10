// SPDX-License-Identifier: MIT
// The rules for objects. Every object script, from the AI or from a player, is checked here.
// Later the other players will use the same rules for objects they receive.

// Simple shapes, then ready made parts that the code draws from a few shapes.
export const shapes = [
  "circle", "ring", "semicircle", "rect", "roundrect", "triangle", "star",
  "heart", "drop", "crescent", "arc", "polygon",
  "eye", "wheel", "window", "flower"
];

// A behavior has properties, one move, up to 3 effects and up to 3 reactions.
// Flying moves and the area "top" are not pulled down by gravity.
export const moves = ["none", "wander", "bounce", "orbit", "float", "jump", "follow", "patrol", "fly"];
export const flyingMoves = ["orbit", "float", "follow", "patrol", "fly"];
export const areas = ["anywhere", "top"];
export const effects = [
  "spin", "pulse", "wobble", "shake", "squash",
  "blink", "fade", "glow", "rainbow",
  "sparkles", "smoke", "fire", "bubbles", "hearts", "snow", "trail"
];
export const triggers = ["click", "touch", "wall", "timer", "hurt", "destroyed"];
export const actions = [
  "jump", "spin", "grow", "burst", "say", "hide",
  "explode", "damage", "destroy", "push", "shoot", "spawn"
];
// Who an action is for: the object itself, the one it touched, or all near it.
export const targets = ["self", "other", "near"];
export const directions = ["nearest", "left", "right", "up", "down"];
export const maxEffects = 3;
export const maxReactions = 3;
export const defaultHealth = 3;
export const maxParts = 30;
export const maxPoints = 12;
export const maxStrokes = 50;
export const strokeShapes = ["line", "rect", "ellipse"];
export const maxStrokePoints = 3000;

export function limit(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

// Check a whole object script: its name, look and behavior.
export function validate(data) {
  let look;
  let behavior;
  try {
    look = validateLook(data.look);
  } catch (error) {
    throw new Error("look: " + error.message);
  }
  try {
    behavior = validateBehavior(data.behavior || {});
  } catch (error) {
    throw new Error("behavior: " + error.message);
  }
  return Object.assign({ name: String(data.name || "").slice(0, 30) }, look, behavior);
}

// Check a look and fix bad values. Bad looks are rejected.
// Returns the clean look for the script, and what the sandbox needs to draw it.
export function validateLook(look) {
  if (!look || typeof look !== "object") throw new Error("no look");
  if (!Object.hasOwn(lookTypes, look.type)) throw new Error("unknown look type: " + look.type);
  const result = lookTypes[look.type](look);
  if (result.size > 90) throw new Error("object is too big");
  return { look: result.look, parts: result.parts || null, size: result.size, bottom: result.bottom };
}

// size: how far the look reaches from its center. bottom: its lowest point, for the shadow.
const lookTypes = {
  shapes: function (look) {
    const parts = validateParts(look.parts);
    return { look: { type: "shapes", parts: parts }, parts: parts, size: measure(parts), bottom: lowest(parts) };
  },

  icon: function (look) {
    const emoji = oneEmoji(look.emoji);
    if (!emoji) throw new Error("emoji must be exactly one emoji");
    const size = limit(look.size, 10, 80, 60);
    return { look: { type: "icon", emoji: emoji, size: size }, size: size / 2, bottom: size / 2 };
  },

  drawing: function (look) {
    if (!Array.isArray(look.strokes) || look.strokes.length === 0) throw new Error("no strokes");
    if (look.strokes.length > maxStrokes) throw new Error("too many strokes (max " + maxStrokes + ")");
    let count = 0;
    const strokes = look.strokes.map(function (stroke) {
      if (!Array.isArray(stroke.points) || stroke.points.length === 0) throw new Error("a stroke needs points");
      // A line by hand has no shape. A rect or an ellipse is given by two corners.
      const shape = stroke.shape === undefined ? "line" : stroke.shape;
      if (!strokeShapes.includes(shape)) throw new Error("unknown stroke shape: " + shape);
      if (shape !== "line" && stroke.points.length !== 2) throw new Error("a " + shape + " needs 2 points");
      count += stroke.points.length;
      const clean = {};
      if (shape !== "line") clean.shape = shape;
      clean.color = CSS.supports("color", stroke.color) ? stroke.color : "black";
      clean.width = limit(stroke.width, 1, 12, 3);
      if (stroke.fill === true) clean.fill = true;
      if (stroke.mirror === true) clean.mirror = true;
      clean.points = stroke.points.map(function (point) {
        return [limit(point[0], -40, 40, 0), limit(point[1], -40, 40, 0)];
      });
      return clean;
    });
    if (count > maxStrokePoints) throw new Error("the drawing is too big (max " + maxStrokePoints + " points)");
    let size = 0;
    let bottom = 0;
    strokes.forEach(function (stroke) {
      stroke.points.forEach(function (point) {
        size = Math.max(size, Math.hypot(point[0], point[1]) + stroke.width / 2);
        bottom = Math.max(bottom, point[1] + stroke.width / 2);
      });
    });
    return { look: { type: "drawing", strokes: strokes }, size: size, bottom: bottom };
  }
};

// Exactly one emoji, so a look can not carry a hidden text message.
function oneEmoji(text) {
  const list = Array.from(new Intl.Segmenter().segment(String(text || "").trim()));
  if (list.length !== 1) return null;
  const emoji = list[0].segment;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji) ? emoji : null;
}

// Check the parts of a look made from shapes.
function validateParts(list) {
  if (!Array.isArray(list) || list.length === 0) throw new Error("no parts");
  if (list.length > maxParts) throw new Error("too many parts (max " + maxParts + ")");

  return list.map(function (part) {
    if (!shapes.includes(part.shape)) throw new Error("unknown shape: " + part.shape);
    const clean = {
      shape: part.shape,
      x: limit(part.x, -40, 40, 0),
      y: limit(part.y, -40, 40, 0),
      width: limit(part.width, 2, 80, 10)
    };
    // height and rotation are optional, so the AI writes fewer numbers.
    if (part.height !== undefined) clean.height = limit(part.height, 2, 80, clean.width);
    if (part.rotation) clean.rotation = limit(part.rotation, -360, 360, 0);
    clean.color = CSS.supports("color", part.color) ? part.color : "gray";
    if (part.mirror === true) clean.mirror = true;
    // Only a polygon keeps its points. They are inside its box, from -1 to 1.
    if (part.shape === "polygon") {
      if (!Array.isArray(part.points) || part.points.length < 3 || part.points.length > maxPoints) {
        throw new Error("a polygon needs 3 to " + maxPoints + " points");
      }
      clean.points = part.points.map(function (point) {
        return [limit(point[0], -1, 1, 0), limit(point[1], -1, 1, 0)];
      });
    }
    return clean;
  });
}

// Check a behavior script. Nothing written means the object stands still on the ground.
// Only ready made moves, effects and actions with a few values, no code of its own.
// Properties are written only when they differ from the default.
export function validateBehavior(data) {
  const clean = {};

  // Health: how many points of damage it takes. unbreakable: nothing can damage it.
  if (data.health !== undefined) clean.health = Math.round(limit(data.health, 1, 100, defaultHealth));
  if (data.unbreakable === true) clean.unbreakable = true;
  // Solid: other objects can not go through it.
  if (data.solid === true) clean.solid = true;
  // Tags are groups, for example a gun that shoots only at animals.
  const tags = tagList(data.tags);
  if (tags.length > 0) clean.tags = tags;

  const move = data.move || { type: "none" };
  if (!moves.includes(move.type)) throw new Error("unknown move: " + move.type);
  clean.move = { type: move.type };
  if (move.type !== "none") clean.move.speed = limit(move.speed, 1, 10, 3);
  if (move.area !== undefined) {
    if (!areas.includes(move.area)) throw new Error("unknown area: " + move.area);
    if (move.area !== "anywhere") clean.move.area = move.area;
  }

  clean.effects = list(data.effects, maxEffects, "effects").map(function (effect) {
    if (!effects.includes(effect.type)) throw new Error("unknown effect: " + effect.type);
    const e = { type: effect.type, speed: limit(effect.speed, 1, 10, 3) };
    if (effect.color !== undefined) e.color = color(effect.color);
    return e;
  });

  clean.reactions = list(data.reactions, maxReactions, "reactions").map(validateReaction);
  return clean;
}

// Each action keeps only the values it uses.
function validateReaction(reaction) {
  if (!triggers.includes(reaction.when)) throw new Error("unknown when: " + reaction.when);
  if (!actions.includes(reaction.do)) throw new Error("unknown do: " + reaction.do);
  const r = { when: reaction.when, do: reaction.do };
  const does = function () { return Array.from(arguments).includes(r.do); };

  // A timer fires every few seconds.
  if (r.when === "timer") r.every = limit(reaction.every, 1, 30, 3);
  if (does("damage", "destroy", "push")) {
    r.target = reaction.target === undefined ? "other" : reaction.target;
    if (!targets.includes(r.target)) throw new Error("unknown target: " + r.target);
  }
  if (does("explode") || r.target === "near") r.radius = limit(reaction.radius, 10, 80, 40);
  if (does("explode", "damage", "shoot")) r.damage = Math.round(limit(reaction.damage, 1, 20, r.do === "explode" ? 5 : 1));
  if (does("shoot")) {
    r.toward = reaction.toward === undefined ? "nearest" : reaction.toward;
    if (!directions.includes(r.toward)) throw new Error("unknown toward: " + r.toward);
  }
  if (does("shoot", "push")) r.speed = limit(reaction.speed, 1, 10, 5);
  // Shoot, damage, destroy and push can be only for objects with these tags.
  if (does("shoot", "damage", "destroy", "push")) {
    const tags = tagList(reaction.tags);
    if (tags.length > 0) r.tags = tags;
  }
  // An object may only say one emoji, never text. A spawned object is one emoji too.
  if (does("say", "spawn")) {
    r.emoji = oneEmoji(reaction.emoji);
    if (!r.emoji) throw new Error(r.do + " needs exactly one emoji");
  }
  if (does("spawn")) {
    r.move = reaction.move === undefined ? "none" : reaction.move;
    if (!moves.includes(r.move)) throw new Error("unknown move: " + r.move);
  }
  if (does("burst", "explode", "shoot") && reaction.color !== undefined) r.color = color(reaction.color);
  return r;
}

// Up to 3 short words of small letters.
function tagList(value) {
  return list(value, 3, "tags").map(function (tag) {
    if (!/^[a-z]{1,12}$/.test(tag)) throw new Error("a tag is one short word of small letters");
    return tag;
  });
}

function list(value, max, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(name + " must be a list");
  if (value.length > max) throw new Error("too many " + name + " (max " + max + ")");
  return value;
}

function color(value) {
  return CSS.supports("color", value) ? value : "gray";
}

// The size of the whole object: the farthest point of any part from the center.
function measure(parts) {
  return Math.max.apply(null, parts.map(function (part) {
    return Math.hypot(Math.abs(part.x) + part.width / 2, Math.abs(part.y) + height(part) / 2);
  }));
}

function lowest(parts) {
  return Math.max.apply(null, parts.map(function (part) { return part.y + height(part) / 2; }));
}

// A part without height is as high as it is wide.
export function height(part) {
  return part.height === undefined ? part.width : part.height;
}
