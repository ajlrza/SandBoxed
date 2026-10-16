// SPDX-License-Identifier: MIT
// Every call to an AI goes through askAI(). The rest of the game does not know which AI it is.
//
// Each AI file has the same parts:
//   name                            the name for the player
//   status(settings)                { state, text, note, models, removable }, where state is "missing",
//                                   "unavailable", "downloadable", "downloading" or "available"
//   download(progress, settings)    gets the model, progress() is called with 0 to 1 (only if downloadable)
//   ask(messages, schema, settings) answers the last message with JSON in the form of the schema
// and maybe:
//   release()                       frees the memory when the player picks another AI
//   remove(settings)                deletes the downloaded model
// messages is a list of { role: "system" | "user" | "assistant", content: text }.

import * as chrome from "./ai-chrome.js";
import * as webllm from "./ai-webllm.js";
import * as server from "./ai-server.js";

const providers = { chrome: chrome, browser: webllm, server: server};
const settingsKey = "sandboxed.ai";

// The choice of the player, remembered in this browser.
// size is the browser model (small, medium or large), url and model are for the AI server.
// servertype is only for ai: server
// key is only for servertype: cloud
let settings = { ai: "chrome", size: "small", url: server.defaultUrl, model: "", servertype: "", key: ""};
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(settingsKey)));
} catch (error) {
  // Without storage the defaults are used.
}
// Before, each size of the browser model was its own choice.
if (["small", "medium", "large"].includes(settings.ai)) {
  settings.size = settings.ai;
  settings.ai = "browser";
}

export function getSettings() {
  return settings;
}

export function resetSettings(settings) {
  switch (settings.ai) {
    case "chrome":
      Object.assign(settings, { ai: "chrome", size: "small", url: server.defaultUrl, model: "" });
      break; 
      
    case "webllm":
      Object.assign(settings, { ai: "browser", size: "small", url: server.defaultUrl, model: webllm.name});
      break;

    case "server":
      if (settings.servertype === 'cloud') {
        Object.assign(settings, { ai: "server", size: "", url: "", model: "" })
      }
      else if (settings.servertype === 'local') {
        Object.assign(settings, { ai: "server", size: "", url: server.defaultUrl, model: "" })
      }
      break;
  }
  localStorage.setItem(settingsKey, JSON.stringify(settings))
  return settings
}

export function changeSettings(changes) {
  Object.assign(settings, changes);
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  } catch (error) {
    // The choice then lasts only until the page is closed.
  }
}

export function currentAI() {
  return Object.hasOwn(providers, settings.ai) ? providers[settings.ai] : chrome;
}

export function askAI(messages, schema) {
  return currentAI().ask(messages, schema, settings);
}

// Ask a tiny question to be sure the AI really answers, in JSON like every other answer.
export async function testAI() {
  const answer = await askAI(
    [{ role: "user", content: "Reply with the single word: OK" }],
    { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] }
  );
  return String(answer.answer).trim();
}


