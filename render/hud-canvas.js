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
    this.nextBlinkAt = performance.now() + 2400;
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
      this.blinkProgress = 0.06;
    }
    if (this.blinkProgress > 0) {
      this.blinkProgress += 0.14;
      if (this.blinkProgress >= 2) {
        this.blinkProgress = 0;
        this.nextBlinkAt = now + 2600 + Math.random() * 2400;
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

    // Deep HUD background
    ctx.fillStyle = "#06080d";
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
      ctx.fillText("INITIALIZING VOID-09 PERSONA...", 20, 32);
      ctx.restore();
      return;
    }

    const normX = Math.abs(this.gazeX) <= 1 && Math.abs(this.gazeY) <= 1 ? this.gazeX : (this.gazeX - 0.5) * 2;
    const normY = Math.abs(this.gazeY) <= 1 && Math.abs(this.gazeY) <= 1 ? this.gazeY : (this.gazeY - 0.5) * 2;
    const lookX = Math.max(-18, Math.min(18, normX * 14));
    const lookY = Math.max(-12, Math.min(12, normY * 10));

    const imgW = this.img.naturalWidth || this.img.width;
    const imgH = this.img.naturalHeight || this.img.height;

    // Aspect-ratio safe framing (no weird horizontal distortion)
    const boxPad = 10;
    const innerW = Math.max(1, width - boxPad * 2);
    const innerH = Math.max(1, height - boxPad * 2);
    const scale = Math.min(innerW / imgW, innerH / imgH) * 1.18;
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = (width - drawW) / 2 + lookX * 0.7;
    const drawY = boxPad + lookY * 0.5;

    ctx.save();
    ctx.beginPath();
    ctx.rect(boxPad, boxPad, innerW, innerH);
    ctx.clip();

    // Subtle ambient red aura behind persona
    const aura = ctx.createRadialGradient(
      width / 2 + lookX,
      height * 0.42 + lookY,
      10,
      width / 2 + lookX,
      height * 0.42 + lookY,
      Math.max(width, height) * 0.55
    );
    aura.addColorStop(0, "rgba(220, 38, 38, 0.20)");
    aura.addColorStop(1, "rgba(6, 8, 13, 0)");
    ctx.fillStyle = aura;
    ctx.fillRect(boxPad, boxPad, innerW, innerH);

    // Draw portrait cleanly
    ctx.drawImage(this.img, drawX, drawY, drawW, drawH);

    // Smooth eye pulse / blink (soft visor pulse instead of harsh black box)
    const blinkAmt = this.blinkProgress > 0
      ? (this.blinkProgress <= 1 ? this.blinkProgress : 2 - this.blinkProgress)
      : 0;

    const eyeX = drawX + drawW * 0.5 + lookX * 0.25;
    const eyeY = drawY + drawH * 0.34;
    const eyeSpan = drawW * 0.22;

    if (blinkAmt > 0) {
      const shutterH = Math.max(2, drawH * 0.032 * blinkAmt);
      ctx.fillStyle = `rgba(8, 10, 16, ${0.85 * blinkAmt})`;
      ctx.fillRect(eyeX - eyeSpan * 0.5, eyeY - shutterH * 0.5, eyeSpan, shutterH);
    } else {
      const pulse = 0.25 + 0.15 * Math.sin(now * 0.005);
      const glow = ctx.createRadialGradient(eyeX, eyeY, 2, eyeX, eyeY, eyeSpan * 0.7);
      glow.addColorStop(0, `rgba(255, 65, 65, ${pulse})`);
      glow.addColorStop(1, "rgba(255, 65, 65, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(eyeX - eyeSpan, eyeY - eyeSpan * 0.4, eyeSpan * 2, eyeSpan * 0.8);
    }

    // Subtle scanline sweep
    const scanY = boxPad + ((now * 0.045) % innerH);
    ctx.fillStyle = "rgba(255, 70, 70, 0.07)";
    ctx.fillRect(boxPad, scanY, innerW, 2);

    // Corner HUD brackets
    ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
    ctx.lineWidth = 1.5;
    const cLen = 14;

    // Top-left & Top-right
    ctx.beginPath();
    ctx.moveTo(boxPad + 4, boxPad + 4 + cLen);
    ctx.lineTo(boxPad + 4, boxPad + 4);
    ctx.lineTo(boxPad + 4 + cLen, boxPad + 4);
    ctx.moveTo(width - boxPad - 4 - cLen, boxPad + 4);
    ctx.lineTo(width - boxPad - 4, boxPad + 4);
    ctx.lineTo(width - boxPad - 4, boxPad + 4 + cLen);
    ctx.stroke();

    // Status tag
    ctx.fillStyle = "rgba(248, 113, 113, 0.85)";
    ctx.font = "11px monospace";
    ctx.fillText(`VOID-09 // ${this.state}`, boxPad + 12, height - boxPad - 10);

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