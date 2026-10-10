// SPDX-License-Identifier: MIT
// Chrome AI: the model built into Chrome (Gemini Nano), through the Prompt API.

const options = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }]
};

export const name = "Chrome AI (built-in)";

export async function status() {
  if (!("LanguageModel" in self)) {
    return { state: "missing", text: "not found. Use a new version of Chrome on a computer." };
  }
  return {
    state: await LanguageModel.availability(options),
    note: "The model is about 4 GB. Chrome needs about 20 GB of free disk space to start the download."
  };
}

// Chrome downloads the model when the first session is made. It needs a click from the player.
export async function download(progress) {
  const session = await LanguageModel.create({
    ...options,
    monitor(m) {
      m.addEventListener("downloadprogress", function (e) { progress(e.loaded); });
    }
  });
  session.destroy();
}

// The last message is the question. All messages before it start the session.
export async function ask(messages, schema) {
  const session = await LanguageModel.create({ ...options, initialPrompts: messages.slice(0, -1) });
  try {
    const answer = await session.prompt(messages[messages.length - 1].content, { responseConstraint: schema });
    return JSON.parse(answer);
  } finally {
    session.destroy();
  }
}
