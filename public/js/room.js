// SPDX-License-Identifier: MIT
// The sandbox the player is in: its name, rules and players.
// For now only the host side, on this computer. Later the host registers the sandbox
// on the signaling server and sends it to the players who join.

const nameKey = "sandboxed.player";

export let room = null;

// The name of the player, remembered in this browser.
export function savedName() {
  try {
    return localStorage.getItem(nameKey) || "";
  } catch (error) {
    return "";
  }
}

export function hostRoom(settings) {
  try {
    localStorage.setItem(nameKey, settings.player);
  } catch (error) {
    // Without storage the name is asked again next time.
  }
  room = {
    name: settings.name,
    host: settings.player,
    maxPlayers: settings.maxPlayers,
    visibility: settings.visibility,
    gravity: settings.gravity,
    destruction: settings.destruction,
    players: [{ name: settings.player, host: true }]
  };
  return room;
}

export function leaveRoom() {
  room = null;
}
