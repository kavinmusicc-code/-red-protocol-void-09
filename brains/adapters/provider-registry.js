export const PROVIDERS = {
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-4o-mini",
    endpoint: "https://api.openai.com/v1/chat/completions"
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models"
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    endpoint: "https://openrouter.ai/api/v1/chat/completions"
  },
  custom: {
    id: "custom",
    name: "Custom Compatible",
    defaultModel: "default",
    endpoint: ""
  }
};

export function getProviderConfig(id = "openai") {
  return PROVIDERS[id] || PROVIDERS.openai;
}
