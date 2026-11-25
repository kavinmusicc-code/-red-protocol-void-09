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
    this.nextBlinkAt = performance.now() + 2100;
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
      this.blinkProgress += 0.15;
      if (this.blinkProgress >= 2) {
        this.blinkProgress = 0;
        this.nextBlinkAt = now + 2200 + Math.random() * 2200;
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

    ctx.fillStyle = "#05070c";
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
      ctx.fillStyle = "#f87171";
      ctx.font = "13px monospace";
      ctx.fillText("BOOTING VOID-09 OPTIC CORE...", 20, 32);
      ctx.restore();
      return;
    }

    const normX = Math.abs(this.gazeX) <= 1 && Math.abs(this.gazeY) <= 1 ? this.gazeX : (this.gazeX - 0.5) * 2;
    const normY = Math.abs(this.gazeY) <= 1 && Math.abs(this.gazeY) <= 1 ? this.gazeY : (this.gazeY - 0.5) * 2;
    const gazeOffsetX = Math.max(-18, Math.min(18, normX * 14));
    const gazeOffsetY = Math.max(-14, Math.min(14, normY * 10));

    const pad = 6;
    const boxW = Math.max(1, width - pad * 2);
    const boxH = Math.max(1, height - pad * 2);

    const imgW = this.img.naturalWidth || this.img.width;
    const imgH = this.img.naturalHeight || this.img.height;

    // Cover-style smart crop focusing on head & eyes without harsh stretching
    const targetAspect = boxW / boxH;
    const imgAspect = imgW / imgH;

    let sx = 0;
    let sy = 0;
    let sWidth = imgW;
    let sHeight = imgH;

    if (imgAspect > targetAspect) {
      sWidth = imgH * targetAspect;
      sx = (imgW - sWidth) * 0.5;
    } else {
      sHeight = imgW / targetAspect;
      sy = Math.max(0, imgH * 0.08);
      if (sy + sHeight > imgH) sy = Math.max(0, imgH - sHeight);
    }

    // Slight zoom & gaze shift inside source crop
    const zoom = 1.08;
    const zW = sWidth / zoom;
    const zH = sHeight / zoom;
    sx = Math.max(0, Math.min(imgW - zW, sx + (sWidth - zW) * 0.5 + gazeOffsetX * 1.4));
    sy = Math.max(0, Math.min(imgH - zH, sy + (sHeight - zH) * 0.35 + gazeOffsetY * 1.2));

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, pad, boxW, boxH);
    ctx.clip();

    ctx.drawImage(this.img, sx, sy, zW, zH, pad, pad, boxW, boxH);

    // Subtle crimson tint & dark edge vignette for killer HUD depth
    const vig = ctx.createRadialGradient(
      width * 0.5 + gazeOffsetX * 0.5,
      height * 0.42 + gazeOffsetY * 0.5,
      Math.min(boxW, boxH) * 0.18,
      width * 0.5,
      height * 0.5,
      Math.max(boxW, boxH) * 0.72
    );
    vig.addColorStop(0, "rgba(220, 38, 38, 0.05)");
    vig.addColorStop(0.75, "rgba(6, 8, 14, 0.25)");
    vig.addColorStop(1, "rgba(4, 5, 10, 0.78)");
    ctx.fillStyle = vig;
    ctx.fillRect(pad, pad, boxW, boxH);

    // Eye-level blink shutter + glowing optic pulse
    const blinkAmt = this.blinkProgress > 0
      ? (this.blinkProgress <= 1 ? this.blinkProgress : 2 - this.blinkProgress)
      : 0;

    const eyeCenterX = width * 0.5 + gazeOffsetX * 0.6;
    const eyeCenterY = pad + boxH * 0.37 + gazeOffsetY * 0.4;
    const eyeSpan = boxW * 0.14;

    if (blinkAmt > 0) {
      const lidH = Math.max(3, boxH * 0.055 * blinkAmt);
      ctx.fillStyle = `rgba(6, 8, 13, ${0.92 * blinkAmt})`;
      ctx.fillRect(eyeCenterX - eyeSpan * 0.5, eyeCenterY - lidH * 0.5, eyeSpan, lidH);
    } else {
      const glowAlpha = 0.24 + 0.14 * Math.sin(now * 0.006);
      const eyeGlow = ctx.createRadialGradient(eyeCenterX, eyeCenterY, 2, eyeCenterX, eyeCenterY, eyeSpan * 0.75);
      eyeGlow.addColorStop(0, `rgba(255, 55, 55, ${glowAlpha})`);
      eyeGlow.addColorStop(1, "rgba(255, 55, 55, 0)");
      ctx.fillStyle = eyeGlow;
      ctx.fillRect(eyeCenterX - eyeSpan, eyeCenterY - eyeSpan * 0.45, eyeSpan * 2, eyeSpan * 0.9);
    }

    // Sweeping laser scan beam
    const beamY = pad + ((now * 0.065) % boxH);
    const beamGrad = ctx.createLinearGradient(0, beamY - 8, 0, beamY + 8);
    beamGrad.addColorStop(0, "rgba(239, 68, 68, 0)");
    beamGrad.addColorStop(0.5, "rgba(248, 113, 113, 0.28)");
    beamGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = beamGrad;
    ctx.fillRect(pad, beamY - 8, boxW, 16);

    // Subtle targeting reticle ring around optic zone
    ctx.strokeStyle = "rgba(239, 68, 68, 0.26)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(eyeCenterX, eyeCenterY, Math.min(boxW, boxH) * 0.16, 0, Math.PI * 2);
    ctx.stroke();

    // Sharp corner HUD brackets
    const bLen = 18;
    ctx.strokeStyle = "rgba(248, 113, 113, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(pad + 6, pad + 6 + bLen);
    ctx.lineTo(pad + 6, pad + 6);
    ctx.lineTo(pad + 6 + bLen, pad + 6);
    // Top-right
    ctx.moveTo(width - pad - 6 - bLen, pad + 6);
    ctx.lineTo(width - pad - 6, pad + 6);
    ctx.lineTo(width - pad - 6, pad + 6 + bLen);
    // Bottom-left
    ctx.moveTo(pad + 6, height - pad - 6 - bLen);
    ctx.lineTo(pad + 6, height - pad - 6);
    ctx.lineTo(pad + 6 + bLen, height - pad - 6);
    // Bottom-right
    ctx.moveTo(width - pad - 6 - bLen, height - pad - 6);
    ctx.lineTo(width - pad - 6, height - pad - 6);
    ctx.lineTo(width - pad - 6, height - pad - 6 - bLen);
    ctx.stroke();

    // Live telemetry label
    ctx.fillStyle = "rgba(252, 165, 165, 0.9)";
    ctx.font = "11px monospace";
    ctx.fillText(`VOID-09 // ${this.state} // LOCK`, pad + 14, height - pad - 12);

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