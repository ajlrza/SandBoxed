// SPDX-License-Identifier: MIT
// The text of an object script, as the player sees and edits it.

export function script(name, look, behavior) {
  return "{\n" +
    '  "name": ' + JSON.stringify(name || "") + ",\n" +
    '  "look": ' + block(look) + ",\n" +
    '  "behavior": ' + block(behavior) + "\n" +
    "}";
}

export function objectScript(o) {
  return script(o.name, o.look, behaviorOf(o));
}

// The behavior part of an object, with properties only where they are set.
export function behaviorOf(o) {
  const behavior = {};
  ["health", "unbreakable", "solid", "tags"].forEach(function (key) {
    if (o[key] !== undefined) behavior[key] = o[key];
  });
  return Object.assign(behavior, { move: o.move, effects: o.effects, reactions: o.reactions });
}

// Long lists, like parts, strokes or effects, get one item per line.
function block(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return JSON.stringify(data || {});
  const lines = Object.keys(data).map(function (key) {
    const value = data[key];
    if (Array.isArray(value) && value.length > 1) {
      const items = value.map(function (item) { return "      " + JSON.stringify(item); });
      return "    " + JSON.stringify(key) + ": [\n" + items.join(",\n") + "\n    ]";
    }
    return "    " + JSON.stringify(key) + ": " + JSON.stringify(value);
  });
  return "{\n" + lines.join(",\n") + "\n  }";
}
