export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (typeof handler !== "function") return () => {};
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event);
    set.add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    if (typeof handler !== "function") return () => {};
    const wrapper = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event, payload = {}) {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error([EventBus:] handler error:, err);
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
