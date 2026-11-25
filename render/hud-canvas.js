import { GazeController } from "./gaze-controller.js";
import { perfGovernor } from "../core/perf-governor.js";

export class HudCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.gaze = new GazeController();
    this.rafId = null;
    this.lastFrameTime = 0;
    this.scanPhase = 0;
  }

  setGaze(normX, normY) {
    this.gaze.setTarget(normX, normY);
  }

  start() {
    if (!this.canvas || !this.ctx || this.rafId) return;

    const loop = (now) => {
      this.rafId = requestAnimationFrame(loop);
      const fpsCap = perfGovernor.getConfig().fpsCap || 30;
      const minInterval = 1000 / fpsCap;
      if (now - this.lastFrameTime < minInterval) return;
      this.lastFrameTime = now;
      this.render();
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  render() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const gazePos = this.gaze.step(0.2);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#09090d";
    ctx.fillRect(0, 0, w, h);

    // Subtle skeletal grid & crimson reticle
    ctx.strokeStyle = "rgba(217, 30, 54, 0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, w - 28, h - 28);

    // Scan line (lightweight)
    this.scanPhase = (this.scanPhase + 0.015) % 1;
    const scanY = 20 + this.scanPhase * (h - 40);
    ctx.strokeStyle = "rgba(217, 30, 54, 0.45)";
    ctx.beginPath();
    ctx.moveTo(18, scanY);
    ctx.lineTo(w - 18, scanY);
    ctx.stroke();

    // Twin gaze-locked eyes
    const centerY = h * 0.46;
    const eyeOffsetX = Math.min(70, w * 0.14);
    const lookShiftX = (gazePos.x - 0.5) * 18;
    const lookShiftY = (gazePos.y - 0.5) * 10;

    for (const side of [-1, 1]) {
      const ex = w * 0.5 + side * eyeOffsetX;
      const ey = centerY;

      ctx.strokeStyle = "#f2ece6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 26, 14, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#d91e36";
      ctx.beginPath();
      ctx.arc(ex + lookShiftX, ey + lookShiftY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#9a949c";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(
      PREDATOR RIG // GAZE (, ),
      22,
      h - 24
    );
  }
}
