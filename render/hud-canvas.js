export class HudCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.gaze = { x: 0.5, y: 0.5 };
    this.rafId = null;
    this.tick = 0;
  }

  setGaze(x, y) {
    if (typeof x === "number" && typeof y === "number") {
      this.gaze.x = Math.max(0, Math.min(1, x));
      this.gaze.y = Math.max(0, Math.min(1, y));
    }
  }

  drawFrame() {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#09090d";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(242, 236, 230, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const gx = this.gaze.x * w;
    const gy = this.gaze.y * h;
    const pulse = 18 + Math.sin(this.tick * 0.08) * 4;

    ctx.strokeStyle = "#d91e36";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gx, gy, pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(gx - pulse - 8, gy);
    ctx.lineTo(gx + pulse + 8, gy);
    ctx.moveTo(gx, gy - pulse - 8);
    ctx.lineTo(gx, gy + pulse + 8);
    ctx.stroke();

    ctx.fillStyle = "#f2ece6";
    ctx.font = "12px monospace";
    ctx.fillText("VOID-09 // PREDATOR HUD [" + this.tick + "]", 14, 22);
  }

  start() {
    if (this.rafId) return;
    const loop = () => {
      this.tick += 1;
      this.drawFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export default HudCanvas;