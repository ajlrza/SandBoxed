// SPDX-License-Identifier: MIT
// An AI server with the OpenAI API, usually on your own computer:
// Ollama (http://localhost:11434/v1) or LM Studio (http://localhost:1234/v1).
// The server must allow this page to call it (CORS).

export const name = "AI server (Ollama, LM Studio)";
export const defaultUrl = "http://localhost:11434/v1";

function base(settings) {
  const url = String(settings.url || defaultUrl).trim().replace(/\/+$/, "");
  // Without a path, the OpenAI API of Ollama and LM Studio is under /v1.
  return /^https?:\/\/[^/]+$/i.test(url) ? url + "/v1" : url;
}

// The server is there when it lists its models.
export async function status(settings) {
  let response;
  try {
    response = await fetch(base(settings) + "/models", { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    return {
      state: "missing",
      text: "can not reach " + base(settings) + ". Is the server running, and does it allow this page?"
    };
  }
  if (!response.ok) return { state: "missing", text: "the server answered " + response.status };
  const data = await response.json().catch(function () { return {}; });
  if (!Array.isArray(data.data)) {
    return { state: "missing", text: "no list of models at " + base(settings) + "/models. Is the address right?" };
  }
  // Embedding models can not chat, so they are left out.
  const models = data.data.map(function (model) { return String(model.id); })
    .filter(function (id) { return !/embed/i.test(id); });
  if (models.length === 0) return { state: "unavailable", text: "the server has no models. Download one first." };
  return { state: "available", models: models };
}

export async function ask(messages, schema, settings) {
  const response = await fetch(base(settings) + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model,
      messages: messages,
      // The server must answer with JSON in the form of the schema.
      response_format: { type: "json_schema", json_schema: { name: "answer", schema: schema } },
      stream: false
    })
  });
  if (!response.ok) {
    throw new Error("the AI server answered " + response.status + ": " + (await response.text()).slice(0, 200));
  }
  const message = (await response.json()).choices[0].message;
  // Thinking models can put the whole answer into the thinking part and leave content empty:
  // LM Studio calls it reasoning_content, Ollama calls it reasoning.
  return JSON.parse(message.content || message.reasoning_content || message.reasoning || "");
}
