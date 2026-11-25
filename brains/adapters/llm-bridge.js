export class LlmBridge {
  constructor() {
    this.endpoints = {
      openai: "https://api.openai.com/v1/chat/completions",
      openrouter: "https://openrouter.ai/api/v1/chat/completions"
    };
  }

  async complete(opts) {
    const provider = opts && opts.provider ? opts.provider : "openai";
    const apiKey = opts && opts.apiKey ? opts.apiKey : "";
    const model = opts && opts.model ? opts.model : "";
    const prompt = opts && opts.prompt ? opts.prompt : "";
    const systemPrompt = opts && opts.systemPrompt ? opts.systemPrompt : "";

    if (!apiKey) {
      return {
        ok: false,
        text: "No API key configured. Running in Lite Mode."
      };
    }

    if (provider === "gemini") {
      const targetModel = model || "gemini-2.5-flash";
      const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/";
      const url = baseUrl + encodeURIComponent(targetModel) + ":generateContent?key=" + encodeURIComponent(apiKey);
      const fullPrompt = systemPrompt ? (systemPrompt + "\n\n" + prompt) : prompt;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }]
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data && data.error && data.error.message ? data.error.message : "Gemini request failed";
        throw new Error(errMsg);
      }

      const cand = data && data.candidates && data.candidates[0];
      const part = cand && cand.content && cand.content.parts && cand.content.parts[0];
      const text = part && part.text ? part.text : "";
      return { ok: true, text: text, provider: "gemini", model: targetModel };
    }

    const url = this.endpoints[provider] || this.endpoints.openai;
    const targetModel = model || (provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini");
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({ model: targetModel, messages: messages })
    });

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data && data.error && data.error.message ? data.error.message : "LLM request failed";
      throw new Error(errMsg);
    }

    const choice = data && data.choices && data.choices[0];
    const text = choice && choice.message && choice.message.content ? choice.message.content : "";
    return { ok: true, text: text, provider: provider, model: targetModel };
  }
}

export const llmBridge = new LlmBridge();
export default llmBridge;