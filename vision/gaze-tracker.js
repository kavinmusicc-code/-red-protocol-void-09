import { eventBus } from "../core/event-bus.js";

export class GazeTracker {
  constructor() {
    this.active = false;
    this._onMove = (e) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      eventBus.emit("vision:gaze", {
        x: e.clientX / w,
        y: e.clientY / h
      });
    };
  }

  start() {
    if (this.active || typeof window === "undefined") return;
    this.active = true;
    window.addEventListener("pointermove", this._onMove, { passive: true });
  }

  stop() {
    if (!this.active || typeof window === "undefined") return;
    this.active = false;
    window.removeEventListener("pointermove", this._onMove);
  }
}

export const gazeTracker = new GazeTracker();
