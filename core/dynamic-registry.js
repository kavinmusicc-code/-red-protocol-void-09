const REGISTRY_KEY = "void09_dynamic_registry_v1";

function createDefaultState() {
  return {
    items: [
      {
        id: "seed-cmd-1",
        category: "command",
        title: "Swarm Multi-Angle Check",
        value: "Analyze security, performance, and edge cases from multiple perspectives."
      },
      {
        id: "seed-rule-1",
        category: "bug-rule",
        title: "Debug Console Leftover",
        value: "console.log("
      }
    ]
  };
}

export class DynamicRegistry {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      if (typeof localStorage === "undefined") {
        return createDefaultState();
      }
      const raw = localStorage.getItem(REGISTRY_KEY);
      if (!raw) {
        const initial = createDefaultState();
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(initial));
        return initial;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) {
        return createDefaultState();
      }
      return { items: parsed.items };
    } catch (_) {
      return createDefaultState();
    }
  }

  save(nextState) {
    const clean = {
      items: Array.isArray(nextState && nextState.items) ? nextState.items : []
    };
    this.state = clean;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(clean));
      }
    } catch (_) {}
    return { items: clean.items.slice() };
  }

  getItems(category) {
    const all = this.load().items;
    if (!category) return all.slice();
    return all.filter((item) => item && item.category === category);
  }

  addItem(entry) {
    const data = entry || {};
    const title = String(data.title || "").trim();
    const value = String(data.value || "").trim();
    const category = String(data.category || "command").trim() || "command";
    if (!title && !value) return null;

    const current = this.load();
    const newItem = {
      id: "dyn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      category: category,
      title: title || value.slice(0, 32),
      value: value || title,
      createdAt: new Date().toISOString()
    };

    current.items.unshift(newItem);
    this.save(current);
    return newItem;
  }

  removeItem(id) {
    if (!id) return false;
    const current = this.load();
    const beforeLen = current.items.length;
    current.items = current.items.filter((item) => item && item.id !== id);
    if (current.items.length === beforeLen) return false;
    this.save(current);
    return true;
  }

  clearAll() {
    this.save({ items: [] });
    return [];
  }

  exportJson() {
    return JSON.stringify(this.load(), null, 2);
  }

  importJson(jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || !Array.isArray(parsed.items)) return false;
      this.save({ items: parsed.items });
      return true;
    } catch (_) {
      return false;
    }
  }
}

export const dynamicRegistry = new DynamicRegistry();
export default dynamicRegistry;