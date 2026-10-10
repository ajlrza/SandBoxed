// SPDX-License-Identifier: MIT
// How objects move and the effects they show.
// The world is seen from the side: the ground is at the bottom, the sky at the top.
// Time counts in frames, about 60 in a second. Moves and effects come from the time,
// so later every player can see them the same way.

import { flyingMoves } from "./validate.js";

// How long a visible action lasts, in frames.
export const lasting = { jump: 30, spin: 40, grow: 40, say: 120, hide: 120, hurt: 12 };
const gravity = 0.25;

// Move with the object's speed. Keep the direction if it already moves.
export function launch(o) {
  const speed = o.move.speed || 0;
  const angle = o.vx || o.vy ? Math.atan2(o.vy, o.vx) : Math.random() * Math.PI * 2;
  o.vx = Math.cos(angle) * speed * 0.5;
  o.vy = Math.sin(angle) * speed * 0.5;
  // Walking and patrolling go only left or right.
  if (o.move.type === "wander" || o.move.type === "patrol") {
    o.vx = (Math.random() < 0.5 ? -1 : 1) * speed * 0.3;
    o.vy = 0;
  }
}

// Objects that fly, or stay at the top, are not pulled down.
export function flies(o) {
  return flyingMoves.includes(o.move.type) || o.move.area === "top";
}

// One step of the move. world has width, height, ground, gravity and pointer (the mouse, or null).
// hitWall tells the reactions about a wall, or a hard landing on the ground.
export function move(o, world) {
  const type = o.move.type;
  const speed = o.move.speed || 0;
  const falls = world.gravity && !flies(o);
  o.hitWall = false;

  if (type === "orbit") {
    if (o.cx === undefined) { o.cx = o.x; o.cy = o.y; }
    const a = o.time * speed * 0.005;
    o.x = o.cx + Math.cos(a) * 40;
    o.y = o.cy + Math.sin(a) * 40;
    return;
  }

  if (type === "wander") {
    if (o.time % 90 === 0 && Math.random() < 0.3) o.vx = -o.vx;
    if (!falls && o.time % 30 === 0) o.vy += Math.random() - 0.5;
  }
  if (type === "fly" && o.time % 30 === 0) {
    o.vx += (Math.random() - 0.5) * speed * 0.2;
    o.vy += (Math.random() - 0.5) * speed * 0.2;
  }
  if (type === "follow" && world.pointer) {
    o.vx = (world.pointer.x - o.x) * 0.006 * speed;
    if (!falls) o.vy = (world.pointer.y - o.y) * 0.006 * speed;
  }
  if (falls) o.vy += gravity;
  o.x += o.vx;
  o.y += o.vy;

  // The walls on the left and right, and the top.
  if (o.x < o.size) { o.x = o.size; o.vx = Math.abs(o.vx); o.hitWall = true; }
  if (o.x > world.width - o.size) { o.x = world.width - o.size; o.vx = -Math.abs(o.vx); o.hitWall = true; }
  if (o.y < o.size) { o.y = o.size; o.vy = Math.abs(o.vy); o.hitWall = true; }

  // The ground. A bouncing object jumps back up, others land and stop slowly.
  if (o.y + o.bottom > world.ground) {
    o.y = world.ground - o.bottom;
    if (type === "bounce") {
      o.vy = -Math.abs(o.vy);
      o.hitWall = true;
    } else {
      o.hitWall = o.vy > 3;
      o.vy = 0;
      if (type !== "wander" && type !== "follow") o.vx *= 0.8;
    }
  }

  // The area at the top is the upper third of the sandbox.
  if (o.move.area === "top" && o.y > world.height / 3) {
    o.y -= 1;
    o.vy = Math.min(o.vy, 0);
  }
  // A flying object without its own move slows down, for example after a push.
  if (!falls && (type === "none" || type === "float" || type === "jump")) {
    o.vx *= 0.95;
    o.vy *= 0.95;
  }
}

// What the move, the effects and the actions do to the look right now:
// shift, turn, size, see-through, glow and color.
export function pose(o) {
  const p = { dx: 0, dy: 0, angle: 0, scaleX: 1, scaleY: 1, alpha: 1, hidden: false, glow: null, hue: 0 };
  const t = o.time;
  if (o.move.type === "float") p.dy += Math.sin(t * 0.02 * o.move.speed) * 5;
  if (o.move.type === "jump") p.dy -= Math.abs(Math.sin(t * 0.015 * o.move.speed)) * 18;

  o.effects.forEach(function (e) {
    const s = e.speed;
    if (e.type === "spin") p.angle += t * s * 0.01;
    if (e.type === "pulse") { const k = 1 + 0.15 * Math.sin(t * s * 0.02); p.scaleX *= k; p.scaleY *= k; }
    if (e.type === "wobble") p.angle += Math.sin(t * s * 0.03) * 0.25;
    if (e.type === "shake") { p.dx += Math.sin(t * s * 0.9) * 1.5; p.dy += Math.cos(t * s * 1.1) * 1.5; }
    if (e.type === "squash") { const k = 0.12 * Math.sin(t * s * 0.03); p.scaleX *= 1 + k; p.scaleY *= 1 - k; }
    // At most 3 blinks in a second, because fast blinking can hurt people with epilepsy.
    if (e.type === "blink" && Math.floor(t / (10 + (10 - s) * 6)) % 2 === 1) p.hidden = true;
    if (e.type === "fade") p.alpha *= 0.55 + 0.45 * Math.sin(t * s * 0.02);
    if (e.type === "glow") p.glow = e.color || "gold";
    if (e.type === "rainbow") p.hue = (t * s * 2) % 360;
  });

  actionsOf(o).forEach(function (a) {
    const done = Math.min((t - a.start) / lasting[a.do], 1);
    if (a.do === "jump") p.dy -= Math.sin(done * Math.PI) * 20;
    if (a.do === "spin") p.angle += done * Math.PI * 2;
    if (a.do === "grow") { const k = 1 + 0.4 * Math.sin(done * Math.PI); p.scaleX *= k; p.scaleY *= k; }
    if (a.do === "hide") p.hidden = true;
    // A hurt object shakes and gets lighter for a moment.
    if (a.do === "hurt") { p.dx += Math.sin(t * 2) * 2; p.alpha *= 0.6; }
  });
  return p;
}

// The visible actions that still run. Old ones are removed.
export function actionsOf(o) {
  if (!o.actions) o.actions = [];
  o.actions = o.actions.filter(function (a) { return o.time - a.start < lasting[a.do]; });
  return o.actions;
}
