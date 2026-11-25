export class LlmBridge {
  constructor() {
    this.endpointMap = {
      openai: "https://api.openai.com/v1/chat/completions",
      openrouter: "https://openrouter.ai/api/v1/chat/completions"
    };
  }

  async complete({ provider = "openai", apiKey = "", model = "", prompt = "", systemPrompt = "" }) {
    if (!apiKey) {
      return {
        ok: false,
        text: "No API key configured. Running in Lite Mode."
      };
    }

    if (provider === "gemini") {
      const targetModel = model || "gemini-2.5-flash";
      const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(targetModel) + ":generateContent?key=" + encodeURIComponent(apiKey);
      const body = {
        contents: [{ parts: [{ text: (systemPrompt ? systemPrompt + "\n\n" : "") + prompt }] }]
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Gemini request failed");
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return { ok: true, text: text, provider: "gemini", model: targetModel };
    }

    const url = this.endpointMap[provider] || this.endpointMap.openai;
    const targetModel = model || (provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini");
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
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
      throw new Error(data?.error?.message || "LLM request failed");
    }

    const text = data?.choices?.[0]?.message?.content || "";
    return { ok: true, text: text, provider: provider, model: targetModel };
  }
}

export const llmBridge = new LlmBridge();
export default llmBridge;