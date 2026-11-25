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

    // Continuous self-upgrade state (+5 levels boost to LVL 15 / v2.5)
    this.lastUpgradeAt = performance.now();
    this.upgradeStep = 15;
    this.evolutionPower = 148;
    this.upgradeLog = "UPGRADE #15 // OVERDRIVE CORE BOOST (+5 LVL) // PWR:148";

    // Ollama runs locally without API key; OpenClaw & Mythos each take a single user key
    this.requiredNodes = ["ollama", "openclaw", "mythos"];
    this.nodes = {
      ollama: {
        label: "OLLAMA",
        url: "http://127.0.0.1:11434/api/tags",
        candidates: [
          "http://127.0.0.1:11434/api/tags",
          "http://localhost:11434/api/tags"
        ],
        apiKey: "",
        required: true,
        keyRequired: false,
        autoDetected: false,
        model: "llama3.2",
        status: "LOCAL_READY"
      },
      openclaw: {
        label: "OPENCLAW",
        url: "http://127.0.0.1:8787/health",
        candidates: [
          "http://127.0.0.1:8787/health",
          "http://localhost:8787/health",
          "http://127.0.0.1:8787/status",
          "http://127.0.0.1:3000/health",
          "http://127.0.0.1:8000/health"
        ],
        apiKey: "",
        required: true,
        keyRequired: true,
        autoDetected: false,
        mode: "CLI_OR_APP",
        status: "KEY_REQUIRED"
      },
      mythos: {
        label: "MYTHOS",
        url: "http://127.0.0.1:9000/status",
        candidates: [
          "http://127.0.0.1:9000/status",
          "http://localhost:9000/status",
          "http://127.0.0.1:9000/health"
        ],
        apiKey: "",
        required: true,
        keyRequired: true,
        autoDetected: false,
        core: "MYTHOS_ENGINE",
        status: "KEY_REQUIRED"
      }
    };
    this._drawerInputs = null;
    this.activeNode = "OLLAMA+OPENCLAW+MYTHOS";
    this.bridgeStatus = "OLLAMA LOCAL (NO KEY) // OPENCLAW + MYTHOS KEY REQUIRED";

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
    this.smoothFace = { x: 0.5, y: 0.44, w: 0.24, h: 0.36 };
    this.lastScanAt = 0;
    this.motionCanvas = document.createElement("canvas");
    this.motionCanvas.width = 80;
    this.motionCanvas.height = 60;
    this.motionCtx = this.motionCanvas.getContext("2d", { willReadFrequently: true });
    this.prevFrameData = null;

    window.__voidHud = this;
    this._createScannerControls();
    this._initFaceDetector();
    this._bindGlobalErrors();
  }

  _syncInputsFromNodes() {
    if (!this._drawerInputs) return;
    this.requiredNodes.forEach((key) => {
      if (this._drawerInputs[key]) {
        if (this._drawerInputs[key].urlInput) {
          this._drawerInputs[key].urlInput.value = this.nodes[key].url || "";
        }
        if (this._drawerInputs[key].keyInput && this.nodes[key].apiKey) {
          this._drawerInputs[key].keyInput.value = this.nodes[key].apiKey;
        }
      }
    });
  }

  getMissingRequiredNodes() {
    return this.requiredNodes.filter((key) => {
      const node = this.nodes[key];
      const hasUrl = node && node.url && String(node.url).trim().length > 0;
      const hasKey = !node.keyRequired || (node && node.apiKey && String(node.apiKey).trim().length > 0);
      return !hasUrl || !hasKey;
    });
  }

  validateRequiredNodes() {
    const missing = this.getMissingRequiredNodes();
    this.requiredNodes.forEach((key) => {
      const node = this.nodes[key];
      const hasUrl = node.url && String(node.url).trim().length > 0;
      const hasKey = !node.keyRequired || (node.apiKey && String(node.apiKey).trim().length > 0);
      if (!hasUrl) node.status = "LINK_REQUIRED";
      else if (!hasKey) node.status = "KEY_REQUIRED";
      else if (!node.keyRequired) node.status = "LOCAL_READY";
    });
    if (missing.length > 0) {
      const labels = missing.map((k) => this.nodes[k].label).join(" + ");
      this.bridgeStatus = `MISSING REQUIRED: ${labels}`;
      this.triggerSpark("REQUIRED_NODE_MISSING", 1.2);
      return false;
    }
    return true;
  }

  async _probeUrl(url, apiKey = "", timeoutMs = 1300) {
    const headers = {};
    if (apiKey && String(apiKey).trim()) {
      headers.Authorization = `Bearer ${String(apiKey).trim()}`;
      headers["X-API-Key"] = String(apiKey).trim();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(String(url).trim(), {
        method: "GET",
        mode: "no-cors",
        headers,
        signal: controller.signal
      });
      clearTimeout(timer);
      return true;
    } catch {
      clearTimeout(timer);
      return false;
    }
  }

  async autoDetectAndAddNodes(silentSpark = true) {
    this.bridgeStatus = "AUTO-DETECTING OLLAMA (LOCAL) + OPENCLAW + MYTHOS...";
    const found = [];

    for (const key of this.requiredNodes) {
      const node = this.nodes[key];
      const list = Array.from(new Set([node.url, ...(node.candidates || [])].filter(Boolean)));
      let matchedUrl = null;

      for (const candidate of list) {
        const ok = await this._probeUrl(candidate, node.apiKey || "", 1200);
        if (ok) {
          matchedUrl = candidate;
          break;
        }
      }

      if (matchedUrl) {
        node.url = matchedUrl;
        node.autoDetected = true;
        node.status = node.keyRequired && !node.apiKey ? "LINK_FOUND_KEY_REQ" : "AUTO_LINKED";
        found.push(node.label);
      } else if (!node.keyRequired) {
        node.status = "LOCAL_STANDBY";
      } else if (!node.apiKey || !String(node.apiKey).trim()) {
        node.status = "KEY_REQUIRED";
      }
    }

    this._syncInputsFromNodes();

    if (found.length > 0) {
      this.bridgeStatus = `DETECTED: ${found.join(" + ")} // OLLAMA LOCAL READY`;
    } else {
      this.bridgeStatus = "OLLAMA LOCAL READY // ADD OPENCLAW & MYTHOS KEYS";
      if (!silentSpark) {
        this.triggerSpark("AUTO_DETECT_NONE", 1.0);
      }
    }
    return found;
  }

  configureNode(nodeKey, patch = {}) {
    const key = String(nodeKey || "").toLowerCase();
    if (!this.nodes[key]) return null;
    this.nodes[key] = { ...this.nodes[key], ...patch };
    this._syncInputsFromNodes();
    return this.nodes[key];
  }

  async pingNode(nodeKey) {
    const key = String(nodeKey || "").toLowerCase();
    const node = this.nodes[key];
    if (!node) return false;
    if (!node.url || !String(node.url).trim()) {
      node.status = "LINK_REQUIRED";
      this.bridgeStatus = `${node.label} LINK REQUIRED`;
      this.triggerSpark(`${node.label}_LINK_REQUIRED`, 1.1);
      return false;
    }
    if (node.keyRequired && (!node.apiKey || !String(node.apiKey).trim())) {
      node.status = "KEY_REQUIRED";
      this.bridgeStatus = `${node.label} API KEY REQUIRED`;
      this.triggerSpark(`${node.label}_KEY_REQUIRED`, 1.15);
      return false;
    }

    this.activeNode = node.label;
    node.status = "PROBING";
    this.bridgeStatus = `PROBING ${node.label}...`;

    const ok = await this._probeUrl(node.url, node.apiKey, 1800);
    if (ok) {
      node.status = "LINKED";
      this.bridgeStatus = `${node.label} LINKED // READY`;
      return true;
    }

    node.status = node.keyRequired ? "OFFLINE/LOCAL" : "LOCAL_RUN";
    this.bridgeStatus = `${node.label} UNREACHABLE (CHECK LINK / CORS)`;
    this.triggerSpark(`${node.label}_LINK_FAULT`, 1.1);
    return false;
  }

  async syncAllNodes() {
    if (!this.validateRequiredNodes()) {
      return false;
    }
    this.bridgeStatus = "SYNCING OLLAMA (LOCAL) + OPENCLAW + MYTHOS...";
    await Promise.all([
      this.pingNode("ollama"),
      this.pingNode("openclaw"),
      this.pingNode("mythos")
    ]);
    this.activeNode = "OLLAMA+OPENCLAW+MYTHOS";
    this.bridgeStatus = `OL:${this.nodes.ollama.status} | OC:${this.nodes.openclaw.status} | MY:${this.nodes.mythos.status}`;
    return true;
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
    const old = document.querySelectorAll(".void09-scanner-bar, .void09-node-drawer");
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
      "flex-wrap:wrap",
      "gap:5px",
      "align-items:center",
      "font-family:monospace",
      "font-size:10px"
    ].join(";");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "SCAN FACE & EYES";
    btn.style.cssText = [
      "background:rgba(185,28,28,0.92)",
      "color:#fff",
      "border:1px solid rgba(254,202,202,0.7)",
      "padding:4px 8px",
      "cursor:pointer",
      "letter-spacing:0.5px",
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

    const drawer = document.createElement("div");
    drawer.className = "void09-node-drawer";
    drawer.style.cssText = [
      "display:none",
      "position:absolute",
      "top:42px",
      "right:14px",
      "z-index:25",
      "width:295px",
      "background:rgba(8,11,20,0.96)",
      "border:1px solid rgba(248,113,113,0.65)",
      "padding:8px",
      "font-family:monospace",
      "font-size:10px",
      "color:#fecaca"
    ].join(";");

    const reqBanner = document.createElement("div");
    reqBanner.textContent = "OLLAMA: LOCAL (NO KEY) | OPENCLAW & MYTHOS: 1 KEY EACH";
    reqBanner.style.cssText = "color:#fca5a5;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(248,113,113,0.25);";
    drawer.appendChild(reqBanner);

    const reqErrorEl = document.createElement("div");
    reqErrorEl.style.cssText = "display:none;color:#fde047;background:rgba(127,29,29,0.55);border:1px solid rgba(253,224,71,0.5);padding:4px 5px;margin-bottom:6px;";

    const inputs = {};
    this.requiredNodes.forEach((key) => {
      const node = this.nodes[key];
      const row = document.createElement("div");
      row.style.cssText = "margin-bottom:6px;";

      const title = document.createElement("div");
      if (node.keyRequired) {
        title.innerHTML = `<span style="color:#fde047;">${node.label}</span> <span style="color:#f87171;">* LINK + 1 API KEY REQUIRED</span>`;
      } else {
        title.innerHTML = `<span style="color:#fde047;">${node.label}</span> <span style="color:#86efac;">* LINK REQUIRED (LOCAL / NO KEY)</span>`;
      }
      title.style.cssText = "margin-bottom:2px;";

      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.required = true;
      urlInput.placeholder = `${node.label} URL (REQUIRED)`;
      urlInput.value = node.url;
      urlInput.style.cssText = "width:100%;box-sizing:border-box;background:#05070d;color:#fff;border:1px solid rgba(248,113,113,0.55);padding:3px 5px;margin-bottom:2px;font-size:10px;";

      const keyInput = document.createElement("input");
      keyInput.type = "password";
      keyInput.autocomplete = "off";
      if (node.keyRequired) {
        keyInput.required = true;
        keyInput.placeholder = `${node.label} single API Key (required)`;
        keyInput.style.cssText = "width:100%;box-sizing:border-box;background:#05070d;color:#fff;border:1px solid rgba(253,224,71,0.55);padding:3px 5px;font-size:10px;";
      } else {
        keyInput.disabled = true;
        keyInput.placeholder = "Runs locally (no API key needed)";
        keyInput.style.cssText = "width:100%;box-sizing:border-box;background:#0b0f17;color:#94a3b8;border:1px solid rgba(148,163,184,0.25);padding:3px 5px;font-size:10px;";
      }

      inputs[key] = { urlInput, keyInput };
      row.appendChild(title);
      row.appendChild(urlInput);
      row.appendChild(keyInput);
      drawer.appendChild(row);
    });
    this._drawerInputs = inputs;

    const detectBtn = document.createElement("button");
    detectBtn.type = "button";
    detectBtn.textContent = "AUTO-DETECT LINKS";
    detectBtn.style.cssText = "width:100%;background:rgba(15,23,42,0.95);color:#fde047;border:1px solid rgba(253,224,71,0.6);padding:4px 6px;margin-bottom:5px;cursor:pointer;";
    detectBtn.addEventListener("click", () => {
      reqErrorEl.style.display = "none";
      this.autoDetectAndAddNodes(false);
    });
    drawer.appendChild(detectBtn);

    drawer.appendChild(reqErrorEl);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "APPLY & SYNC REQUIRED NODES";
    saveBtn.style.cssText = "width:100%;background:rgba(185,28,28,0.92);color:#fff;border:1px solid rgba(254,202,202,0.7);padding:4px 6px;cursor:pointer;";
    saveBtn.addEventListener("click", () => {
      this.requiredNodes.forEach((key) => {
        const node = this.nodes[key];
        this.configureNode(key, {
          url: inputs[key].urlInput.value.trim(),
          apiKey: node.keyRequired ? inputs[key].keyInput.value.trim() : ""
        });
      });
      const missing = this.getMissingRequiredNodes();
      if (missing.length > 0) {
        const names = missing.map((k) => this.nodes[k].label).join(", ");
        reqErrorEl.textContent = `REQUIRED MISSING: ${names}`;
        reqErrorEl.style.display = "block";
        this.validateRequiredNodes();
        return;
      }
      reqErrorEl.style.display = "none";
      this.syncAllNodes();
      drawer.style.display = "none";
    });
    drawer.appendChild(saveBtn);

    const linksToggleBtn = document.createElement("button");
    linksToggleBtn.type = "button";
    linksToggleBtn.textContent = "LINKS & KEYS*";
    linksToggleBtn.style.cssText = [
      "background:rgba(15,23,42,0.92)",
      "color:#fde047",
      "border:1px solid rgba(253,224,71,0.55)",
      "padding:4px 7px",
      "cursor:pointer",
      "text-transform:uppercase"
    ].join(";");
    linksToggleBtn.addEventListener("click", () => {
      reqErrorEl.style.display = "none";
      drawer.style.display = drawer.style.display === "none" ? "block" : "none";
    });

    const makeLinkBtn = (label, key) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `${label}*`;
      b.style.cssText = [
        "background:rgba(15,23,42,0.92)",
        "color:#fca5a5",
        "border:1px solid rgba(248,113,113,0.55)",
        "padding:4px 7px",
        "cursor:pointer",
        "text-transform:uppercase"
      ].join(";");
      b.addEventListener("click", () => this.pingNode(key));
      return b;
    };

    const syncBtn = document.createElement("button");
    syncBtn.type = "button";
    syncBtn.textContent = "SYNC ALL*";
    syncBtn.style.cssText = [
      "background:rgba(127,29,29,0.92)",
      "color:#fde047",
      "border:1px solid rgba(253,224,71,0.65)",
      "padding:4px 7px",
      "cursor:pointer",
      "text-transform:uppercase"
    ].join(";");
    syncBtn.addEventListener("click", () => {
      if (!this.validateRequiredNodes()) {
        drawer.style.display = "block";
        const missing = this.getMissingRequiredNodes().map((k) => this.nodes[k].label).join(", ");
        reqErrorEl.textContent = `REQUIRED MISSING: ${missing}`;
        reqErrorEl.style.display = "block";
        return;
      }
      this.syncAllNodes();
    });

    bar.appendChild(btn);
    bar.appendChild(linksToggleBtn);
    bar.appendChild(makeLinkBtn("OLLAMA", "ollama"));
    bar.appendChild(makeLinkBtn("OPENCLAW", "openclaw"));
    bar.appendChild(makeLinkBtn("MYTHOS", "mythos"));
    bar.appendChild(syncBtn);
    parent.appendChild(bar);
    parent.appendChild(drawer);
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
      this.prevFrameData = null;
      this.scannerActive = true;
      this.scannerStatus = "SIDE CAM LIVE // TRACKING FACE & MOTION";
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
    this.prevFrameData = null;
    this.scannerStatus = "CAM STANDBY // CLICK [SCAN FACE & EYES]";
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.videoEl = null;
  }

  _trackByMotion() {
    if (!this.motionCtx || !this.videoEl) return false;
    const mw = this.motionCanvas.width;
    const mh = this.motionCanvas.height;
    this.motionCtx.save();
    this.motionCtx.scale(-1, 1);
    this.motionCtx.drawImage(this.videoEl, -mw, 0, mw, mh);
    this.motionCtx.restore();

    const frame = this.motionCtx.getImageData(0, 0, mw, mh).data;
    let moved = false;

    if (this.prevFrameData) {
      let sumX = 0;
      let sumY = 0;
      let weightSum = 0;
      for (let y = 2; y < mh - 2; y += 2) {
        for (let x = 2; x < mw - 2; x += 2) {
          const idx = (y * mw + x) * 4;
          const diff =
            Math.abs(frame[idx] - this.prevFrameData[idx]) +
            Math.abs(frame[idx + 1] - this.prevFrameData[idx + 1]) +
            Math.abs(frame[idx + 2] - this.prevFrameData[idx + 2]);
          if (diff > 36) {
            const w = Math.min(4, diff / 45);
            sumX += (x / mw) * w;
            sumY += (y / mh) * w;
            weightSum += w;
          }
        }
      }
      if (weightSum > 14) {
        const cx = Math.max(0.12, Math.min(0.88, sumX / weightSum));
        const cy = Math.max(0.14, Math.min(0.84, sumY / weightSum));
        this.detectedFace = { x: cx, y: cy, w: 0.25, h: 0.36 };
        this.gazeX = (cx - 0.5) * 2;
        this.gazeY = (cy - 0.5) * 2;
        this.scannerStatus = `MOVEMENT LOCK // X:${Math.round(cx * 100)}% Y:${Math.round(cy * 100)}%`;
        moved = true;
      }
    }

    this.prevFrameData = new Uint8ClampedArray(frame);
    return moved;
  }

  async _sampleSubject(now) {
    if (!this.scannerActive || !this.videoEl || this.videoEl.readyState < 2) return;
    if (now - this.lastScanAt < 80) return;
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
          const cx = Math.max(0.10, Math.min(0.90, nx));
          const cy = Math.max(0.12, Math.min(0.86, ny));
          this.detectedFace = {
            x: cx,
            y: cy,
            w: Math.max(0.15, Math.min(0.46, b.width / vw)),
            h: Math.max(0.18, Math.min(0.58, b.height / vh))
          };
          this.gazeX = (cx - 0.5) * 2;
          this.gazeY = (cy - 0.5) * 2;
          this.scannerStatus = `FACE + EYES LOCKED // X:${Math.round(cx * 100)}% Y:${Math.round(cy * 100)}%`;
          return;
        }
      } catch {
        this.detector = null;
      }
    }

    const hadMotion = this._trackByMotion();
    if (!hadMotion && !this.detectedFace) {
      this.detectedFace = { x: 0.5, y: 0.44, w: 0.24, h: 0.36 };
      this.scannerStatus = "LIVE CAM READY // MOVE TO TRACK";
    }
  }

  _updateSmoothFace() {
    const target = this.detectedFace || { x: 0.5, y: 0.44, w: 0.24, h: 0.36 };
    const t = 0.28;
    this.smoothFace.x += (target.x - this.smoothFace.x) * t;
    this.smoothFace.y += (target.y - this.smoothFace.y) * t;
    this.smoothFace.w += (target.w - this.smoothFace.w) * t;
    this.smoothFace.h += (target.h - this.smoothFace.h) * t;
  }

  _updateSelfEvolution(now) {
    if (now - this.lastUpgradeAt >= 2500) {
      this.lastUpgradeAt = now;
      this.upgradeStep += 1;
      this.evolutionPower = Math.min(999, this.evolutionPower + Math.floor(6 + ((this.upgradeStep * 3) % 9)));
      const protocols = [
        "OVERDRIVE OPTIC GAIN",
        "TIER-2 RETICLE OVERCLOCK",
        "APEX EYE-SYNC MATRIX",
        "CRIMSON SURGE CORE",
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
    this.autoDetectAndAddNodes(true);
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

    const normX = Math.max(-1, Math.min(1, this.gazeX));
    const normY = Math.max(-1, Math.min(1, this.gazeY));
    const cx = rx + rw * 0.5 + normX * 14;
    const cy = ry + rh * 0.46 + normY * 10;
    const unit = Math.min(rw, rh);

    const aura = ctx.createRadialGradient(cx, cy - unit * 0.04, unit * 0.04, cx, cy, unit * 0.54);
    aura.addColorStop(0, "rgba(239, 68, 68, 0.34)");
    aura.addColorStop(0.6, "rgba(153, 27, 27, 0.12)");
    aura.addColorStop(1, "rgba(5, 7, 13, 0)");
    ctx.fillStyle = aura;
    ctx.fillRect(rx, ry, rw, rh);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((now * 0.001) % (Math.PI * 2));
    ctx.strokeStyle = "rgba(248, 113, 113, 0.38)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, unit * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (this.upgradeStep >= 11) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((-now * 0.0018) % (Math.PI * 2));
      ctx.strokeStyle = "rgba(253, 224, 71, 0.42)";
      ctx.lineWidth = 1.1;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, unit * 0.39, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const headW = unit * 0.34;
    const headH = unit * 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#0c0f18";
    ctx.strokeStyle = "rgba(248, 113, 113, 0.88)";
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(0, -headH * 0.62);
    ctx.lineTo(headW * 0.58, -headH * 0.25);
    ctx.lineTo(headW * 0.46, headH * 0.22);
    ctx.lineTo(headW * 0.22, headH * 0.58);
    ctx.lineTo(-headW * 0.22, headH * 0.58);
    ctx.lineTo(-headW * 0.46, headH * 0.22);
    ctx.lineTo(-headW * 0.58, -headH * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-headW * 0.44, -headH * 0.14);
    ctx.lineTo(0, -headH * 0.02);
    ctx.lineTo(headW * 0.44, -headH * 0.14);
    ctx.stroke();

    const eyeY = -headH * 0.04;
    const eyeDx = headW * 0.24;
    const eyeW = headW * 0.18;
    const eyeH = headH * 0.08;
    const blinkAmt = this.blinkProgress > 0
      ? (this.blinkProgress <= 1 ? this.blinkProgress : 2 - this.blinkProgress)
      : 0;
    const openFactor = Math.max(0.08, 1 - blinkAmt);

    const pulse = 0.78 + 0.22 * Math.sin(now * 0.008);
    ctx.fillStyle = `rgba(255, 50, 50, ${pulse})`;
    ctx.shadowColor = "#ff2a2a";
    ctx.shadowBlur = 11;

    ctx.beginPath();
    ctx.moveTo(-eyeDx - eyeW * 0.5, eyeY);
    ctx.lineTo(-eyeDx + eyeW * 0.5, eyeY - eyeH * 0.5 * openFactor);
    ctx.lineTo(-eyeDx + eyeW * 0.35, eyeY + eyeH * 0.5 * openFactor);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(eyeDx + eyeW * 0.5, eyeY);
    ctx.lineTo(eyeDx - eyeW * 0.5, eyeY - eyeH * 0.5 * openFactor);
    ctx.lineTo(eyeDx - eyeW * 0.35, eyeY + eyeH * 0.5 * openFactor);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(252, 165, 165, 0.45)";
    ctx.lineWidth = 1.2;
    for (let g = 0; g < 3; g++) {
      const gy = headH * (0.24 + g * 0.09);
      const gw = headW * (0.22 - g * 0.03);
      ctx.beginPath();
      ctx.moveTo(-gw, gy);
      ctx.lineTo(gw, gy);
      ctx.stroke();
    }

    ctx.restore();

    ctx.fillStyle = "rgba(252, 165, 165, 0.9)";
    ctx.font = "10px monospace";
    ctx.fillText(`CORE // VOID-09 // LVL ${this.upgradeStep}`, rx + 10, ry + 18);

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

      const sf = this.smoothFace;
      const fw = Math.max(66, Math.min(cw * 0.48, sf.w * cw * 0.78));
      const fh = Math.max(78, Math.min(ch * 0.58, sf.h * ch * 0.78));
      const minX = cx + 14 + fw * 0.5;
      const maxX = cx + cw - 14 - fw * 0.5;
      const minY = cy + 30 + fh * 0.5;
      const maxY = cy + ch - 26 - fh * 0.5;

      const fx = Math.max(minX, Math.min(maxX, cx + sf.x * cw));
      const fy = Math.max(minY, Math.min(maxY, cy + sf.y * ch));
      const leftBox = fx - fw * 0.5;
      const topBox = fy - fh * 0.5;

      ctx.strokeStyle = "rgba(255, 75, 75, 0.95)";
      ctx.lineWidth = 1.6;
      ctx.strokeRect(leftBox, topBox, fw, fh);

      if (this.upgradeStep >= 15) {
        ctx.strokeStyle = "rgba(253, 224, 71, 0.72)";
        ctx.lineWidth = 1.1;
        ctx.strokeRect(leftBox - 5, topBox - 5, fw + 10, fh + 10);
      }

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
      ctx.fillText("FACE + EYES LOCKED", leftBox, Math.max(cy + 26, topBox - 5));
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

    ctx.fillStyle = "rgba(4, 6, 12, 0.85)";
    ctx.fillRect(pad + 4, height - pad - 34, boxW - 8, 30);

    ctx.fillStyle = "rgba(252, 165, 165, 0.95)";
    ctx.font = "11px monospace";
    const sparkTag = this.sparkIntensity > 0.1 ? ` // ⚡ ${this.sparkReason}` : "";
    ctx.fillText(`VOID-09 v${(1 + this.upgradeStep * 0.1).toFixed(1)} (LVL ${this.upgradeStep}) // ${this.state}${sparkTag}`, pad + 12, height - pad - 21);
    ctx.fillStyle = "rgba(248, 113, 113, 0.85)";
    ctx.font = "10px monospace";
    ctx.fillText(`${this.bridgeStatus} | ${this.scannerStatus}`, pad + 12, height - pad - 8);

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