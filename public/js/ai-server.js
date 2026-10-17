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
  let endpoint;

  if (settings.servertype === "local") {
    endpoint = base(settings) + "/models";
    try {
      response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    } catch (error) {
        return {
        state: "missing",
        text: "can not reach " + endpoint + ". Is the server running, and does it allow this page?"
      };
    }
  }

  if (settings.servertype === "cloud") {

    endpoint = "https://benchmarkserver.onrender.com/api/chat";

    const data = {
      model: settings.model, 
      messages: [
        {
          role: "user",
          content: ""
        }
      ],
    };

    const payload = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data),
      
      signal: AbortSignal.timeout(30000) 
    }
    try {
      response = await fetch(endpoint, payload);
      const msg = await response.json();
      return {state: "available", models: response.model};
    } catch (error) {
        return {
          state: "missing",
          text: "can not reach" + endpoint + ". Error: " + error.message
        }
    }
  }


  if (!response.ok) return { state: "missing", text: "the server answered " + msg};
  const data = await response.json().catch(function () { return {}; });
  if (!Array.isArray(data.data)) {


    return { state: "missing", text: "no list of models at " + endpoint + "/models. Is the address right?" };
  }
  // Embedding models can not chat, so they are left out.
  const models = data.data.map(function (model) { return String(model.id); })
    .filter(function (id) { return !/embed/i.test(id); });
  if (models.length === 0) return { state: "unavailable", text: "the server has no models. Download one first." };
  return { state: "available", models: models };
}

export async function ask(messages, schema, settings) {
  
  let response;
  let req;

  if (settings.ai === "local") {

    req = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        messages: messages,
        // The server must answer with JSON in the form of the schema.
        response_format: { type: "json_schema", json_schema: { name: "answer", schema: schema } },
        stream: false
      })
    }

    response = await fetch(base(settings) + "/chat/completions", req);

    if (!response.ok) {
      throw new Error("the AI server answered " + response.status + ": " + (await response.text()).slice(0, 200));
    }

    const message = (await response.json()).choices[0].message;

    return JSON.parse(message.content || message.reasoning_content || message.reasoning || "");

  }
  
  else if (settings.ai === "cloud") {

    req = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings.key}`},
      body: JSON.stringify({
        model: settings.model,
        messages: messages,
        response_format: { type: "json_schema", json_schema: { name: "answer", schema: schema } },
        stream: false
      })
    }

    response = await fetch("https://benchmarkserver.onrender.com/api/chat", req);

    if (!response.ok) {
      throw new Error("the AI server answered " + response.status + ": " + (await response.text()).slice(0, 200));
    }

    const message = (await response.json()).choices[0].message;

    return JSON.parse(message.content || message.reasoning_content || message.reasoning || "");

  }

}

