export class LlmBridge {
  async complete(opts) {
    const provider = opts && opts.provider ? opts.provider : "openai";
    const apiKey = opts && opts.apiKey ? opts.apiKey : "";
    const model = opts && opts.model ? opts.model : "";
    const prompt = opts && opts.prompt ? opts.prompt : "";
    const systemPrompt = opts && opts.systemPrompt ? opts.systemPrompt : "";

    if (!apiKey) {
      return { ok: false, text: "No API key configured. Running in Lite Mode." };
    }

    if (provider === "gemini") {
      const m = model || "gemini-2.5-flash";
      const u = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(m) + ":generateContent?key=" + encodeURIComponent(apiKey);
      const txt = systemPrompt ? (systemPrompt + "\n\n" + prompt) : prompt;
      const r = await fetch(u, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: txt }] }] })
      });
      const d = await r.json();
      if (!r.ok) throw new Error((d && d.error && d.error.message) || "Gemini request failed");
      const out = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text ? d.candidates[0].content.parts[0].text : "";
      return { ok: true, text: out, provider: "gemini", model: m };
    }

    const base = provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
    const m = model || (provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini");
    const msgs = [];
    if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
    msgs.push({ role: "user", content: prompt });

    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({ model: m, messages: msgs })
    });
    const d = await r.json();
    if (!r.ok) throw new Error((d && d.error && d.error.message) || "LLM request failed");
    const out = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content ? d.choices[0].message.content : "";
    return { ok: true, text: out, provider: provider, model: m };
  }
}

export const llmBridge = new LlmBridge();
export default llmBridge;
