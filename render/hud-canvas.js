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

    // Face & eye scanner state
    this.scannerActive = false;
    this.scannerStatus = "STANDBY // CLICK [CAM SCAN]";
    this.videoEl = null;
    this.stream = null;
    this.detector = null;
    this.detectedFace = null; // normalized { x, y, w, h } in [0..1]
    this.lastScanAt = 0;
    this.motionCanvas = document.createElement("canvas");
    this.motionCanvas.width = 64;
    this.motionCanvas.height = 48;
    this.motionCtx = this.motionCanvas.getContext("2d", { willReadFrequently: true });
    this.prevFrameData = null;

    this._createScannerControls();
    this._initFaceDetector();
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

    // Fallback motion-based presence lock when FaceDetector API is absent
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
    // Auto-upgrade every 2.5 seconds continuously
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
    if (newState) this.state = newState;
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

    ctx.fillStyle = "#040509";
    ctx.fillRect(0, 0, width, height);

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
      ctx.fillText("INITIALIZING VOID-09 APEX CORE...", 20, 32);
      ctx.restore();
      return;
    }

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

    // Base persona image
    ctx.drawImage(this.img, sx, sy, zW, zH, pad, pad, boxW, boxH);

    // Subtle tactical grid overlay
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

    // Dangerous dark-crimson vignette
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

    // Optic eye-blink & fierce crimson glow
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

    // Rotating outer target ring
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

    // Sweeping laser scan beam
    const beamY = pad + ((now * 0.08) % boxH);
    const beamGrad = ctx.createLinearGradient(0, beamY - 9, 0, beamY + 9);
    beamGrad.addColorStop(0, "rgba(239, 68, 68, 0)");
    beamGrad.addColorStop(0.5, "rgba(255, 75, 75, 0.36)");
    beamGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
    ctx.fillStyle = beamGrad;
    ctx.fillRect(pad, beamY - 9, boxW, 18);

    // Live Face + Eyes scan box when camera scanner detects a subject
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

      // Left & Right eye scan markers inside detected face
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

    // Sharp corner HUD brackets
    const bLen = 20;
    ctx.strokeStyle = "rgba(248, 113, 113, 0.92)";
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
    ctx.fillText(`VOID-09 v${(1 + this.upgradeStep * 0.1).toFixed(1)} // ${this.state}`, pad + 14, height - pad - 24);
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