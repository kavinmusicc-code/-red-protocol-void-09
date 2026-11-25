import { eventBus } from "./event-bus.js";
import { stateStore } from "./state-store.js";

export class Kernel {
  constructor({ bus = eventBus, store = stateStore } = {}) {
    this.bus = bus;
    this.store = store;
    this.modules = new Map();
    this.started = false;
  }

  register(name, moduleObj = {}) {
    if (!name || this.modules.has(name)) return this;
    this.modules.set(name, moduleObj);
    this.bus.emit("kernel:module_registered", { name });
    return this;
  }

  async boot() {
    if (this.started) return this;
    this.store.hydrate();
    this.bus.emit("kernel:booting", { count: this.modules.size });

    for (const [name, mod] of this.modules.entries()) {
      if (typeof mod.init === "function") {
        try {
          await mod.init({ bus: this.bus, store: this.store, kernel: this });
          this.bus.emit("kernel:module_ready", { name });
        } catch (err) {
          this.store.set({ lastError: ${name}:  });
          this.bus.emit("kernel:module_error", { name, error: err });
        }
      }
    }

    this.started = true;
    this.store.set({ booted: true });
    this.bus.emit("kernel:ready", { modules: [...this.modules.keys()] });
    return this;
  }
}

export const kernel = new Kernel();
