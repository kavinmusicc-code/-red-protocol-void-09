import { apiVault } from "../../core/api-vault.js";
import { getProviderConfig } from "./provider-registry.js";
import { localEngine } from "./local-engine.js";

export class LlmBridge {
  async generate({ prompt, systemPrompt = "", brain = "predator", customEndpoint = "" }) {
    const cfg = apiVault.load();
    if (!cfg.apiKey) {
      return localEngine.respond({ prompt, brain });
    }

    const provider = getProviderConfig(cfg.provider);
    const model = cfg.model || provider.defaultModel;

    if (cfg.provider === "gemini") {
      const baseUrl = provider.endpoint;
      const url = ${baseUrl}/:generateContent?key=;
      const mergedText = systemPrompt ? ${systemPrompt}\n\n : prompt;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: mergedText }] }]
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(Gemini API : );
      }

      const data = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Empty response received from Gemini.";
      return { source: yok::, brain, text };
    }

    const endpoint = customEndpoint || provider.endpoint;
    if (!endpoint) {
      throw new Error("Custom endpoint is missing.");
    }

    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: Bearer 
      },
      body: JSON.stringify({ model, messages })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(Provider API : );
    }

    const data = await res.json();
    const text =
      data?.choices?.[0]?.message?.content ||
      "Empty response received from model.";
    return { source: yok::, brain, text };
  }
}

export const llmBridge = new LlmBridge();
