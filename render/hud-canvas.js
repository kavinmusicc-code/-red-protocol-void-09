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
      this.triggerSpark("ASSET_LOAD_ERROR", 1.25);
    };
    this.img.src = "./Asset/robot-face.jpg";

    this.gazeX = 0;
    this.gazeY = 0;
    this.blinkProgress = 0;
    this.nextBlinkAt = performance.now() + 1800;
    this.state = "APEX_LOCK";
    this.running = false;
    this.rafId = null;
    this.tick = 0;

    // Continuous self-upgrade state
    this.lastUpgradeAt = performance.now();
    this.upgradeStep = 1;
    this.evolutionPower = 12;
    this.upgradeLog = "CORE INITIALIZED // AUTO-EVOLUTION ACTIVE";

    // Error spark state (only on real errors)
    this.sparks = [];
    this.arcs = [];
    this.sparkIntensity = 0;
    this.sparkReason = "";
    this.lastErrorSparkAt = 0;

    // Live Face & Eye Scanner state
    this.scannerActive = false;
    this.scannerStatus = "CAM STANDBY // CLICK [SCAN FACE & EYES]";
    this.videoEl = null;
    this.stream = null;
    this.detector = null;
    this.detectedFace = null;
    this.smoothFace = { x: 0.5, y: 0.48, w: 0.26, h: 0.40 };
    this.lastScanAt = 0;
    this.motionCanvas = document.createElement("canvas");
    this.motionCanvas.width = 64;
    this.motionCanvas.height = 48;
    this.motionCtx = this.motionCanvas.getContext("2d", { willReadFrequently: true });
    this.prevFrameData = null;

    window.__voidHud = this;
    this._createScannerControls();
    this._initFaceDetector();
    this._bindGlobalErrors();
  }

  _bindGlobalErrors() {
    window.addEventListener("error", () => {
      this.triggerSpark("RUNTIME_ERROR", 1.25);
    });
    window.addEventListener("unhandledrejection", () => {
      this.triggerSpark("PROMISE_ERROR", 1.2);
    });
  }

  triggerSpark(reason = "SYSTEM_ERROR", power = 1.15) {
    const now = performance.now();
    if (now - this.lastErrorSparkAt < 350 && this.sparkIntensity > 0.4) return;
    this.lastErrorSparkAt = now;
    this.sparkReason = String(reason || "SYSTEM_ERROR");
    this.sparkIntensity = Math.min(1.4, Math.max(this.sparkIntensity, power));

    const rect = this.canvas ? this.canvas.getBoundingClientRect() : { width: 640, height: 320 };
    const w = Math.max(300, rect.width || 640);
    const h = Math.max(180, rect.height || 320);
    const cx = w * 0.5;
    const cy = h * 0.42;

    const count = Math.floor(30 * power);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2.0 + Math.random() * 8.0) * power;
      const hot = Math.random();
      const color =
        hot > 0.68 ? "#ffffff" :
        hot > 0.35 ? "#ffea54" :
        hot > 0.12 ? "#ff4d29" : "#ff1e42";
      this.sparks.push({
        x: cx + (Math.random() - 0.5) * 36,
        y: cy + (Math.random() - 0.5) * 28,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.0,
        life: 1,
        decay: 0.024 + Math.random() * 0.03,
        size: 1.5 + Math.random() * 2.6,
        color
      });
    }

    const arcCount = Math.floor(5 * power);
    this.arcs = [];
    for (let a = 0; a < arcCount; a++) {
      const targetAngle = Math.random() * Math.PI * 2;
      const dist = (45 + Math.random() * Math.min(w, h) * 0.34) * power;
      const ex = Math.max(12, Math.min(w - 12, cx + Math.cos(targetAngle) * dist));
      const ey = Math.max(12, Math.min(h - 12, cy + Math.sin(targetAngle) * dist));
      const pts = [{ x: cx, y: cy }];
      const segs = 5;
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        pts.push({
          x: cx + (ex - cx) * t + (Math.random() - 0.5) * 24,
          y: cy + (ey - cy) * t + (Math.random() - 0.5) * 24
        });
      }
      pts.push({ x: ex, y: ey });
      this.arcs.push({ pts, life: 1, decay: 0.085 + Math.random() * 0.05 });
    }
  }

  _initFaceDetector() {
    if ("FaceDetector" in window) {
      try {
        this.detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        this.detector = null;
      }
    }
  }

  _createScannerControls() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const old = document.querySelectorAll(".void09-scanner-bar");
    old.forEach((el) => el.remove());

    const parent = this.canvas.parentElement;
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    const bar = document.createElement("div");
    bar.className = "void09-scanner-bar";
    bar.style.cssText = [
      "position:absolute",
      "top:12px",
      "right:14px",
      "z-index:20",
      "display:inline-flex",
      "gap:6px",
      "align-items:center",
      "font-family:monospace",
      "font-size:11px"
    ].join(";");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "SCAN FACE & EYES";
    btn.style.cssText = [
      "background:rgba(185,28,28,0.92)",
      "color:#fff",
      "border:1px solid rgba(254,202,202,0.7)",
      "padding:5px 10px",
      "cursor:pointer",
      "letter-spacing:0.6px",
      "text-transform:uppercase"
    ].join(";");

    btn.addEventListener("click", () => {
      if (this.scannerActive) {
        this.stopScanner();
        btn.textContent = "SCAN FACE & EYES";
      } else {
        this.startScanner().then((ok) => {
          btn.textContent = ok ? "STOP SCAN" : "SCAN FACE & EYES";
        });
      }
    });

    bar.appendChild(btn);
    parent.appendChild(bar);
  }

  async startScanner() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.scannerStatus = "CAM API UNAVAILABLE";
      this.triggerSpark("CAM_API_ERROR", 1.15);
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 } },
        audio: false
      });
      this.videoEl = document.createElement("video");
      this.videoEl.srcObject = this.stream;
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;
      await this.videoEl.play();
      this.scannerActive = true;
      this.scannerStatus = "SIDE CAM LIVE // FACE + EYES SCANNING";
      return true;
    } catch {
      this.scannerStatus = "CAM PERMISSION DENIED / OFFLINE";
      this.scannerActive = false;
      this.triggerSpark("CAM_PERMISSION_ERROR", 1.2);
      return false;
    }
  }

  stopScanner() {
    this.scannerActive = false;
    this.detectedFace = null;
    this.scannerStatus = "CAM STANDBY // CLICK [SCAN FACE & EYES]";
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.videoEl = null;
  }

  async _sampleSubject(now) {
    if (!this.scannerActive || !this.videoEl || this.videoEl.readyState < 2) return;
    if (now - this.lastScanAt < 120) return;
    this.lastScanAt = now;

    if (this.detector) {
      try {
        const faces = await this.detector.detect(this.videoEl);
        const vw = this.videoEl.videoWidth || 640;
        const vh = this.videoEl.videoHeight || 360;
        if (faces && faces.length > 0) {
          const b = faces[0].boundingBox;
          const nx = 1 - (b.x + b.width * 0.5) / vw;
          const ny = (b.y + b.height * 0.5) / vh;
          this.detectedFace = {
            x: Math.max(0.22, Math.min(0.78, nx)),
            y: Math.max(0.22, Math.min(0.76, ny)),
            w: Math.max(0.16, Math.min(0.45, b.width / vw)),
            h: Math.max(0.20, Math.min(0.60, b.height / vh))
          };
          this.gazeX = (this.detectedFace.x - 0.5) * 2;
          this.gazeY = (this.detectedFace.y - 0.5) * 2;
          this.scannerStatus = "FACE + EYES LOCKED // DUAL HUD ACTIVE";
          return;
        }
        this.detectedFace = null;
        this.scannerStatus = "SIDE CAM LIVE // ALIGN FACE IN FRAME";
        return;
      } catch {
        this.detector = null;
      }
    }

    if (this.motionCtx) {
      const mw = this.motionCanvas.width;
      const mh = this.motionCanvas.height;
      this.motionCtx.save();
      this.motionCtx.scale(-1, 1);
      this.motionCtx.drawImage(this.videoEl, -mw, 0, mw, mh);
      this.motionCtx.restore();

      const frame = this.motionCtx.getImageData(0, 0, mw, mh).data;
      if (this.prevFrameData) {
        let sumX = 0;
        let sumY = 0;
        let hits = 0;
        for (let y = 0; y < mh; y += 2) {
          for (let x = 0; x < mw; x += 2) {
            const idx = (y * mw + x) * 4;
            const diff =
              Math.abs(frame[idx] - this.prevFrameData[idx]) +
              Math.abs(frame[idx + 1] - this.prevFrameData[idx + 1]) +
              Math.abs(frame[idx + 2] - this.prevFrameData[idx + 2]);
            if (diff > 55) {
              sumX += x / mw;
              sumY += y / mh;
              hits++;
            }
          }
        }
        if (hits > 24) {
          const cx = Math.max(0.26, Math.min(0.74, sumX / hits));
          const cy = Math.max(0.26, Math.min(0.74, sumY / hits));
          this.detectedFace = { x: cx, y: cy, w: 0.26, h: 0.40 };
          this.gazeX = (cx - 0.5) * 2;
          this.gazeY = (cy - 0.5) * 2;
          this.scannerStatus = "SUBJECT LOCKED // SIDE CAM TRACKING";
        } else {
          this.detectedFace = { x: 0.5, y: 0.48, w: 0.26, h: 0.40 };
          this.scannerStatus = "SIDE CAM LIVE // BIOMETRIC RETICLE READY";
        }
      }
      this.prevFrameData = new Uint8ClampedArray(frame);
    }
  }

  _updateSmoothFace() {
    const target = this.detectedFace || { x: 0.5, y: 0.48, w: 0.26, h: 0.40 };
    const t = 0.16;
    this.smoothFace.x += (target.x - this.smoothFace.x) * t;
    this.smoothFace.y += (target.y - this.smoothFace.y) * t;
    this.smoothFace.w += (target.w - this.smoothFace.w) * t;
    this.smoothFace.h += (target.h - this.smoothFace.h) * t;
  }

  _updateSelfEvolution(now) {
    if (now - this.lastUpgradeAt >= 2500) {
      this.lastUpgradeAt = now;
      this.upgradeStep += 1;
      this.evolutionPower = Math.min(999, this.evolutionPower + Math.floor(4 + ((this.upgradeStep * 3) % 9)));
      const protocols = [
        "NEURAL OPTIC GAIN",
        "RETICLE OVERCLOCK",
        "BIOMETRIC EYE-SYNC",
        "CRIMSON CORE SURGE",
        "PREDATOR VECTOR BOOST"
      ];
      const tag = protocols[this.upgradeStep % protocols.length];
      this.upgradeLog = `UPGRADE #${this.upgradeStep} // ${tag} // PWR:${this.evolutionPower}`;
    }
  }

  _updateSparks() {
    this.sparkIntensity = Math.max(0, this.sparkIntensity - 0.025);
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22;
      p.vx *= 0.985;
      p.life -= p.decay;
      if (p.life <= 0) this.sparks.splice(i, 1);
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      this.arcs[i].life -= this.arcs[i].decay;
      if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    this.stopScanner();
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
    if (!newState) return;
    this.state = newState;
    const upper = String(newState).toUpperCase();
    if (upper.includes("ERROR") || upper.includes("FAIL") || upper.includes("CRITICAL") || upper.includes("FAULT")) {
      this.triggerSpark(`STATE_${upper}`, 1.25);
    }
  }

  updateBlink(now) {
    if (now >= this.nextBlinkAt && this.blinkProgress === 0) {
      this.blinkProgress = 0.08;
    }
    if (this.blinkProgress > 0) {
      this.blinkProgress += 0.16;
      if (this.blinkProgress >= 2) {
        this.blinkProgress = 0;
        this.nextBlinkAt = now + 1900 + Math.random() * 1900;
      }
    }
  }

  _drawRobotPane(ctx, now, rx, ry, rw, rh) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();

    ctx.fillStyle = "#05070d";
    ctx.fillRect(rx, ry, rw, rh);

    if (this.failed) {
      ctx.fillStyle = "#ff4d4d";
      ctx.font = "12px monospace";
      ctx.fillText("ERROR LOADING ./Asset/robot-face.jpg", rx + 14, ry + 28);
      ctx.restore();
      return;
    }

    if (!this.loaded) {
      ctx.fillStyle = "#f87171";
      ctx.font = "12px monospace";
      ctx.fillText("BOOTING ROBOT CORE...", rx + 14, ry + 28);
      ctx.restore();
      return;
    }

    const imgW = this.img.naturalWidth || this.img.width;
    const imgH = this.img.naturalHeight || this.img.height;
    const scale = Math.min(rw / imgW, rh / imgH) * 1.12;
    const dw = imgW * scale;
    const dh = imgH * scale;
    const normX = Math.max(-1, Math.min(1, this.gazeX));
    const normY = Math.max(-1, Math.min(1, this.gazeY));
    const dx = rx + (rw - dw) * 0.5 + normX * 8;
    const dy = ry + normY * 5;

    const glowBg = ctx.createRadialGradient(rx + rw * 0.5, ry + rh * 0.42, 10, rx + rw * 0.5, ry + rh * 0.42, Math.max(rw, rh) * 0.55);
    glowBg.addColorStop(0, "rgba(220, 38, 38, 0.24)");
    glowBg.addColorStop(1, "rgba(5, 7, 13, 0)");
    ctx.fillStyle = glowBg;
    ctx.fillRect(rx, ry, rw, rh);

    ctx.drawImage(this.img, dx, dy, dw, dh);

    const eyeCenterX = dx + dw * 0.5;
    const eyeCenterY = dy + dh * 0.35;
    const eyeSpan = dw * 0.24;

    const blinkAmt = this.blinkProgress > 0
      ? (this.blinkProgress <= 1 ? this.blinkProgress : 2 - this.blinkProgress)
      : 0;

    if (blinkAmt > 0) {
      const lidH = Math.max(3, dh * 0.045 * blinkAmt);
      ctx.fillStyle = `rgba(5, 6, 11, ${0.95 * blinkAmt})`;
      ctx.fillRect(eyeCenterX - eyeSpan * 0.5, eyeCenterY - lidH * 0.5, eyeSpan, lidH);
    } else {
      const pulse = 0.28 + 0.16 * Math.sin(now * 0.008);
      const glow = ctx.createRadialGradient(eyeCenterX, eyeCenterY, 2, eyeCenterX, eyeCenterY, eyeSpan * 0.75);
      glow.addColorStop(0, `rgba(255, 42, 42, ${pulse})`);
      glow.addColorStop(1, "rgba(255, 42, 42, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(eyeCenterX - eyeSpan, eyeCenterY - eyeSpan * 0.45, eyeSpan * 2, eyeSpan * 0.9);
    }

    // Rotating optic ring on robot
    ctx.save();
    ctx.translate(eyeCenterX, eyeCenterY);
    ctx.rotate((now * 0.0012) % (Math.PI * 2));
    ctx.strokeStyle = "rgba(248, 113, 113, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(rw, rh) * 0.20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(252, 165, 165, 0.85)";
    ctx.font = "10px monospace";
    ctx.fillText("CORE // VOID-09", rx + 10, ry + 18);

    ctx.restore();
  }

  _drawCameraPane(ctx, now, cx, cy, cw, ch) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cw, ch);
    ctx.clip();

    ctx.fillStyle = "#06080f";
    ctx.fillRect(cx, cy, cw, ch);

    const liveCamReady = this.scannerActive && this.videoEl && this.videoEl.readyState >= 2;

    if (liveCamReady) {
      const vw = this.videoEl.videoWidth || 640;
      const vh = this.videoEl.videoHeight || 360;
      const scale = Math.max(cw / vw, ch / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = cx + (cw - dw) * 0.5;
      const dy = cy + (ch - dh) * 0.5;

      ctx.save();
      ctx.translate(cx * 2 + cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoEl, dx, dy, dw, dh);
      ctx.restore();

      ctx.fillStyle = "rgba(185, 28, 28, 0.08)";
      ctx.fillRect(cx, cy, cw, ch);

      // Face + Eyes lock reticle inside right camera pane
      const sf = this.smoothFace;
      const fw = Math.max(64, Math.min(cw * 0.52, sf.w * cw * 0.82));
      const fh = Math.max(78, Math.min(ch * 0.64, sf.h * ch * 0.82));
      const minX = cx + 16 + fw * 0.5;
      const maxX = cx + cw - 16 - fw * 0.5;
      const minY = cy + 32 + fh * 0.5;
      const maxY = cy + ch - 24 - fh * 0.5;

      const fx = Math.max(minX, Math.min(maxX, cx + sf.x * cw));
      const fy = Math.max(minY, Math.min(maxY, cy + sf.y * ch));
      const leftBox = fx - fw * 0.5;
      const topBox = fy - fh * 0.5;

      ctx.strokeStyle = "rgba(255, 75, 75, 0.95)";
      ctx.lineWidth = 1.6;
      ctx.strokeRect(leftBox, topBox, fw, fh);

      const leftEyeX = fx - fw * 0.22;
      const rightEyeX = fx + fw * 0.22;
      const scanEyeY = fy - fh * 0.12;

      ctx.strokeStyle = "rgba(254, 240, 138, 0.95)";
      ctx.lineWidth = 1.3;
      ctx.strokeRect(leftEyeX - 10, scanEyeY - 6, 20, 12);
      ctx.strokeRect(rightEyeX - 10, scanEyeY - 6, 20, 12);

      ctx.fillStyle = "#ff3b3b";
      ctx.beginPath();
      ctx.arc(leftEyeX, scanEyeY, 2, 0, Math.PI * 2);
      ctx.arc(rightEyeX, scanEyeY, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(254, 202, 202, 0.98)";
      ctx.font = "10px monospace";
      ctx.fillText("FACE + EYES LOCKED", leftBox, topBox - 5);
    } else {
      ctx.strokeStyle = "rgba(239, 68, 68, 0.22)";
      ctx.strokeRect(cx + 12, cy + 28, cw - 24, ch - 40);
      ctx.fillStyle = "rgba(252, 165, 165, 0.85)";
      ctx.font = "11px monospace";
      ctx.fillText("CAM STANDBY", cx + 18, cy + ch * 0.48);
      ctx.fillStyle = "rgba(248, 113, 113, 0.65)";
      ctx.font = "10px monospace";
      ctx.fillText("CLICK [SCAN FACE & EYES]", cx + 18, cy + ch * 0.48 + 16);
    }

    // Subtle scan beam inside camera pane
    const beamY = cy + ((now * 0.08) % Math.max(1, ch));
    ctx.fillStyle = "rgba(255, 75, 75, 0.20)";
    ctx.fillRect(cx, beamY, cw, 2);

    ctx.fillStyle = "rgba(252, 165, 165, 0.85)";
    ctx.font = "10px monospace";
    ctx.fillText("OPTIC // CAM", cx + 10, cy + 18);

    ctx.restore();
  }

  draw(now = performance.now()) {
    if (!this.canvas || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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

    this.tick += 1;
    this._updateSelfEvolution(now);
    this.updateBlink(now);
    this._sampleSubject(now);
    this._updateSmoothFace();
    this._updateSparks();

    const shakeX = this.sparkIntensity > 0 ? (Math.random() - 0.5) * 9 * this.sparkIntensity : 0;
    const shakeY = this.sparkIntensity > 0 ? (Math.random() - 0.5) * 7 * this.sparkIntensity : 0;
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = "#040509";
    ctx.fillRect(-12, -12, width + 24, height + 24);

    const pad = 6;
    const gap = 8;
    const boxW = Math.max(1, width - pad * 2);
    const boxH = Math.max(1, height - pad * 2);
    const sideBySide = boxW >= 460;

    if (sideBySide) {
      const paneW = Math.floor((boxW - gap) * 0.5);
      const paneH = boxH;
      this._drawRobotPane(ctx, now, pad, pad, paneW, paneH);
      this._drawCameraPane(ctx, now, pad + paneW + gap, pad, boxW - paneW - gap, paneH);

      // Divider line between robot & camera panes
      ctx.strokeStyle = "rgba(248, 113, 113, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pad + paneW + gap * 0.5, pad + 6);
      ctx.lineTo(pad + paneW + gap * 0.5, pad + paneH - 6);
      ctx.stroke();
    } else {
      const paneH = Math.floor((boxH - gap) * 0.5);
      this._drawRobotPane(ctx, now, pad, pad, boxW, paneH);
      this._drawCameraPane(ctx, now, pad, pad + paneH + gap, boxW, boxH - paneH - gap);
    }

    // Error Sparks & Lightning Arcs
    if (this.sparkIntensity > 0.05) {
      ctx.fillStyle = `rgba(255, 60, 30, ${Math.min(0.22, this.sparkIntensity * 0.16)})`;
      ctx.fillRect(pad, pad, boxW, boxH);
    }

    for (const arc of this.arcs) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, arc.life));
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 2.4;
      ctx.shadowColor = "#ff3b1f";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      arc.pts.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.sparks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Outer HUD corner brackets
    const bLen = 18;
    ctx.strokeStyle = this.sparkIntensity > 0.2 ? "rgba(253, 224, 71, 0.95)" : "rgba(248, 113, 113, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad + 4, pad + 4 + bLen);
    ctx.lineTo(pad + 4, pad + 4);
    ctx.lineTo(pad + 4 + bLen, pad + 4);

    ctx.moveTo(width - pad - 4 - bLen, pad + 4);
    ctx.lineTo(width - pad - 4, pad + 4);
    ctx.lineTo(width - pad - 4, pad + 4 + bLen);

    ctx.moveTo(pad + 4, height - pad - 4 - bLen);
    ctx.lineTo(pad + 4, height - pad - 4);
    ctx.lineTo(pad + 4 + bLen, height - pad - 4);

    ctx.moveTo(width - pad - 4 - bLen, height - pad - 4);
    ctx.lineTo(width - pad - 4, height - pad - 4);
    ctx.lineTo(width - pad - 4, height - pad - 4 - bLen);
    ctx.stroke();

    // Bottom telemetry bar
    ctx.fillStyle = "rgba(4, 6, 12, 0.78)";
    ctx.fillRect(pad + 4, height - pad - 34, boxW - 8, 30);

    ctx.fillStyle = "rgba(252, 165, 165, 0.95)";
    ctx.font = "11px monospace";
    const sparkTag = this.sparkIntensity > 0.1 ? ` // ⚡ ${this.sparkReason}` : "";
    ctx.fillText(`VOID-09 v${(1 + this.upgradeStep * 0.1).toFixed(1)} // ${this.state}${sparkTag}`, pad + 12, height - pad - 21);
    ctx.fillStyle = "rgba(248, 113, 113, 0.85)";
    ctx.font = "10px monospace";
    ctx.fillText(`${this.upgradeLog} | ${this.scannerStatus}`, pad + 12, height - pad - 8);

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