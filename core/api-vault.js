const STORAGE_KEY = "void09_byok_vault_v1";

const DEFAULT_CONFIG = {
  provider: "openai",
  model: "",
  apiKey: ""
};

export class ApiVault {
  constructor() {
    this.config = this.load();
  }

  load() {
    try {
      if (typeof localStorage === "undefined") {
        return Object.assign({}, DEFAULT_CONFIG);
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return Object.assign({}, DEFAULT_CONFIG);
      }
      const parsed = JSON.parse(raw);
      return {
        provider: typeof parsed.provider === "string" && parsed.provider.trim()
          ? parsed.provider.trim()
          : DEFAULT_CONFIG.provider,
        model: typeof parsed.model === "string" ? parsed.model.trim() : "",
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : ""
      };
    } catch (_) {
      return Object.assign({}, DEFAULT_CONFIG);
    }
  }

  save(nextCfg) {
    const cfg = nextCfg || {};
    const current = this.load();
    const updated = {
      provider: typeof cfg.provider === "string" && cfg.provider.trim()
        ? cfg.provider.trim()
        : current.provider,
      model: typeof cfg.model === "string" ? cfg.model.trim() : current.model,
      apiKey: typeof cfg.apiKey === "string" ? cfg.apiKey.trim() : current.apiKey
    };

    this.config = updated;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (_) {}

    return Object.assign({}, updated);
  }

  clear() {
    this.config = Object.assign({}, DEFAULT_CONFIG);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
    return Object.assign({}, this.config);
  }

  getConfig() {
    return Object.assign({}, this.load());
  }

  hasKey() {
    return Boolean(this.load().apiKey);
  }

  maskedKey() {
    const key = this.load().apiKey;
    if (!key) return "NONE";
    if (key.length <= 8) return "****";
    return key.slice(0, 4) + "..." + key.slice(-4);
  }
}

export const apiVault = new ApiVault();
export default apiVault;
