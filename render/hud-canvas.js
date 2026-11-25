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
    this.scannerStatus = "STANDBY // CLICK [SCAN FACE & EYES] FOR LIVE CAM";
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
      "background:rgba(185,28,28,0.92)",
      "color:#fff",
      "border:1px solid rgba(254,202,202,0.6)",
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
      this.scannerStatus = "LIVE OPTIC FEED // SCANNING FACE & EYES";
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
    this.scannerStatus = "STANDBY // CLICK [SCAN FACE & EYES] FOR LIVE CAM";
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.videoEl = null;
  }

  async _sampleSubject(now) {
    if (!this.scannerActive || !this.videoEl || this.videoEl.readyState < 2) return;
    if (now - this.lastScanAt < 110) return;
    this.lastScanAt = now;

    if (this.detector) {
      try {
        const faces = await this.detector.detect(this.videoEl);
        const vw = this.videoEl.videoWidth || 640;
        const vh = this.videoEl.videoHeight || 360;
        if (faces && faces.length > 0) {
          const b = faces[0].boundingBox;
          // Mirror X so it matches the mirrored live camera preview
          const nx = 1 - (b.x + b.width * 0.5) / vw;
          const ny = (b.y + b.height * 0.5) / vh;
          this.detectedFace = {
            x: Math.max(0.08, Math.min(0.92, nx)),
            y: Math.max(0.10, Math.min(0.90, ny)),
            w: Math.max(0.12, Math.min(0.65, b.width / vw)),
            h: Math.max(0.16, Math.min(0.75, b.height / vh))
          };
          this.gazeX = (this.detectedFace.x - 0.5) * 2;
          this.gazeY = (this.detectedFace.y - 0.5) * 2;
          this.scannerStatus = `FACE + EYES LOCKED // CONFIDENCE 98%`;
          return;
        }
        this.detectedFace = null;
        this.scannerStatus = "SCANNING LIVE FEED // ALIGN FACE IN FRAME";
        return;
      } catch {
        this.detector = null;
      }
    }

    // Fallback presence box centered on subject if FaceDetector is unavailable
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
            if (diff > 50) {
              sumX += x / mw;
              sumY += y / mh;
              hits++;
            }
          }
        }
        if (hits > 18) {
          const cx = Math.max(0.2, Math.min(0.8, sumX / hits));
          const cy = Math.max(0.2, Math.min(0.8, sumY / hits));
          this.detectedFace = { x: cx, y: cy, w: 0.30, h: 0.46 };
          this.gazeX = (cx - 0.5) * 2;
          this.gazeY = (cy - 0.5) * 2;
          this.scannerStatus = "SUBJECT LOCKED // LIVE OPTIC TRACKING";
        } else {
          // Keep default central biometric lock box so user still sees face/eye reticle on live feed
          this.detectedFace = { x: 0.5, y: 0.45, w: 0.28, h: 0.44 };
          this.scannerStatus = "LIVE FEED ACTIVE // BIOMETRIC RETICLE READY";
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

  _drawCoverMedia(ctx, source, srcW, srcH, pad, boxW, boxH, mirror = false, offsetX = 0, offsetY = 0, zoom = 1.0) {
    const targetAspect = boxW / boxH;
    const srcAspect = srcW / srcH;

    let sx = 0;
    let sy = 0;
    let sWidth = srcW;
    let sHeight = srcH;

    if (srcAspect > targetAspect) {
      sWidth = srcH * targetAspect;
      sx = (srcW - sWidth) * 0.5;
    } else {
      sHeight = srcW / targetAspect;
      sy = Math.max(0, srcH * 0.06);
      if (sy + sHeight > srcH) sy = Math.max(0, srcH - sHeight);
    }

    const zW = sWidth / zoom;
    const zH = sHeight / zoom;
    sx = Math.max(0, Math.min(srcW - zW, sx + (sWidth - zW) * 0.5 + offsetX));
    sy = Math.max(0, Math.min(srcH - zH, sy + (sHeight - zH) * 0.36 + offsetY));

    ctx.save();
    if (mirror) {
      ctx.translate(pad * 2 + boxW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, sx, sy, zW, zH, pad, pad, boxW, boxH);
    ctx.restore();
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

    const pad = 6;
    const boxW = Math.max(1, width - pad * 2);
    const boxH = Math.max(1, height - pad * 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, pad, boxW, boxH);
    ctx.clip();

    const liveCamReady = this.scannerActive && this.videoEl && this.videoEl.readyState >= 2;

    if (liveCamReady) {
      // Draw user's LIVE mirrored face feed inside the HUD box!
      const vw = this.videoEl.videoWidth || 640;
      const vh = this.videoEl.videoHeight || 360;
      this._drawCoverMedia(ctx, this.videoEl, vw, vh, pad, boxW, boxH, true, 0, 0, 1.0);

      // Subtle tactical crimson HUD tint over live camera
      ctx.fillStyle = "rgba(185, 28, 28, 0.10)";
      ctx.fillRect(pad, pad, boxW, boxH);
    } else if (this.failed) {
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
      const imgW = this.img.naturalWidth || this.img.width;
      const imgH = this.img.naturalHeight || this.img.height;
      const evoZoom = 1.06 + Math.min(0.14, (this.upgradeStep % 12) * 0.01);
      this._drawCoverMedia(ctx, this.img, imgW, imgH, pad, boxW, boxH, false, normX * 22, normY * 14, evoZoom);
    }

    // Tactical HUD Grid
    ctx.strokeStyle = "rgba(239, 68, 68, 0.09)";
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

    // Dark crimson edge vignette
    const vig = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      Math.min(boxW, boxH) * 0.22,
      width * 0.5,
      height * 0.5,
      Math.max(boxW, boxH) * 0.76
    );
    vig.addColorStop(0, "rgba(220, 38, 38, 0.04)");
    vig.addColorStop(0.72, "rgba(10, 4, 8, 0.22)");
    vig.addColorStop(1, "rgba(3, 4, 8, 0.78)");
    ctx.fillStyle = vig;
    ctx.fillRect(pad, pad, boxW, boxH);

    // Sweeping laser scan beam
    const beamY = pad + ((now * 0.085) % boxH);
    const beamGrad = ctx.createLinearGradient(0, beamY - 9, 0, beamY + 9);
    beamGrad.addColorStop(0, "rgba(239, 68, 68, 0)");
    beamGrad.addColorStop(0.5, "rgba(255, 75, 75, 0.38)");
    beamGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = beamGrad;
    ctx.fillRect(pad, beamY - 9, boxW, 18);

    // When live camera is active, draw Face + Both Eyes biometric scanner reticle over user's face!
    if (liveCamReady) {
      const face = this.detectedFace || { x: 0.5, y: 0.45, w: 0.28, h: 0.44 };
      const fx = pad + face.x * boxW;
      const fy = pad + face.y * boxH;
      const fw = Math.max(70, face.w * boxW * 0.75);
      const fh = Math.max(90, face.h * boxH * 0.75);
      const leftBox = fx - fw * 0.5;
      const topBox = fy - fh * 0.5;

      // Outer face target brackets
      ctx.strokeStyle = "rgba(255, 75, 75, 0.95)";
      ctx.lineWidth = 1.8;
      ctx.strokeRect(leftBox, topBox, fw, fh);

      // Left & Right Eye lock reticles
      const leftEyeX = fx - fw * 0.22;
      const rightEyeX = fx + fw * 0.22;
      const scanEyeY = fy - fh * 0.12;

      ctx.strokeStyle = "rgba(254, 240, 138, 0.95)";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(leftEyeX - 12, scanEyeY - 7, 24, 14);
      ctx.strokeRect(rightEyeX - 12, scanEyeY - 7, 24, 14);

      // Crosshair dots on pupils
      ctx.fillStyle = "#ff3b3b";
      ctx.beginPath();
      ctx.arc(leftEyeX, scanEyeY, 2.2, 0, Math.PI * 2);
      ctx.arc(rightEyeX, scanEyeY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(254, 202, 202, 0.98)";
      ctx.font = "11px monospace";
      ctx.fillText("LIVE SUBJECT // FACE + EYES LOCKED", leftBox, Math.max(pad + 14, topBox - 6));
    } else if (this.loaded && !this.failed) {
      // Robot core optic blink + rotating target ring when in standby mode
      const normX = Math.max(-1, Math.min(1, this.gazeX));
      const normY = Math.max(-1, Math.min(1, this.gazeY));
      const eyeCenterX = width * 0.5 + normX * 10;
      const eyeCenterY = pad + boxH * 0.37 + normY * 6;
      const eyeSpan = boxW * 0.15;

      const blinkAmt = this.blinkProgress > 0
        ? (this.blinkProgress <= 1 ? this.blinkProgress : 2 - this.blinkProgress)
        : 0;

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
      ctx.strokeStyle = "rgba(248, 113, 113, 0.36)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Error Sparks & Lightning Arcs (only when an actual error occurs)
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

    // Sharp corner HUD brackets
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

    // Evolution & Scanner telemetry readout
    ctx.fillStyle = "rgba(252, 165, 165, 0.95)";
    ctx.font = "11px monospace";
    const sparkTag = this.sparkIntensity > 0.1 ? ` // ⚡ ${this.sparkReason}` : "";
    ctx.fillText(`VOID-09 v${(1 + this.upgradeStep * 0.1).toFixed(1)} // ${this.state}${sparkTag}`, pad + 14, height - pad - 24);
    ctx.fillStyle = "rgba(248, 113, 113, 0.85)";
    ctx.font = "10px monospace";
    ctx.fillText(`${this.upgradeLog} | ${this.scannerStatus}`, pad + 14, height - pad - 10);

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