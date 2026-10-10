// SPDX-License-Identifier: MIT
// What objects do when something happens to them: their reactions.
// Some actions change only the object itself. Others act on other objects:
// damage, destroy, explode, push, shoot and spawn.
//
// world has: width, height, ground, gravity, destruction ("all", "own" or "none"),
// objects, bullets, dying (destroyed objects that leave at the end of the frame),
// particles, maxObjects, add(object, x, y) and remove(object).

import { actionsOf } from "./behavior.js";
import { burst, burstAt, ringAt } from "./particles.js";
import { validate } from "./validate.js";

// One reaction can not fire again sooner than this, so nothing can spam the sandbox.
const pause = 30;
// Limits for shooting and spawning, so one object can not fill the sandbox.
const maxBullets = 5;
const maxAllBullets = 60;
const bulletLife = 180;
const maxChildren = 3;

// Something happened to the object. other is the object it touched or that hurt it.
export function react(o, when, world, other) {
  if (o.dead && when !== "destroyed") return;
  if (!o.fired) o.fired = {};
  if (o.fired[when] !== undefined && o.time - o.fired[when] < pause) return;
  const list = o.reactions.filter(function (r) { return r.when === when; });
  if (list.length === 0) return;
  o.fired[when] = o.time;
  list.forEach(function (r) { perform(o, r, world, other); });
}

// Walls and timers, once every frame.
export function tick(o, world) {
  if (o.hitWall) react(o, "wall", world);
  o.reactions.forEach(function (r) {
    if (r.when === "timer" && o.time % Math.round(r.every * 60) === 0) react(o, "timer", world);
  });
}

function perform(o, r, world, other) {
  if (r.do === "burst") return burst(o, r.color);
  if (r.do === "explode") return explode(o, r, world);
  if (r.do === "shoot") return shoot(o, r, world);
  if (r.do === "spawn") return spawn(o, r, world);
  if (r.do === "damage" || r.do === "destroy" || r.do === "push") {
    targetsOf(o, r, world, other).forEach(function (t) {
      if (r.do === "damage") damage(t, r.damage, world, o);
      if (r.do === "destroy") damage(t, Infinity, world, o);
      if (r.do === "push") push(t, o, r.speed);
    });
    return;
  }
  // The rest only shows on the object itself: jump, spin, grow, say and hide.
  actionsOf(o).push({ do: r.do, start: o.time, emoji: r.emoji });
}

function targetsOf(o, r, world, other) {
  if (r.target === "self") return [o];
  let list = r.target === "other"
    ? (other ? [other] : [])
    : world.objects.filter(function (t) { return t !== o && !t.dead && distance(o, t) - t.size <= r.radius; });
  if (r.tags) list = list.filter(function (t) { return hasTag(t, r.tags); });
  return list;
}

