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
        return { ...DEFAULT_CONFIG };
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_CONFIG };
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
      return { ...DEFAULT_CONFIG };
    }
  }

  save(nextCfg = {}) {
    const current = this.load();
    const updated = {
      provider: typeof nextCfg.provider === "string" && nextCfg.provider.trim()
        ? nextCfg.provider.trim()
        : current.provider,
      model: typeof nextCfg.model === "string" ? nextCfg.model.trim() : current.model,
      apiKey: typeof nextCfg.apiKey === "string" ? nextCfg.apiKey.trim() : current.apiKey
    };

    this.config = updated;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (_) {}

    return { ...updated };
  }

  clear() {
    this.config = { ...DEFAULT_CONFIG };
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
    return { ...this.config };
  }

  getConfig() {
    return { ...this.load() };
  }

  hasKey() {
    return Boolean(this.load().apiKey);
  }

  maskedKey() {
    const key = this.load().apiKey;
    if (!key) return "NONE";
    if (key.length <= 8) return "****";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
}

export const apiVault = new ApiVault();
export default apiVault;
