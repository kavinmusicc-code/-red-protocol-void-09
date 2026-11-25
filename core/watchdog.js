import { eventBus } from "./event-bus.js";
import { stateStore } from "./state-store.js";

export class Watchdog {
  constructor() {
    this.errors = [];
    this.maxErrors = 25;
    this.active = false;
  }

  start() {
    if (this.active || typeof window === "undefined") return;
    this.active = true;

    window.addEventListener("error", (event) => {
      this.record({
        type: "error",
        message: event.message || "Unhandled error",
        source: event.filename || "window",
        line: event.lineno || 0
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason?.message || String(event.reason || "Promise rejection");
      this.record({
        type: "rejection",
        message: reason,
        source: "promise",
        line: 0
      });
    });
  }

  record(entry) {
    const item = { ...entry, ts: Date.now() };
    this.errors.push(item);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    stateStore.set({ lastError: item.message, alertLevel: "elevated" });
    eventBus.emit("watchdog:error", item);
  }

  getErrors() {
    return [...this.errors];
  }
}

export const watchdog = new Watchdog();