function hasTag(t, tags) {
  return (t.tags || []).some(function (tag) { return tags.includes(tag); });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---------- Damage ----------

// Damage takes health. At zero the object is destroyed.
// The host decides which other objects can be hurt: all, only of the same player, or none.
// An object can always hurt itself.
export function damage(t, amount, world, from) {
  if (t.dead || t.unbreakable) return;
  if (t !== from && world.destruction !== "all") {
    if (world.destruction === "none" || t.author !== from.author) return;
  }
  t.hp -= amount;
  actionsOf(t).push({ do: "hurt", start: t.time });
  if (t.hp <= 0) destroy(t, world);
  else react(t, "hurt", world, from);
}

export function destroy(t, world) {
  if (t.dead) return;
  t.dead = true;
  world.dying.push(t);
}

// Destroyed objects leave at the end of the frame. Their "destroyed" reactions run first,
// so a bomb hit by another bomb explodes too. New ones wait for the next frame,
// so a chain of bombs explodes step by step and never loops forever.
export function bury(world) {
  const list = world.dying;
  world.dying = [];
  list.forEach(function (t) {
    react(t, "destroyed", world);
    burstAt(world, t.x, t.y, "gray", 12, 1.5);
    world.remove(t);
  });
}

// The object blows up: it hurts and pushes all near it, and is gone.
function explode(o, r, world) {
  if (o.exploded) return;
  o.exploded = true;
  ringAt(world, o.x, o.y, r.radius, r.color || "orange");
  burstAt(world, o.x, o.y, r.color || "orange", 30, 3);
  world.objects.forEach(function (t) {
    if (t === o || t.dead || distance(o, t) - t.size > r.radius) return;
    damage(t, r.damage, world, o);
    push(t, o, 4);
  });
  destroy(o, world);
}

function push(t, from, force) {
  if (t === from) return;
  const d = distance(t, from) || 1;
  t.vx += (t.x - from.x) / d * force;
  t.vy += (t.y - from.y) / d * force - force * 0.3;
  t.cx = undefined;
}

// ---------- Shooting ----------

// A bullet flies straight. It hurts the first object it hits and is gone.
function shoot(o, r, world) {
  if (world.bullets.length >= maxAllBullets) return;
  if (world.bullets.filter(function (b) { return b.from === o; }).length >= maxBullets) return;
  let dx = { left: -1, right: 1 }[r.toward] || 0;
  let dy = { up: -1, down: 1 }[r.toward] || 0;
  if (r.toward === "nearest") {
    const t = nearest(o, r.tags, world);
    if (!t) return;
    dx = t.x - o.x;
    dy = t.y - o.y;
  }
  const d = Math.hypot(dx, dy) || 1;
  const v = r.speed * 0.8;
  world.bullets.push({
    x: o.x + dx / d * o.size, y: o.y + dy / d * o.size, vx: dx / d * v, vy: dy / d * v,
    damage: r.damage, color: r.color || "black", from: o, age: 0
  });
}

// The nearest object that can be hurt, maybe only with some tags.
function nearest(o, tags, world) {
  let best = null;
  world.objects.forEach(function (t) {
    if (t === o || t.dead || t.unbreakable || (tags && !hasTag(t, tags))) return;
    if (!best || distance(o, t) < distance(o, best)) best = t;
  });
  return best;
}

export function moveBullets(world) {
  world.bullets = world.bullets.filter(function (b) {
    b.age += 1;
    b.x += b.vx;
    b.y += b.vy;
    if (b.age > bulletLife || b.x < 0 || b.x > world.width || b.y < 0 || b.y > world.ground) return false;
    const hit = world.objects.find(function (t) {
      return t !== b.from && !t.dead && Math.hypot(t.x - b.x, t.y - b.y) < t.size * 0.8;
    });
    if (!hit) return true;
    damage(hit, b.damage, world, b.from);
    burstAt(world, b.x, b.y, b.color, 5, 1);
    return false;
  });
}

export function drawBullets(c, world) {
  world.bullets.forEach(function (b) {
    c.fillStyle = b.color;
    c.beginPath();
    c.arc(b.x, b.y, 2, 0, Math.PI * 2);
    c.fill();
  });
}

// ---------- Spawning ----------

// A new small object of one emoji, for example an apple from a tree.
// It has no reactions, so spawning can not go on and on.
function spawn(o, r, world) {
  if (world.objects.length >= world.maxObjects) return;
  const children = world.objects.filter(function (t) { return t.parent === o && !t.dead; });
  if (children.length >= maxChildren) return;
  const child = validate({ name: "", look: { type: "icon", emoji: r.emoji, size: 24 }, behavior: { move: { type: r.move } } });
  child.parent = o;
  child.author = o.author;
  world.add(child, o.x, o.y + o.size * 0.5);
}

// ---------- Touching ----------

// Two objects touch when they come close. Each new touch is a reaction for both.
// A solid object does not let others through: they are pushed out of it.
export function touches(world, dragged) {
  const list = world.objects;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.dead || b.dead) continue;
      const reach = (a.size + b.size) * 0.8;
      const d = distance(a, b);
      if (!a.touching) a.touching = new Set();
      if (!b.touching) b.touching = new Set();
      if (d < reach && (a.solid || b.solid)) separate(a, b, reach - d, d, dragged);
      if (d < reach && !a.touching.has(b)) {
        a.touching.add(b);
        b.touching.add(a);
        react(a, "touch", world, b);
        react(b, "touch", world, a);
      }
      if (d >= reach) {
        a.touching.delete(b);
        b.touching.delete(a);
      }
    }
  }
}

function separate(a, b, overlap, d, dragged) {
  const nx = d ? (b.x - a.x) / d : 1;
  const ny = d ? (b.y - a.y) / d : 0;
  // The one that is not solid moves. If both are solid, both move half, the dragged one not at all.
  let shareA = a.solid && !b.solid ? 0 : b.solid && !a.solid ? 1 : 0.5;
  if (a === dragged) shareA = 0;
  if (b === dragged) shareA = 1;
  a.x -= nx * overlap * shareA;
  a.y -= ny * overlap * shareA;
  b.x += nx * overlap * (1 - shareA);
  b.y += ny * overlap * (1 - shareA);
}
