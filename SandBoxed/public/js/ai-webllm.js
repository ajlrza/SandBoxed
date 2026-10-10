// SPDX-License-Identifier: MIT
// A model that runs right in the browser, with WebLLM and the graphics card (WebGPU).
// The library comes from a CDN, and only when the player picks this AI.
// The model is downloaded once and stays in the browser, until the player deletes it.

const library = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm";

// Fast models that keep to JSON well, and that may be used in a public game.
const models = {
  small: "Qwen2.5-1.5B-Instruct",
  medium: "Llama-3.2-3B-Instruct",
  large: "Qwen2.5-7B-Instruct"
};

export const name = "Browser model (WebLLM)";

let webllm = null;
let adapter = null;
// The model in the graphics card: its id and the engine (a promise, while it loads).
let loaded = { id: "", engine: null };

async function lib() {
  if (!webllm) webllm = await import(library);
  return webllm;
}

// Graphics cards without 16 bit numbers need the bigger f32 version of the model.
async function modelId(settings) {
  if (!adapter) adapter = await navigator.gpu.requestAdapter();
  const kind = adapter.features.has("shader-f16") ? "q4f16_1" : "q4f32_1";
  return (models[settings.size] || models.small) + "-" + kind + "-MLC";
}

export async function status(settings) {
  if (!navigator.gpu || !(adapter || (adapter = await navigator.gpu.requestAdapter()))) {
    return { state: "missing", text: "this browser can not use the graphics card (WebGPU). Use a new Chrome on a computer." };
  }
  try {
    await lib();
  } catch (error) {
    return { state: "missing", text: "could not load WebLLM: " + error.message };
  }
  const id = await modelId(settings);
  if (await webllm.hasModelInCache(id)) return { state: "available", removable: true };
  const info = webllm.prebuiltAppConfig.model_list.find(function (model) { return model.model_id === id; });
  const memory = info ? " It needs about " + (info.vram_required_MB / 1024).toFixed(1) + " GB of graphics memory." : "";
  return { state: "downloadable", note: "The model " + id + " is downloaded once and stays in this browser." + memory };
}

// Loading the model the first time also downloads it.
export async function download(progress, settings) {
  await engineFor(settings, progress);
}

async function engineFor(settings, progress) {
  const id = await modelId(settings);
  if (loaded.id !== id) {
    await release();
    const engine = (await lib()).CreateMLCEngine(id, {
      initProgressCallback: function (report) { if (progress) progress(report.progress); }
    });
    loaded = { id: id, engine: engine };
    engine.catch(function () { if (loaded.engine === engine) loaded = { id: "", engine: null }; });
  }
  return loaded.engine;
}

export async function ask(messages, schema, settings) {
  const engine = await engineFor(settings);
  const reply = await engine.chat.completions.create({
    messages: messages,
    // WebLLM makes the model answer with JSON in the form of the schema.
    response_format: { type: "json_object", schema: JSON.stringify(schema) }
  });
  return JSON.parse(reply.choices[0].message.content);
}

// Free the graphics card, for example when the player picks another AI.
export async function release() {
  const engine = loaded.engine;
  loaded = { id: "", engine: null };
  if (engine) await engine.then(function (e) { return e.unload(); }).catch(function () {});
}

export async function remove(settings) {
  const id = await modelId(settings);
  if (loaded.id === id) await release();
  await (await lib()).deleteModelAllInfoInCache(id);
}
