export class HudCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.img = new Image();
    this.loaded = false;
    this.failed = false;
    this.img.onload = () => {
      this.loaded = true;
      this.failed = false;
    };
    this.img.onerror = () => {
      this.failed = true;
    };
    this.img.src = "./Asset/robot-face.jpg";
    this.gazeX = 0;
    this.gazeY = 0;
    this.blinkProgress = 0;
    this.nextBlinkAt = performance.now() + 2200;
    this.state = "IDLE";
    this.running = false;
    this.rafId = null;
    this.tick = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setGaze(x, y) {
    if (typeof x === "object" && x !== null) {
      this.gazeX = Number(x.x ?? 0);
      this.gazeY = Number(x.y ?? 0);
      return;
    }
    this.gazeX = Number(x ?? 0);
    this.gazeY = Number(y ?? 0);
  }

  setState(newState) {
    if (newState) this.state = newState;
  }

  updateBlink(now) {
    if (now >= this.nextBlinkAt && this.blinkProgress === 0) {
      this.blinkProgress = 0.05;
    }
    if (this.blinkProgress > 0) {
      this.blinkProgress += 0.14;
      if (this.blinkProgress >= 2) {
        this.blinkProgress = 0;
        this.nextBlinkAt = now + 2400 + Math.random() * 2600;
      }
    }
  }

  draw(now = performance.now()) {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width || this.canvas.clientWidth || 640));
    const height = Math.max(180, Math.floor(rect.height || this.canvas.clientHeight || 320));

    if (this.canvas.width !== Math.floor(width * dpr) || this.canvas.height !== Math.floor(height * dpr)) {
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#07090f";
    ctx.fillRect(0, 0, width, height);

    this.tick += 1;
    this.updateBlink(now);

    if (this.failed) {
      ctx.fillStyle = "#ff4d4d";
      ctx.font = "13px monospace";
      ctx.fillText("ERROR LOADING ./Asset/robot-face.jpg", 20, 32);
      ctx.restore();
      return;
    }

    if (!this.loaded) {
      ctx.fillStyle = "#cfd8e3";
      ctx.font = "13px monospace";
      ctx.fillText("LOADING ROBOT CORE (./Asset/robot-face.jpg)...", 20, 32);
      ctx.restore();
      return;
    }

    const imgW = this.img.naturalWidth || this.img.width;
    const imgH = this.img.naturalHeight || this.img.height;

    const normX = Math.abs(this.gazeX) <= 1 && Math.abs(this.gazeY) <= 1 ? this.gazeX : (this.gazeX - 0.5) * 2;
    const normY = Math.abs(this.gazeY) <= 1 && Math.abs(this.gazeY) <= 1 ? this.gazeY : (this.gazeY - 0.5) * 2;
    const offsetX = Math.max(-16, Math.min(16, normX * 12));
    const offsetY = Math.max(-12, Math.min(12, normY * 9));

    const padding = 8;
    const availW = Math.max(1, width - padding * 2);
    const availH = Math.max(1, height - padding * 2);
    const scale = Math.min(availW / imgW, availH / imgH) * 1.28;
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    const x = (width - drawW) / 2 + offsetX;
    const y = padding + offsetY;

    ctx.save();
    ctx.beginPath();
    ctx.rect(padding, padding, availW, availH);
    ctx.clip();

    ctx.drawImage(this.img, x, y, drawW, drawH);

    // Sirf aankhon ke area ke aas-paas halka eyelid/blink shutter effect (poore photo par nahi)
    if (this.blinkProgress > 0) {
      const factor = this.blinkProgress <= 1 ? this.blinkProgress : 2 - this.blinkProgress;
      const eyeBandW = drawW * 0.36;
      const eyeBandH = drawH * 0.08 * Math.min(1, factor);
      const eyeCenterX = x + drawW * 0.5;
      const eyeCenterY = y + drawH * 0.25;

      ctx.fillStyle = "rgba(7, 9, 15, 0.92)";
      ctx.fillRect(eyeCenterX - eyeBandW / 2, eyeCenterY - eyeBandH / 2, eyeBandW, eyeBandH);
    }

    ctx.restore();
    ctx.restore();
  }

  loop() {
    const frame = (now) => {
      if (!this.running) return;
      this.draw(now);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }
}

export default HudCanvas;