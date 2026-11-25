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
    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this.blinkProgress = 0;
    this.nextBlinkAt = performance.now() + 2200;
    this.state = "IDLE";
    this.tick = 0;
    this.bindEvents();
    this.loop();
  }

  bindEvents() {
    if (!this.canvas) return;
    window.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.mouseX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.mouseY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    });
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

  draw(now) {
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
    const padding = 10;
    const availW = Math.max(1, width - padding * 2);
    const availH = Math.max(1, height - padding * 2);
    const scale = Math.min(availW / imgW, availH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    const offsetX = (this.mouseX - 0.5) * 14;
    const offsetY = (this.mouseY - 0.5) * 10;
    const x = (width - drawW) / 2 + offsetX;
    const y = (height - drawH) / 2 + offsetY;

    ctx.drawImage(this.img, x, y, drawW, drawH);

    if (this.blinkProgress > 0) {
      const factor = this.blinkProgress <= 1 ? this.blinkProgress : 2 - this.blinkProgress;
      ctx.fillStyle = `rgba(7, 9, 15, ${Math.min(0.65, factor * 0.65)})`;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }

  loop() {
    const frame = (now) => {
      this.draw(now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

export default HudCanvas;