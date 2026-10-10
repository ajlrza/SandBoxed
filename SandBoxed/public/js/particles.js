// SPDX-License-Identifier: MIT
// Small particles of effects like sparkles, smoke or fire. They are only for the look,
// so each player may see them a little differently. Every object has a limit.

// The world holds the particles of explosions, so it may have more.
const maxParticles = 40;
const maxWorldParticles = 200;

// Each kind: where it starts, how it moves and its color if the effect has none.
const kinds = {
  sparkles: { color: "gold", life: 30 },
  smoke: { color: "gray", life: 60 },
  fire: { color: "orange", life: 30 },
  bubbles: { color: "deepskyblue", life: 70 },
  hearts: { color: "hotpink", life: 60 },
  snow: { color: "#9cc7ef", life: 80 },
  trail: { color: "gray", life: 30 },
  spark: { color: "gold", life: 30 }
};

function add(holder, particle) {
  if (!holder.particles) holder.particles = [];
  if (holder.particles.length < (holder.isWorld ? maxWorldParticles : maxParticles)) holder.particles.push(particle);
}

// New particles of the object's effects, called once every frame.
export function emit(o) {
  o.effects.forEach(function (e) {
    if (!kinds[e.type]) return;
    if (Math.random() > e.speed * 0.04) return;
    const r = o.size;
    const p = { kind: e.type, color: e.color || kinds[e.type].color, age: 0, life: kinds[e.type].life, size: 2 };
    if (e.type === "sparkles") { p.x = o.x + (Math.random() - 0.5) * r * 2; p.y = o.y + (Math.random() - 0.5) * r * 2; p.vx = 0; p.vy = 0; p.size = 3; }
    if (e.type === "smoke") { p.x = o.x + (Math.random() - 0.5) * r * 0.6; p.y = o.y - r * 0.7; p.vx = (Math.random() - 0.5) * 0.3; p.vy = -0.4; p.size = 4; }
    if (e.type === "fire") { p.x = o.x + (Math.random() - 0.5) * r; p.y = o.y - r * 0.5; p.vx = (Math.random() - 0.5) * 0.4; p.vy = -0.9; p.size = 5; }
    if (e.type === "bubbles") { p.x = o.x + (Math.random() - 0.5) * r * 1.5; p.y = o.y; p.vx = 0; p.vy = -0.5; p.size = 3 + Math.random() * 3; }
    if (e.type === "hearts") { p.x = o.x + (Math.random() - 0.5) * r; p.y = o.y - r * 0.6; p.vx = (Math.random() - 0.5) * 0.3; p.vy = -0.6; p.size = 4; }
    if (e.type === "snow") { p.x = o.x + (Math.random() - 0.5) * r * 2.4; p.y = o.y - r * 1.2; p.vx = (Math.random() - 0.5) * 0.2; p.vy = 0.4; p.size = 2; }
    if (e.type === "trail") { p.x = o.x; p.y = o.y; p.vx = 0; p.vy = 0; p.size = r * 0.4; }
    add(o, p);
  });
}

// A burst of sparks from a reaction.
export function burst(o, color) {
  burstAt(o, o.x, o.y, color, 20, 2);
}

// A burst at a place. holder is anything with particles, an object or the world.
// Explosions belong to the world, so they stay when the object is gone.
export function burstAt(holder, x, y, color, count, power) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = power * (0.5 + Math.random());
    add(holder, { kind: "spark", color: color || kinds.spark.color, age: 0, life: kinds.spark.life, size: 2.5,
      x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
  }
}

// A ring that grows to the radius of an explosion and fades.
export function ringAt(holder, x, y, radius, color) {
  add(holder, { kind: "ring", color: color, age: 0, life: 20, size: radius, x: x, y: y, vx: 0, vy: 0 });
}

export function moveParticles(o) {
  if (!o.particles) return;
  o.particles = o.particles.filter(function (p) {
    p.age += 1;
    p.x += p.vx + (p.kind === "bubbles" ? Math.sin(p.age * 0.2) * 0.3 : 0);
    p.y += p.vy;
    return p.age < p.life;
  });
}

// A trail is drawn behind the object, all other particles in front of it.
export function drawParticles(c, o, behind) {
  if (!o.particles) return;
  o.particles.forEach(function (p) {
    if ((p.kind === "trail") !== behind) return;
    const left = 1 - p.age / p.life;
    c.save();
    c.translate(p.x, p.y);
    c.globalAlpha = left * (p.kind === "smoke" || p.kind === "trail" ? 0.4 : 1);
    c.fillStyle = p.color;
    c.strokeStyle = p.color;
    c.beginPath();
    if (p.kind === "sparkles" || p.kind === "spark") {
      // A small four pointed star that twinkles.
      const s = p.size * (p.kind === "sparkles" ? Math.sin(left * Math.PI) : left);
      c.moveTo(0, -s); c.lineTo(s * 0.3, -s * 0.3); c.lineTo(s, 0); c.lineTo(s * 0.3, s * 0.3);
      c.lineTo(0, s); c.lineTo(-s * 0.3, s * 0.3); c.lineTo(-s, 0); c.lineTo(-s * 0.3, -s * 0.3);
      c.fill();
    } else if (p.kind === "ring") {
      c.lineWidth = 3;
      c.arc(0, 0, p.size * (1 - left * 0.7), 0, Math.PI * 2);
      c.stroke();
    } else if (p.kind === "bubbles") {
      c.lineWidth = 1;
      c.arc(0, 0, p.size, 0, Math.PI * 2);
      c.stroke();
    } else if (p.kind === "hearts") {
      const s = p.size;
      c.moveTo(0, s);
      c.bezierCurveTo(-s * 1.5, 0, -s, -s * 1.2, 0, -s * 0.4);
      c.bezierCurveTo(s, -s * 1.2, s * 1.5, 0, 0, s);
      c.fill();
    } else {
      // Smoke grows, fire gets smaller, snow and trail stay.
      const s = p.kind === "smoke" ? p.size * (1 + p.age / 20) : p.kind === "fire" ? p.size * left : p.size;
      c.arc(0, 0, Math.max(0.5, s), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  });
}
