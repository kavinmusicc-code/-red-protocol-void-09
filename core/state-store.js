import { eventBus } from "./event-bus.js";

const STATE_KEY = "void09_state_v1";

const DEFAULT_STATE = {
  booted: false,
  unlocked: false,
  profile: "lite",
  activeBrain: "predator",
  activeView: "predator-stage",
  speaking: false,
  alertLevel: "normal",
  lastError: null
};

export class StateStore {
  constructor(initial = {}) {
    this.state = { ...DEFAULT_STATE, ...initial };
  }

  get(key) {
    return key ? this.state[key] : { ...this.state };
  }

  set(patch = {}, { persist = false, silent = false } = {}) {
    const prev = { ...this.state };
    this.state = { ...this.state, ...patch };

    if (persist) {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(this.state));
      } catch {
        // Ignore storage quota or restricted mode errors
      }
    }

    if (!silent) {
      eventBus.emit("state:changed", { prev, next: { ...this.state }, patch });
    }
    return this.get();
  }

  hydrate() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return this.get();
      const parsed = JSON.parse(raw);
      this.state = { ...this.state, ...parsed, booted: false, speaking: false };
    } catch {
      // Keep defaults if corrupted
    }
    return this.get();
  }
}

export const stateStore = new StateStore();
