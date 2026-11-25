import { eventBus } from "../core/event-bus.js";
import { perfGovernor } from "../core/perf-governor.js";

export class ScanEngine {
  constructor() {
    this.timer = null;
    this.tickCount = 0;
  }

  start() {
    if (this.timer) return;
    const interval = perfGovernor.getConfig().scanIntervalMs || 350;
    this.timer = setInterval(() => {
      this.tickCount += 1;
      eventBus.emit("vision:scan_tick", { tick: this.tickCount });
    }, interval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const scanEngine = new ScanEngine();
