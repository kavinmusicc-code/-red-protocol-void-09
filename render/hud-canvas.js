export class HudCanvas {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.gaze = { x: 0.5, y: 0.5 };
    this.smoothGaze = { x: 0.5, y: 0.5 };
    this.rafId = null;
    this.tick = 0;
    this.reaction = "idle";
    this.reactionUntil = 0;
    this.blinkOpen = 1;
    this.nextBlinkTick = 90;
    this.blinkPhase = null;

    this.img = new Image();
    this.imgLoaded = false;
    this.img.onload = () => {
      this.imgLoaded = true;
    };
    this.img.src = "./Asset/robot-face.jpg";
  }

  clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  setGaze(x, y) {
    if (typeof x === "number" && typeof y === "number") {
      this.gaze.x = this.clamp01(x);
      this.gaze.y = this.clamp01(y);
    }
  }

  triggerReaction(mode = "alert", durationMs = 1400) {
    this.reaction = mode;
    this.reactionUntil = performance.now() + durationMs;
    if (mode === "alert" || mode === "responding") {
      this.blinkPhase = null;
      this.blinkOpen = 1;
    }
  }

  updateBlink() {
    if (this.reaction === "alert" || this.reaction === "responding") {
      this.blinkOpen = 1;
      return;
    }

    if (!this.blinkPhase && this.tick >= this.nextBlinkTick) {
      this.blinkPhase = "closing";
    }

    if (this.blinkPhase === "closing") {
      this.blinkOpen -= 0.24;
      if (this.blinkOpen <= 0) {
        this.blinkOpen = 0;
        this.blinkPhase = "opening";
      }
    } else if (this.blinkPhase === "opening") {
      this.blinkOpen += 0.16;
      if (this.blinkOpen >= 1) {
        this.blinkOpen = 1;
        this.blinkPhase = null;
        this.nextBlinkTick = this.tick + 85 + Math.floor(Math.random() * 120);
      }
    }
  }

  updateMotion() {
    const ease = this.reaction === "alert" ? 0.16 : 0.08;
    this.smoothGaze.x += (this.gaze.x - this.smoothGaze.x) * ease;
    this.smoothGaze.y += (this.gaze.y - this.smoothGaze.y) * ease;

    if (performance.now() > this.reactionUntil) {
      this.reaction = "idle";
    }
  }

  drawFrame() {
    if (!this.ctx || !this.canvas) return;
    this.updateBlink();
    this.updateMotion();

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#050507";
    ctx.fillRect(0, 0, w, h);

    const gxOffset = (this.smoothGaze.x - 0.5) * 26;
    const gyOffset = (this.smoothGaze.y - 0.5) * 18;
    const breathe = Math.sin(this.tick * 0.045) * 3.5;
    const tilt = (this.smoothGaze.x - 0.5) * 0.035 + Math.sin(this.tick * 0.025) * 0.008;
    const intensity = this.reaction === "alert" ? 1.35 : (this.reaction === "responding" ? 1.2 : 1.0);

    ctx.save();
    ctx.translate(w * 0.5 + gxOffset * 0.45, h * 0.5 + gyOffset * 0.45 + breathe * 0.4);
    ctx.rotate(tilt);

    if (this.imgLoaded && this.img.naturalWidth > 0) {
      const scale = Math.max(w / this.img.naturalWidth, h / this.img.naturalHeight) * 1.06;
      const dw = this.img.naturalWidth * scale;
      const dh = this.img.naturalHeight * scale;

      ctx.filter = this.reaction === "alert"
        ? "contrast(1.22) saturate(1.35) brightness(1.06)"
        : "contrast(1.14) saturate(1.18) brightness(0.98)";

      ctx.drawImage(this.img, -dw * 0.5, -dh * 0.5 + breathe * 0.35, dw, dh);
      ctx.filter = "none";
    } else {
      ctx.fillStyle = "#120609";
      ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
      ctx.fillStyle = "#f2ece6";
      ctx.font = "13px monospace";
      ctx.fillText("LOADING ROBOT CORE (./Asset/robot-face.jpg)...", -160, 0);
    }

    // Eye tracking glow & eyelid shutters positioned over upper-center skull eyes
    const eyeY = -h * 0.055 + gyOffset * 0.38;
    const leftEyeX = -w * 0.043 + gxOffset * 0.55;
    const rightEyeX = w * 0.043 + gxOffset * 0.55;
    const eyeRadiusX = Math.max(10, w * 0.024);
    const eyeRadiusY = Math.max(7, h * 0.017) * (this.reaction === "alert" ? 1.18 : 1.0);

    const drawEyeLayer = (ex, ey) => {
      // Glowing crimson iris/pupil shift
      const glowRadius = eyeRadiusX * (1.55 * intensity);
      const grad = ctx.createRadialGradient(ex, ey, 1, ex, ey, glowRadius);
      grad.addColorStop(0, "rgba(255, 70, 85, 0.95)");
      grad.addColorStop(0.45, "rgba(220, 20, 45, 0.55)");
      grad.addColorStop(1, "rgba(220, 20, 45, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ex, ey, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Bright core pinpoint
      ctx.fillStyle = this.reaction === "alert" ? "#ffffff" : "#ff9aa6";
      ctx.beginPath();
      ctx.arc(ex + gxOffset * 0.14, ey + gyOffset * 0.1, Math.max(2.2, eyeRadiusX * 0.22), 0, Math.PI * 2);
      ctx.fill();

      // Eyelid closure (upper + lower dark mechanical shutter)
      const closedRatio = 1 - this.blinkOpen;
      if (closedRatio > 0.02) {
        const lidHeight = eyeRadiusY * 1.35 * closedRatio;
        ctx.fillStyle = "#0b090c";

        ctx.beginPath();
        ctx.ellipse(ex, ey - eyeRadiusY + lidHeight * 0.5, eyeRadiusX * 1.25, lidHeight * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(ex, ey + eyeRadiusY - lidHeight * 0.5, eyeRadiusX * 1.25, lidHeight * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawEyeLayer(leftEyeX, eyeY);
    drawEyeLayer(rightEyeX, eyeY);

    ctx.restore();

    // Menacing dark vignette & subtle crimson edge pulse
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.22, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    vig.addColorStop(0, "rgba(0, 0, 0, 0)");
    vig.addColorStop(1, this.reaction === "alert" ? "rgba(90, 4, 14, 0.62)" : "rgba(4, 4, 6, 0.72)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(242, 236, 230, 0.75)";
    ctx.font = "11px monospace";
    ctx.fillText("VOID-09 // " + this.reaction.toUpperCase() + " [" + this.tick + "]", 14, 22);
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