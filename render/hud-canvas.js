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
    this.startedAt = performance.now();
    this.lastUpgradeAt = performance.now();
    this.upgradeStep = 1;
    this.evolutionPower = 12;
    this.upgradeLog = "CORE INITIALIZED // AUTO-EVOLUTION ACTIVE";

    // Error spark state (only on real faults/errors)
    this.sparks = [];
    this.arcs = [];
    this.sparkIntensity = 0;
    this.sparkReason = "";
    this.lastErrorSparkAt = 0;

    // Face & eye scanner state
    this.scannerActive = false;
    this.scannerStatus = "STANDBY // CLICK [SCAN FACE & EYES]";
    this.videoEl = null;
    this.stream = null;
    this.detector = null;
    this.detectedFace = null;
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

  triggerSpark(reason = "SYSTEM_ERROR", power = 1.1) {
    const now = performance.now();
    if (now - this.lastErrorSparkAt < 350 && this.sparkIntensity > 0.4) return;
    this.lastErrorSparkAt = now;
    this.sparkReason = String(reason || "SYSTEM_ERROR");
    this.sparkIntensity = Math.min(1.4, Math.max(this.sparkIntensity, power));

    const rect = this.canvas ? this.canvas.getBoundingClientRect() : { width: 640, height: 320 };
    const w = Math.max(300, rect.width || 640);
    const h = Math.max(180, rect.height || 320);
    const cx = w * (0.5 + Math.max(-0.3, Math.min(0.3, this.gazeX * 0.25)));
    const cy = h * (0.38 + Math.max(-0.25, Math.min(0.25, this.gazeY * 0.2)));

    const count = Math.floor(28 * power);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2.0 + Math.random() * 7.5) * power;
      const hot = Math.random();
      const color =
        hot > 0.68 ? "#ffffff" :
        hot > 0.35 ? "#ffea54" :
        hot > 0.12 ? "#ff4d29" : "#ff1e42";
      this.sparks.push({
        x: cx + (Math.random() - 0.5) * 32,
        y: cy + (Math.random() - 0.5) * 24,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.0,
        life: 1,
        decay: 0.025 + Math.random() * 0.03,
        size: 1.5 + Math.random() * 2.5,
        color
      });
    }

    const arcCount = Math.floor(4 * power);
    this.arcs = [];
    for (let a = 0; a < arcCount; a++) {
      const targetAngle = Math.random() * Math.PI * 2;
      const dist = (40 + Math.random() * Math.min(w, h) * 0.32) * power;
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
    if (this.canvas.parentElement.querySelector(".void09-scanner-bar")) return;

    const parent = this.canvas.parentElement;
    if (getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    const bar = document.createElement("div");
    bar.className = "void09-scanner-bar";
    bar.style.cssText = [
      "position:absolute",
      "top:10px",
      "right:12px",
      "z-index:10",
      "display:flex",
      "gap:6px",
      "align-items:center",
      "font-family:monospace",
      "font-size:11px"
    ].join(";");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "SCAN FACE & EYES";
    btn.style.cssText = [
      "background:rgba(185,28,28,0.88)",
      "color:#fff",
      "border:1px solid rgba(254,202,202,0.5)",
      "padding:4px 8px",
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
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false
      });
      this.videoEl = document.createElement("video");
      this.videoEl.srcObject = this.stream;
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;
      await this.videoEl.play();
      this.scannerActive = true;
      this.scannerStatus = "OPTIC SCAN ONLINE // LOCKING SUBJECT";
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
    this.scannerStatus = "SCANNER OFFLINE";
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.videoEl = null;
  }

  async _sampleSubject(now) {
    if (!this.scannerActive || !this.videoEl || this.videoEl.readyState < 2) return;
    if (now - this.lastScanAt < 140) return;
    this.lastScanAt = now;

    if (this.detector) {
      try {
        const faces = await this.detector.detect(this.videoEl);
        const vw = this.videoEl.videoWidth || 320;
        const vh = this.videoEl.videoHeight || 240;
        if (faces && faces.length > 0) {
          const b = faces[0].boundingBox;
          const nx = 1 - (b.x + b.width * 0.5) / vw;
          const ny = (b.y + b.height * 0.5) / vh;
          this.detectedFace = {
            x: Math.max(0.08, Math.min(0.92, nx)),
            y: Math.max(0.12, Math.min(0.88, ny)),
            w: Math.max(0.14, Math.min(0.5, b.width / vw)),
            h: Math.max(0.18, Math.min(0.65, b.height / vh))
          };
          this.gazeX = (this.detectedFace.x - 0.5) * 2;
          this.gazeY = (this.detectedFace.y - 0.5) * 2;
          this.scannerStatus = `TARGET LOCKED // FACE + EYES (${Math.round(this.detectedFace.w * 100)}%)`;
          return;
        }
        this.detectedFace = null;
        this.scannerStatus = "SCANNING FIELD // NO FACE IN FRAME";
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
        if (hits > 22) {
          const cx = Math.max(0.15, Math.min(0.85, sumX / hits));
          const cy = Math.max(0.18, Math.min(0.82, sumY / hits));
          this.detectedFace = { x: cx, y: cy, w: 0.24, h: 0.34 };
          this.gazeX = (cx - 0.5) * 2;
          this.gazeY = (cy - 0.5) * 2;
          this.scannerStatus = "SUBJECT DETECTED // OPTICAL MOTION LOCK";
        } else {
          this.detectedFace = null;
          this.scannerStatus = "OPTIC ACTIVE // AWAITING SUBJECT";
        }
      }
      this.prevFrameData = new Uint8ClampedArray(frame);
    }
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

    this.tick += 1;
    this._updateSelfEvolution(now);
    this.updateBlink(now);
    this._sampleSubject(now);
    this._updateSparks();

    const shakeX = this.sparkIntensity > 0 ? (Math.random() - 0.5) * 9 * this.sparkIntensity : 0;
    const shakeY = this.sparkIntensity > 0 ? (Math.random() - 0.5) * 7 * this.sparkIntensity : 0;
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = "#040509";
    ctx.fillRect(-12, -12, width + 24, height + 24);

    if (this.failed) {
      ctx.fillStyle = "#ff4d4d";
      ctx.font = "13px monospace";
      ctx.fillText("ERROR LOADING ./Asset/robot-face.jpg", 20, 32);
    } else if (!this.loaded) {
      ctx.fillStyle = "#f87171";
      ctx.font = "13px monospace";
      ctx.fillText("INITIALIZING VOID-09 APEX CORE...", 20, 32);
    } else {
      const normX = Math.max(-1, Math.min(1, this.gazeX));
      const normY = Math.max(-1, Math.min(1, this.gazeY));
      const gazeOffsetX = normX * 16;
      const gazeOffsetY = normY * 12;

      const pad = 6;
      const boxW = Math.max(1, width - pad * 2);
      const boxH = Math.max(1, height - pad * 2);

      const imgW = this.img.naturalWidth || this.img.width;
      const imgH = this.img.naturalHeight || this.img.height;

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
        sy = Math.max(0, imgH * 0.06);
        if (sy + sHeight > imgH) sy = Math.max(0, imgH - sHeight);
      }

      const evoZoom = 1.06 + Math.min(0.14, (this.upgradeStep % 12) * 0.01);
      const zW = sWidth / evoZoom;
      const zH = sHeight / evoZoom;
      sx = Math.max(0, Math.min(imgW - zW, sx + (sWidth - zW) * 0.5 + gazeOffsetX * 1.5));
      sy = Math.max(0, Math.min(imgH - zH, sy + (sHeight - zH) * 0.34 + gazeOffsetY * 1.2));

      ctx.save();
      ctx.beginPath();
      ctx.rect(pad, pad, boxW, boxH);
      ctx.clip();

      ctx.drawImage(this.img, sx, sy, zW, zH, pad, pad, boxW, boxH);

      ctx.strokeStyle = "rgba(239, 68, 68, 0.08)";
      ctx.lineWidth = 1;
      const stepGrid = 28;
      for (let gx = pad; gx < pad + boxW; gx += stepGrid) {
        ctx.beginPath();
        ctx.moveTo(gx, pad);
        ctx.lineTo(gx, pad + boxH);
        ctx.stroke();
      }
      for (let gy = pad; gy < pad + boxH; gy += stepGrid) {
        ctx.beginPath();
        ctx.moveTo(pad, gy);
        ctx.lineTo(pad + boxW, gy);
        ctx.stroke();
      }

      const vig = ctx.createRadialGradient(
        width * 0.5 + gazeOffsetX * 0.5,
        height * 0.42 + gazeOffsetY * 0.5,
        Math.min(boxW, boxH) * 0.16,
        width * 0.5,
        height * 0.5,
        Math.max(boxW, boxH) * 0.74
      );
      vig.addColorStop(0, "rgba(220, 38, 38, 0.08)");
      vig.addColorStop(0.7, "rgba(10, 4, 8, 0.32)");
      vig.addColorStop(1, "rgba(3, 4, 8, 0.85)");
      ctx.fillStyle = vig;
      ctx.fillRect(pad, pad, boxW, boxH);

      const blinkAmt = this.blinkProgress > 0
        ? (this.blinkProgress <= 1 ? this.blinkProgress : 2 - this.blinkProgress)
        : 0;

      const eyeCenterX = width * 0.5 + gazeOffsetX * 0.65;
      const eyeCenterY = pad + boxH * 0.37 + gazeOffsetY * 0.45;
      const eyeSpan = boxW * 0.15;

      if (blinkAmt > 0) {
        const lidH = Math.max(3, boxH * 0.06 * blinkAmt);
        ctx.fillStyle = `rgba(5, 6, 11, ${0.95 * blinkAmt})`;
        ctx.fillRect(eyeCenterX - eyeSpan * 0.5, eyeCenterY - lidH * 0.5, eyeSpan, lidH);
      } else {
        const pulse = 0.32 + 0.18 * Math.sin(now * 0.008);
        const glow = ctx.createRadialGradient(eyeCenterX, eyeCenterY, 2, eyeCenterX, eyeCenterY, eyeSpan * 0.85);
        glow.addColorStop(0, `rgba(255, 42, 42, ${pulse})`);
        glow.addColorStop(1, "rgba(255, 42, 42, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(eyeCenterX - eyeSpan, eyeCenterY - eyeSpan * 0.5, eyeSpan * 2, eyeSpan);
      }

      const ringRadius = Math.min(boxW, boxH) * 0.22;
      ctx.save();
      ctx.translate(eyeCenterX, eyeCenterY);
      ctx.rotate((now * 0.0012) % (Math.PI * 2));
      ctx.strokeStyle = this.sparkIntensity > 0.2 ? "rgba(253, 224, 71, 0.75)" : "rgba(248, 113, 113, 0.36)";
      ctx.lineWidth = this.sparkIntensity > 0.2 ? 1.8 : 1.2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const beamY = pad + ((now * 0.08) % boxH);
      const beamGrad = ctx.createLinearGradient(0, beamY - 9, 0, beamY + 9);
      beamGrad.addColorStop(0, "rgba(239, 68, 68, 0)");
      beamGrad.addColorStop(0.5, "rgba(255, 75, 75, 0.36)");
      beamGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = beamGrad;
      ctx.fillRect(pad, beamY - 9, boxW, 18);

      if (this.scannerActive && this.detectedFace) {
        const fx = pad + this.detectedFace.x * boxW;
        const fy = pad + this.detectedFace.y * boxH;
        const fw = Math.max(48, this.detectedFace.w * boxW * 0.65);
        const fh = Math.max(60, this.detectedFace.h * boxH * 0.65);
        const leftBox = fx - fw * 0.5;
        const topBox = fy - fh * 0.5;

        ctx.strokeStyle = "rgba(255, 90, 90, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(leftBox, topBox, fw, fh);

        const leftEyeX = fx - fw * 0.22;
        const rightEyeX = fx + fw * 0.22;
        const scanEyeY = fy - fh * 0.1;

        ctx.strokeStyle = "rgba(254, 202, 202, 0.95)";
        ctx.strokeRect(leftEyeX - 8, scanEyeY - 5, 16, 10);
        ctx.strokeRect(rightEyeX - 8, scanEyeY - 5, 16, 10);

        ctx.fillStyle = "rgba(254, 202, 202, 0.95)";
        ctx.font = "10px monospace";
        ctx.fillText("FACE+EYES LOCKED", leftBox, topBox - 5);
      }

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

      const bLen = 20;
      ctx.strokeStyle = this.sparkIntensity > 0.2 ? "rgba(253, 224, 71, 0.95)" : "rgba(248, 113, 113, 0.92)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad + 6, pad + 6 + bLen);
      ctx.lineTo(pad + 6, pad + 6);
      ctx.lineTo(pad + 6 + bLen, pad + 6);

      ctx.moveTo(width - pad - 6 - bLen, pad + 6);
      ctx.lineTo(width - pad - 6, pad + 6);
      ctx.lineTo(width - pad - 6, pad + 6 + bLen);

      ctx.moveTo(pad + 6, height - pad - 6 - bLen);
      ctx.lineTo(pad + 6, height - pad - 6);
      ctx.lineTo(pad + 6 + bLen, height - pad - 6);

      ctx.moveTo(width - pad - 6 - bLen, height - pad - 6);
      ctx.lineTo(width - pad - 6, height - pad - 6);
      ctx.lineTo(width - pad - 6, height - pad - 6 - bLen);
      ctx.stroke();

      ctx.fillStyle = "rgba(252, 165, 165, 0.95)";
      ctx.font = "11px monospace";
      const sparkTag = this.sparkIntensity > 0.1 ? ` // ⚡ ${this.sparkReason}` : "";
      ctx.fillText(`VOID-09 v${(1 + this.upgradeStep * 0.1).toFixed(1)} // ${this.state}${sparkTag}`, pad + 14, height - pad - 24);
      ctx.fillStyle = "rgba(248, 113, 113, 0.85)";
      ctx.font = "10px monospace";
      ctx.fillText(`${this.upgradeLog} | ${this.scannerStatus}`, pad + 14, height - pad - 10);

      ctx.restore();
    }

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