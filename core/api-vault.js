const STORAGE_KEY = "void09_byok_config_v1";

export const apiVault = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { provider: "openai", model: "", apiKey: "" };
      const parsed = JSON.parse(raw);
      return {
        provider: parsed.provider || "openai",
        model: parsed.model || "",
        apiKey: parsed.apiKey || ""
      };
    } catch {
      return { provider: "openai", model: "", apiKey: "" };
    }
  },

  save({ provider = "openai", model = "", apiKey = "" }) {
    const cleanKey = String(apiKey || "").trim();
    const payload = {
      provider: String(provider || "openai").trim(),
      model: String(model || "").trim(),
      apiKey: cleanKey
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload;
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },

  hasKey() {
    return Boolean(this.load().apiKey);
  },

  maskedKey() {
    const { apiKey } = this.load();
    if (!apiKey) return "NONE";
    if (apiKey.length <= 8) return "********";
    return ${apiKey.slice(0, 4)}...;
  }
};
