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

    // 12 Lakh Crore (12,000,000,000,000) Horsepower + continuous self-upgrade & 2x doubling
    this.readinessPercent = 100;
    this.baseHorsepower = 12000000000000;
    this.lastUpgradeAt = performance.now();
    this.upgradeStep = 1;
    this.evolutionPower = this.baseHorsepower;

    // Collective cognition & instinct scale: 20,000 humans (mind + action) & 10,000 animals (perception)
    this.humanCognitionCount = 20000;
    this.humanActionPower = 20000;
    this.animalPerceptionCount = 10000;
    this.upgradeLog = `UPGRADE #1 // 20K HUMAN + 10K ANIMAL MATRIX // ${this._formatPower(this.evolutionPower)}`;

    // Danger / Intrusion Siren, Red Combat Look & Defensive Lockdown state
    this.dangerUntil = 0;
    this.dangerReason = "";
    this.lastSirenAt = 0;
    this._audioCtx = null;
    this.defensiveLockUntil = 0;
    this.externalRequestsPaused = false;

    // Robot Voice & Reply state
    this.voiceEnabled = true;
    this.voiceSpeaking = false;
    this.lastSpokenText = "";
    this.lastReply = "VOID-09 ONLINE. Say hello or type a command and click EXECUTE.";
    this._replyBox = null;

    // Ollama runs locally without API key; OpenClaw, Mythos & Grok each take a single user key
    this.requiredNodes = ["ollama", "openclaw", "mythos", "grok"];
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
      },
      grok: {
        label: "GROK",
        url: "https://api.x.ai/v1/models",
        candidates: [
          "https://api.x.ai/v1/models"
        ],
        apiKey: "",
        required: true,
        keyRequired: true,
        autoDetected: false,
        model: "grok-3",
        status: "KEY_REQUIRED"
      }
    };
    this._drawerInputs = null;
    this.activeNode = "OLLAMA+OPENCLAW+MYTHOS+GROK";
    this.bridgeStatus = `${this._formatPower(this.evolutionPower)} // 20K HUMANS + 10K ANIMALS // 2X LOOP`;

    // Spark state (only on manual/real events, never on 2.5s auto-upgrade)
    this.sparks = [];
    this.arcs = [];
    this.sparkIntensity = 0;
    this.sparkReason = "";
    this.lastErrorSparkAt = 0;

    // Live Face & Eye Scanner state
    this.scannerActive = false;
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
    this._hookExecuteButton();
  }

  _isExpectedOfflineOrAuthNoise(text = "") {
    const s = String(text || "").toLowerCase();
    return (
      s.includes("127.0.0.1") ||
      s.includes("localhost") ||
      s.includes("err_connection_refused") ||
      s.includes("failed to fetch") ||
      s.includes("networkerror") ||
      s.includes("401") ||
      s.includes("unauthorized")
    );
  }

  isDangerActive(now = performance.now()) {
    return now < this.dangerUntil || now < this.defensiveLockUntil;
  }

  engageDefensiveLockdown(durationMs = 15000, reason = "INTRUSION_CONTAINMENT") {
    const now = performance.now();
    this.defensiveLockUntil = now + Math.max(3000, durationMs);
    this.dangerUntil = Math.max(this.dangerUntil, now + 6000);
    this.dangerReason = String(reason || "INTRUSION_CONTAINMENT");
    this.externalRequestsPaused = true;
    this.state = "DEFENSE_LOCKDOWN";
    this.triggerSpark(this.dangerReason, 1.35);
    this._playSiren();
    const secs = Math.ceil(durationMs / 1000);
    this.setReply(`Defensive lockdown active for ${secs}s. External probes paused to buy response time.`, true);
  }

  _playSiren() {
    if (typeof window === "undefined") return;
    const now = performance.now();
    if (now - this.lastSirenAt < 1500) return;
    this.lastSirenAt = now;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this._audioCtx) this._audioCtx = new AudioCtx();
      if (this._audioCtx.state === "suspended") {
        this._audioCtx.resume().catch(() => {});
      }

      const ctx = this._audioCtx;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(520, t0);
      osc.frequency.linearRampToValueAtTime(980, t0 + 0.35);
      osc.frequency.linearRampToValueAtTime(540, t0 + 0.72);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.75);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.76);
    } catch {
      // Audio blocked or unavailable
    }
  }

  triggerDangerAlert(reason = "REAL_ISSUE", durationMs = 4500) {
    const cleanReason = String(reason || "REAL_ISSUE");
    if (this._isExpectedOfflineOrAuthNoise(cleanReason)) {
      return;
    }
    const now = performance.now();
    this.dangerReason = cleanReason;
    this.dangerUntil = Math.max(this.dangerUntil, now + Math.max(1500, durationMs));
    this.state = "RED_ALERT";
    this.triggerSpark(this.dangerReason, 1.35);
    this._playSiren();
    this.setReply(`REAL ALERT: ${this.dangerReason}. Robot shifted to red combat mode.`);
  }

  _formatPower(val) {
    const num = Number(val) || this.baseHorsepower;
    if (!Number.isFinite(num)) return "INFINITE-2X HP";
    if (num >= 1e15) return `${(num / 1e12).toFixed(2)}T HP (2X+)`;
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)} Lakh Crore HP`;
    return `${num.toLocaleString("en-US")} HP`;
  }

  doubleAndUpgrade(reason = "2X_SELF_UPGRADE", announce = false, sparkIt = false) {
    this.readinessPercent = 100;
    this.upgradeStep += 1;
    const current = Number(this.evolutionPower) || this.baseHorsepower;
    const next = current * 2;
    this.evolutionPower = Number.isFinite(next) ? next : current;
    this.humanCognitionCount = Math.min(20000000, this.humanCognitionCount * 2);
    this.humanActionPower = Math.min(20000000, this.humanActionPower * 2);
    this.animalPerceptionCount = Math.min(10000000, this.animalPerceptionCount * 2);
    this.upgradeLog = `UPGRADE #${this.upgradeStep} // 20K+10K 2X // ${this._formatPower(this.evolutionPower)}`;
    this.bridgeStatus = `${this._formatPower(this.evolutionPower)} // 20K HUMANS + 10K ANIMALS // STEP #${this.upgradeStep}`;
    if (sparkIt) {
      this.triggerSpark(reason, 1.2);
    }
    if (announce) {
      this.speak(`Upgrade ${this.upgradeStep}. Power doubled to ${this._formatPower(this.evolutionPower)}.`);
    }
    return this.evolutionPower;
  }

  boostPower(amount = this.baseHorsepower) {
    const floorVal = Math.max(this.baseHorsepower, Number(amount) || this.baseHorsepower);
    if ((Number(this.evolutionPower) || 0) < floorVal) {
      this.evolutionPower = floorVal;
    }
    return this.doubleAndUpgrade("OVERDRIVE_2X_BOOST", true, true);
  }

  setReply(text, speakIt = true) {
    const clean = String(text || "").trim();
    if (!clean) return;
    this.lastReply = clean;
    if (this._replyBox) {
      this._replyBox.textContent = `VOID-09 REPLY: ${clean}`;
    }
    if (speakIt) {
      this.speak(clean);
    }
  }

  async _generateReply(promptText) {
    const q = String(promptText || "").trim();
    const low = q.toLowerCase();

    if (/hacker|hack|attack|intrusion|हैकर|अटैक|lockdown|defend|बचाव/i.test(low)) {
      this.engageDefensiveLockdown(15000, q || "INTRUSION_ALERT");
      return "Defensive lockdown engaged! Siren active, external requests paused for 15 seconds.";
    }

    if (/danger|crash|khatra|alert|siren|threat|खतरा|क्रैश|सायरन/i.test(low)) {
      this.triggerDangerAlert(q || "MANUAL_DANGER_COMMAND", 5000);
      return "RED ALERT triggered! Siren active, robot turned crimson, and combat look engaged.";
    }

    const ollamaUrl = String(this.nodes.ollama?.url || "").trim();
    if (ollamaUrl && !this.externalRequestsPaused) {
      const base = ollamaUrl.replace(/\/api\/tags.*$/i, "");
      try {
        const res = await fetch(`${base}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.nodes.ollama?.model || "llama3.2",
            prompt: q || "Hello",
            stream: false
          }),
          signal: AbortSignal.timeout(2500)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.response) {
            return String(data.response).trim();
          }
        } else if (res.status >= 500) {
          this.triggerDangerAlert(`OLLAMA_SERVER_${res.status}`, 4500);
        }
      } catch {
        // Local service offline: stay calm without false siren
      }
    }

    if (!q || /^(hi|hello|hey|namaste|नमस्ते|हेलो|हाय)$/i.test(low)) {
      return `Hello! VOID-09 is online at ${this._formatPower(this.evolutionPower)}. How can I help you?`;
    }
    if (/power|hp|horse/i.test(low)) {
      return `Current power is ${this._formatPower(this.evolutionPower)} at step ${this.upgradeStep}.`;
    }
    if (/who|kaun|naam|name/i.test(low)) {
      return "I am VOID-09, your HUD interface with voice, real-issue alert mode, and defensive lockdown.";
    }
    return `Received "${q}". VOID-09 is active at ${this._formatPower(this.evolutionPower)}.`;
  }

  speak(text, { pitch = 0.92, rate = 1.04, force = false } = {}) {
    const clean = String(text || "").trim();
    if (!clean) return false;
    this.lastSpokenText = clean;
    if (!this.voiceEnabled && !force) return false;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.pitch = pitch;
      utter.rate = rate;
      utter.volume = 1.0;

      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      const preferred = voices.find((v) => /hi|en-GB|en-US|Google|Microsoft/i.test(v.lang + " " + v.name));
      if (preferred) utter.voice = preferred;

      utter.onstart = () => {
        this.voiceSpeaking = true;
      };
      utter.onend = () => {
        this.voiceSpeaking = false;
      };
      utter.onerror = () => {
        this.voiceSpeaking = false;
      };

      window.speechSynthesis.speak(utter);
      return true;
    } catch {
      this.voiceSpeaking = false;
      return false;
    }
  }

  _hookExecuteButton() {
    if (typeof document === "undefined") return;
    const attach = () => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const execBtn = buttons.find((b) => /execute/i.test((b.textContent || "").trim()));
      if (!execBtn || execBtn.dataset.voidVoiceBound) return;
      execBtn.dataset.voidVoiceBound = "1";
      exec};
    setTimeout(attach, 300);
    setTimeout(attach, 1200);
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
      const hasKey = !node.keyRequired || (node && node.apiKey && String(node.apiKey).trim().length > 0);
      if (!hasUrl) node.status = "LINK_REQUIRED";
      else if (!hasKey) node.status = "KEY_REQUIRED";
      else if (!node.keyRequired) node.status = "LOCAL_READY";
    });
    if (missing.length > 0) {
      const labels = missing.map((k) => this.nodes[k].label).join(" + ");
      this.bridgeStatus = `PENDING INPUT: ${labels} // ${this._formatPower(this.evolutionPower)}`;
      this.setReply(`Enter required link/key for ${labels} to sync.`, false);
      return false;
    }
    return true;
  }

  async _probeUrl(url, apiKey = "", timeoutMs = 1300) {
    if (this.externalRequestsPaused) return false;
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

  async autoDetectAndAddNodes(silent = true) {
    if (this.externalRequestsPaused) return [];
    this.bridgeStatus = `AUTO-DETECTING // ${this._formatPower(this.evolutionPower)}...`;
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
      this.bridgeStatus = `DETECTED: ${found.join(" + ")} // ${this._formatPower(this.evolutionPower)}`;
      if (!silent) {
        this.setReply(`Detected ${found.join(" and ")}.`, true);
      }
    } else {
      this.bridgeStatus = `100% // ${this._formatPower(this.evolutionPower)} // 20K HUMANS + 10K ANIMALS`;
      if (!silent) {
        this.setReply("Scan complete. Local services offline; enter API keys for OpenClaw, Mythos, and Grok.", false);
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
    if (this.externalRequestsPaused) {
      this.setReply("External node checks are paused during defensive lockdown.", false);
      return false;
    }
    if (!node.url || !String(node.url).trim()) {
      node.status = "LINK_REQUIRED";
      this.bridgeStatus = `${node.label} LINK REQUIRED // ${this._formatPower(this.evolutionPower)}`;
      this.setReply(`${node.label} link is empty.`, false);
      return false;
    }
    if (node.keyRequired && (!node.apiKey || !String(node.apiKey).trim())) {
      node.status = "KEY_REQUIRED";
      this.bridgeStatus = `${node.label} API KEY REQUIRED // ${this._formatPower(this.evolutionPower)}`;
      this.setReply(`${node.label} API key not entered yet.`, false);
      return false;
    }

    this.activeNode = node.label;
    node.status = "PROBING";
    this.bridgeStatus = `PROBING ${node.label} // ${this._formatPower(this.evolutionPower)}...`;

    const ok = await this._probeUrl(node.url, node.apiKey, 1800);
    if (ok) {
      node.status = "LINKED";
      this.doubleAndUpgrade(`${node.label}_LINKED_2X`, false, false);
      this.bridgeStatus = `${node.label} LINKED // ${this._formatPower(this.evolutionPower)}`;
      this.setReply(`${node.label} linked. Power doubled to ${this._formatPower(this.evolutionPower)}.`, true);
      return true;
    }

    node.status = node.keyRequired ? "OFFLINE/LOCAL" : "LOCAL_RUN";
    this.bridgeStatus = `${node.label} UNREACHABLE // ${this._formatPower(this.evolutionPower)}`;
    this.setReply(`${node.label} is not reachable right now.`, false);
    return false;
  }

  async syncAllNodes() {
    if (!this.validateRequiredNodes()) {
      return false;
    }
    this.bridgeStatus = `SYNCING ALL 4 // ${this._formatPower(this.evolutionPower)}...`;
    await Promise.all([
      this.pingNode("ollama"),
      this.pingNode("openclaw"),
      this.pingNode("mythos"),
      this.pingNode("grok")
    ]);
    this.doubleAndUpgrade("ALL_NODES_SYNC_2X", false, false);
    this.activeNode = "OLLAMA+OPENCLAW+MYTHOS+GROK";
    this.bridgeStatus = `${this._formatPower(this.evolutionPower)} | OL:${this.nodes.ollama.status} | OC:${this.nodes.openclaw.status} | MY:${this.nodes.mythos.status} | GK:${this.nodes.grok.status}`;
    this.setReply(`All nodes checked. Power at ${this._formatPower(this.evolutionPower)}.`, true);
    return true;
  }

  _bindGlobalErrors() {
    window.addEventListener("error", (ev) => {
      const msg = ev && ev.message ? String(ev.message) : "RUNTIME_CRASH";
      if (this._isExpectedOfflineOrAuthNoise(msg)) return;
      this.triggerDangerAlert(msg, 5000);
    });
    window.addEventListener("unhandledrejection", (ev) => {
      const reason = ev && ev.reason ? String(ev.reason.message || ev.reason) : "UNHANDLED_REJECTION";
      if (this._isExpectedOfflineOrAuthNoise(reason)) return;
      this.triggerDangerAlert(reason, 5000);
    });
  }

  triggerSpark(reason = "EVENT", power = 1.1) {
    const now = performance.now();
    if (now - this.lastErrorSparkAt < 300 && this.sparkIntensity > 0.5) return;
    this.lastErrorSparkAt = now;
    this.sparkReason = String(reason || "EVENT");
    this.sparkIntensity = Math.min(1.4, Math.max(this.sparkIntensity, power));

    const rect = this.canvas ? this.canvas.getBoundingClientRect() : { width: 640, height: 320 };
    const w = Math.max(300, rect.width || 640);
    const h = Math.max(180, rect.height || 320);
    const cx = w * 0.5;
    const cy = h * 0.42;

    const count = Math.floor(32 * power);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2.0 + Math.random() * 8.0) * power;
      const hot = Math.random();
      const color =
        hot > 0.7 ? "#ff3b3b" :
        hot > 0.38 ? "#ff1e42" :
        hot > 0.14 ? "#ff5e3a" : "#ffea54";
      this.sparks.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 30,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        life: 1,
        decay: 0.025 + Math.random() * 0.028,
        size: 1.5 + Math.random() * 2.6,
        color
      });
    }

    const arcCount = Math.floor(5 * power);
    this.arcs = [];
    for (let a = 0; a < arcCount; a++) {
      const targetAngle = Math.random() * Math.PI * 2;
      const dist = (40 + Math.random() * Math.min(w, h) * 0.34) * power;
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
      this.arcs.push({ pts, life: 1, decay: 0.08 + Math.random() * 0.05 });
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
    const old = document.querySelectorAll(".void09-scanner-bar, .void09-node-drawer, .void09-reply-bar, .void09-hub-panel");
    old.forEach((el) => el.remove());

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
      "z-index:20",
      "font-family:monospace",
      "font-size:10px"
    ].join(";");

    const hubBtn = document.createElement("button");
    hubBtn.type = "button";
    hubBtn.textContent = "VOID-09 CONTROLS";
    hubBtn.style.cssText = [
      "background:rgba(127,29,29,0.95)",
      "color:#fde047",
      "border:1px solid rgba(253,224,71,0.75)",
      "padding:4px 9px",
      "cursor:pointer",
      "letter-spacing:0.6px",
      "text-transform:uppercase"
    ].join(";");

    const panel = document.createElement("div");
    panel.className = "void09-hub-panel";
    panel.style.cssText = [
      "display:none",
      "position:absolute",
      "top:36px",
      "right:12px",
      "z-index:24",
      "width:255px",
      "background:rgba(8,11,20,0.97)",
      "border:1px solid rgba(248,113,113,0.75)",
      "padding:8px",
      "font-family:monospace",
      "font-size:10px",
      "color:#fecaca",
      "box-shadow:0 0 20px rgba(239,68,68,0.3)"
    ].join(";");

    const actionGrid = document.createElement("div");
    actionGrid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px;";

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.textContent = "DEFENSE LOCK (15S)";
    lockBtn.style.cssText = [
      "background:rgba(127,29,29,0.96)",
      "color:#fde047",
      "border:1px solid rgba(255,75,75,0.9)",
      "padding:4px 6px",
      "cursor:pointer",
      "text-transform:uppercase"
    ].join(";");
    lockBtn.addEventListener("click", () => {
      this.engageDefensiveLockdown(15000, "MANUAL_DEFENSE_LOCK");
    });

    const sirenBtn = document.createElement("button");
    sirenBtn.type = "button";
    sirenBtn.textContent = "SIREN ALERT";
    sirenBtn.style.cssText = [
      "background:rgba(153,27,27,0.95)",
      "color:#fecaca",
      "border:1px solid rgba(255,75,75,0.85)",
      "padding:4px 6px",
      "cursor:pointer",
      "text-transform:uppercase"
    ].join(";");
    sirenBtn.addEventListener("click", () => {
      this.triggerDangerAlert("MANUAL_TEST_ALERT", 5000);
    });

    const voiceBtn = document.createElement("button");
    voiceBtn.type = "button";
    voiceBtn.textContent = this.voiceEnabled ? "VOICE: ON" : "VOICE: OFF";
    voiceBtn.style.cssText = [
      "background:rgba(15,23,42,0.92)",
      "color:#86efac",
      "border:1px solid rgba(134,239,172,0.6)",
      "padding:4px 6px",
      "cursor:pointer",
      "text-transform:uppercase"
    ].join(";");
    voiceBtn.addEventListener("click", () => {
      this.voiceEnabled = !this.voiceEnabled;
      voiceBtn.textContent = this.voiceEnabled ? "VOICE: ON" : "VOICE: OFF";
      voiceBtn.style.color = this.voiceEnabled ? "#86efac" : "#f87171";
      if (this.voiceEnabled) {
        this.speak("Robot voice activated.", { force: true });
      }
    });

    const drawer = document.createElement("div");
    drawer.className = "void09-node-drawer";
    drawer.style.cssText = [
      "display:none",
      "margin-top:6px",
      "padding-top:6px",
      "border-top:1px solid rgba(248,113,113,0.35)",
      "font-family:monospace",
      "font-size:10px",
      "color:#fecaca"
    ].join(";");

    const reqBanner = document.createElement("div");
    reqBanner.textContent = `20K HUMAN + 10K ANIMAL // ${this._formatPower(this.evolutionPower)}`;
    reqBanner.style.cssText = "color:#fde047;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(248,113,113,0.3);";
    drawer.appendChild(reqBanner);

    const reqErrorEl = document.createElement("div");
    reqErrorEl.style.cssText = "display:none;color:#fde047;background:rgba(127,29,29,0.6);border:1px solid rgba(253,224,71,0.55);padding:4px 5px;margin-bottom:6px;";

    const inputs = {};
    this.requiredNodes.forEach((key) => {
      const node = this.nodes[key];
      const row = document.createElement("div");
      row.style.cssText = "margin-bottom:6px;";

      const title = document.createElement("div");
      if (node.keyRequired) {
        title.innerHTML = `<span style="color:#fde047;">${node.label}</span> <span style="color:#f87171;">* LINK + KEY</span>`;
      } else {
        title.innerHTML = `<span style="color:#fde047;">${node.label}</span> <span style="color:#86efac;">* LOCAL</span>`;
      }
      title.style.cssText = "margin-bottom:2px;";

      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.required = true;
      urlInput.placeholder = `${node.label} URL`;
      urlInput.value = node.url;
      urlInput.style.cssText = "width:100%;box-sizing:border-box;background:#05070d;color:#fff;border:1px solid rgba(248,113,113,0.55);padding:3px 5px;margin-bottom:2px;font-size:10px;";

      const keyInput = document.createElement("input");
      keyInput.type = "password";
      keyInput.autocomplete = "off";
      if (node.keyRequired) {
        keyInput.required = true;
        keyInput.placeholder = `${node.label} API Key`;
        keyInput.style.cssText = "width:100%;box-sizing:border-box;background:#05070d;color:#fff;border:1px solid rgba(253,224,71,0.55);padding:3px 5px;font-size:10px;";
      } else {
        keyInput.disabled = true;
        keyInput.placeholder = "Local / No key needed";
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
    saveBtn.textContent = "APPLY & SYNC";
    saveBtn.style.cssText = "width:100%;background:rgba(185,28,28,0.95);color:#fff;border:1px solid rgba(254,202,202,0.8);padding:4px 6px;cursor:pointer;";
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
      panel.style.display = "none";
    });
    drawer.appendChild(saveBtn);

    const linksToggleBtn = document.createElement("button");
    linksToggleBtn.type = "button";
    linksToggleBtn.textContent = "LINKS & KEYS*";
    linksToggleBtn.style.cssText = [
      "background:rgba(15,23,42,0.92)",
      "color:#fde047",
      "border:1px solid rgba(253,224,71,0.55)",
      "padding:4px 6px",
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
        "padding:4px 6px",
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
      "grid-column:1 / -1",
      "background:rgba(127,29,29,0.95)",
      "color:#fde047",
      "border:1px solid rgba(253,224,71,0.75)",
      "padding:4px 6px",
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

    hubBtn.addEventListener("click", () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });

    const replyBar = document.createElement("div");
    replyBar.className = "void09-reply-bar";
    replyBar.style.cssText = [
      "margin-top:6px",
      "padding:6px 8px",
      "background:rgba(10,14,24,0.96)",
      "border:1px solid rgba(253,224,71,0.5)",
      "color:#fde047",
      "font-family:monospace",
      "font-size:11px"
    ].join(";");
    replyBar.textContent = `VOID-09 REPLY: ${this.lastReply}`;
    this._replyBox = replyBar;

    actionGrid.appendChild(lockBtn);
    actionGrid.appendChild(sirenBtn);
    actionGrid.appendChild(voiceBtn);
    actionGrid.appendChild(linksToggleBtn);
    actionGrid.appendChild(makeLinkBtn("OLLAMA", "ollama"));
    actionGrid.appendChild(makeLinkBtn("OPENCLAW", "openclaw"));
    actionGrid.appendChild(makeLinkBtn("MYTHOS", "mythos"));
    actionGrid.appendChild(makeLinkBtn("GROK", "grok"));
    actionGrid.appendChild(syncBtn);

    panel.appendChild(actionGrid);
    panel.appendChild(drawer);

    bar.appendChild(hubBtn);
    parent.appendChild(bar);
    parent.appendChild(panel);
    parent.insertAdjacentElement("afterend", replyBar);
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
    if (now >= this.defensiveLockUntil && this.externalRequestsPaused) {
      this.externalRequestsPaused = false;
      if (this.state === "DEFENSE_LOCKDOWN") {
        this.state = "APEX_LOCK";
      }
    }
    if (now - this.lastUpgradeAt >= 2500) {
      this.lastUpgradeAt = now;
      this.doubleAndUpgrade("AUTO_2X_UPGRADE", false, false);
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

    _isAndroidDevice() {
    if (typeof navigator === "undefined") return false;
    const ua = String(navigator.userAgent || "");
    return /android/i.test(ua);
  }

  _renderAndroidBlocked() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(300, Math.floor(rect.width || 640));
    const h = Math.max(180, Math.floor(rect.height || 320));
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.ctx;
    ctx.fillStyle = "#090406";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#ff2e2e";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = "#ff5252";
    ctx.font = "bold 14px monospace";
    ctx.fillText("ACCESS RESTRICTED // ANDROID NOT SUPPORTED", 24, h * 0.44);
    ctx.fillStyle = "#fde047";
    ctx.font = "11px monospace";
    ctx.fillText("VOID-09 IS AVAILABLE ONLY ON DESKTOP, APPLE (MACOS) & LINUX.", 24, h * 0.44 + 24);
  }

  start() {
    if (this._isAndroidDevice()) {
      this._renderAndroidBlocked();
      return;
    }
    if (this.running) return;
    this.running = true;
    this.autoDetectAndAddNodes(true);
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
    if (!newState) return;
    this.state = newState;
    const upper = String(newState).toUpperCase();
    if (upper.includes("CRITICAL") || upper.includes("CRASH") || upper.includes("FATAL")) {
      this.triggerDangerAlert(`STATE_${upper}`, 4500);
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
    const danger = this.isDangerActive(now);
    if (danger) {
      this._playSiren();
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();

    ctx.fillStyle = danger ? "#140406" : "#05070d";
    ctx.fillRect(rx, ry, rw, rh);

    const normX = Math.max(-1, Math.min(1, this.gazeX));
    const normY = Math.max(-1, Math.min(1, this.gazeY));
    const cx = rx + rw * 0.5 + normX * 14;
    const cy = ry + rh * 0.46 + normY * 10;
    const unit = Math.min(rw, rh);
    const sirenWave = danger ? (0.85 + 0.35 * Math.abs(Math.sin(now * 0.022))) : 1;

    const aura = ctx.createRadialGradient(cx, cy - unit * 0.04, unit * 0.04, cx, cy, unit * 0.62 * sirenWave);
    if (danger) {
      aura.addColorStop(0, "rgba(255, 24, 24, 0.68)");
      aura.addColorStop(0.55, "rgba(185, 28, 28, 0.28)");
      aura.addColorStop(1, "rgba(20, 4, 6, 0)");
    } else {
      aura.addColorStop(0, "rgba(255, 55, 55, 0.38)");
      aura.addColorStop(0.55, "rgba(253, 224, 71, 0.12)");
      aura.addColorStop(1, "rgba(5, 7, 13, 0)");
    }
    ctx.fillStyle = aura;
    ctx.fillRect(rx, ry, rw, rh);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((now * (danger ? 0.0045 : 0.0016)) % (Math.PI * 2));
    ctx.strokeStyle = danger ? "rgba(255, 45, 45, 0.92)" : "rgba(255, 85, 85, 0.58)";
    ctx.lineWidth = danger ? 2.2 : 1.6;
    ctx.setLineDash(danger ? [10, 4] : [14, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, unit * 0.35 * sirenWave, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const headW = unit * (danger ? 0.38 : 0.34);
    const headH = unit * (danger ? 0.45 : 0.42);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = danger ? "#240609" : "#0c0f18";
    ctx.strokeStyle = danger ? "#ff2424" : (this.voiceSpeaking ? "rgba(253, 224, 71, 0.98)" : "rgba(248, 113, 113, 0.9)");
    ctx.lineWidth = danger ? 2.5 : 2.0;

    if (danger) {
      ctx.beginPath();
      ctx.moveTo(0, -headH * 0.72);
      ctx.lineTo(headW * 0.42, -headH * 0.42);
      ctx.lineTo(headW * 0.72, -headH * 0.18);
      ctx.lineTo(headW * 0.50, headH * 0.26);
      ctx.lineTo(headW * 0.24, headH * 0.62);
      ctx.lineTo(-headW * 0.24, headH * 0.62);
      ctx.lineTo(-headW * 0.50, headH * 0.26);
      ctx.lineTo(-headW * 0.72, -headH * 0.18);
      ctx.lineTo(-headW * 0.42, -headH * 0.42);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -headH * 0.62);
      ctx.lineTo(headW * 0.58, -headH * 0.25);
      ctx.lineTo(headW * 0.46, headH * 0.22);
      ctx.lineTo(headW * 0.22, headH * 0.58);
      ctx.lineTo(-headW * 0.22, headH * 0.58);
      ctx.lineTo(-headW * 0.46, headH * 0.22);
      ctx.lineTo(-headW * 0.58, -headH * 0.25);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = danger ? "#ff3838" : "rgba(255, 75, 75, 0.65)";
    ctx.lineWidth = danger ? 1.8 : 1.3;
    ctx.beginPath();
    ctx.moveTo(-headW * 0.48, -headH * 0.16);
    ctx.lineTo(0, danger ? headH * 0.04 : -headH * 0.02);
    ctx.lineTo(headW * 0.48, -headH * 0.16);
    ctx.stroke();

    const eyeY = -headH * 0.04;
    const eyeDx = headW * 0.24;
    const eyeW = headW * (danger ? 0.21 : 0.18);
    const eyeH = headH * (danger ? 0.11 : 0.08);
    const blinkAmt = this.blinkProgress > 0
      ? (this.blinkProgress <= 1 ? this.blinkProgress : 2 - this.blinkProgress)
      : 0;
    const openFactor = danger ? 1 : Math.max(0.08, 1 - blinkAmt);

    const pulse = 0.82 + 0.18 * Math.sin(now * (danger ? 0.025 : 0.01));
    ctx.fillStyle = danger ? `rgba(255, 24, 24, ${pulse})` : (this.voiceSpeaking ? `rgba(253, 224, 71, ${pulse})` : `rgba(255, 50, 50, ${pulse})`);
    ctx.shadowColor = danger ? "#ff1414" : (this.voiceSpeaking ? "#fde047" : "#ff2a2a");
    ctx.shadowBlur = danger ? 18 : 13;

    ctx.beginPath();
    ctx.moveTo(-eyeDx - eyeW * 0.5, eyeY - (danger ? 2 : 0));
    ctx.lineTo(-eyeDx + eyeW * 0.5, eyeY - eyeH * 0.55 * openFactor);
    ctx.lineTo(-eyeDx + eyeW * 0.35, eyeY + eyeH * 0.55 * openFactor);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(eyeDx + eyeW * 0.5, eyeY - (danger ? 2 : 0));
    ctx.lineTo(eyeDx - eyeW * 0.5, eyeY - eyeH * 0.55 * openFactor);
    ctx.lineTo(eyeDx - eyeW * 0.35, eyeY + eyeH * 0.55 * openFactor);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = danger ? "#ff4545" : (this.voiceSpeaking ? "rgba(253, 224, 71, 0.85)" : "rgba(252, 165, 165, 0.5)");
    ctx.lineWidth = danger ? 1.6 : 1.3;
    for (let g = 0; g < 3; g++) {
      const gy = headH * (0.24 + g * 0.09);
      const wave = danger ? Math.sin(now * 0.03 + g) * 5 : (this.voiceSpeaking ? Math.sin(now * 0.025 + g) * 4 : 0);
      const gw = headW * (0.22 - g * 0.03) + wave;
      ctx.beginPath();
      ctx.moveTo(-gw, gy);
      ctx.lineTo(gw, gy);
      ctx.stroke();
    }

    ctx.restore();

    ctx.fillStyle = danger ? "#ff4d4d" : "rgba(253, 224, 71, 0.95)";
    ctx.font = "10px monospace";
    const modeLabel = this.externalRequestsPaused
      ? " // 🛡️ DEFENSE LOCK"
      : (danger ? " // 🚨 REAL ALERT + COMBAT LOOK" : (this.voiceSpeaking ? " // 🔊 SPEAKING" : ""));
    ctx.fillText(`CORE // ${this._formatPower(this.evolutionPower)}${modeLabel}`, rx + 10, ry + 18);

    ctx.restore();
  }

  _drawCameraPane(ctx, now, cx, cy, cw, ch) {
    const danger = this.isDangerActive(now);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cw, ch);
    ctx.clip();

    ctx.fillStyle = danger ? "#140406" : "#06080f";
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

      ctx.fillStyle = danger ? "rgba(220, 38, 38, 0.24)" : "rgba(185, 28, 28, 0.08)";
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

      ctx.strokeStyle = danger ? "#ff2424" : "rgba(255, 75, 75, 0.95)";
      ctx.lineWidth = danger ? 2.2 : 1.6;
      ctx.strokeRect(leftBox, topBox, fw, fh);

      const leftEyeX = fx - fw * 0.22;
      const rightEyeX = fx + fw * 0.22;
      const scanEyeY = fy - fh * 0.12;

      ctx.strokeStyle = danger ? "#ff4d4d" : "rgba(254, 240, 138, 0.95)";
      ctx.lineWidth = 1.3;
      ctx.strokeRect(leftEyeX - 10, scanEyeY - 6, 20, 12);
      ctx.strokeRect(rightEyeX - 10, scanEyeY - 6, 20, 12);

      ctx.fillStyle = "#ff2424";
      ctx.beginPath();
      ctx.arc(leftEyeX, scanEyeY, 2, 0, Math.PI * 2);
      ctx.arc(rightEyeX, scanEyeY, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = danger ? "#ff6b6b" : "rgba(254, 202, 202, 0.98)";
      ctx.font = "10px monospace";
      ctx.fillText(danger ? "ALERT LOCKED" : "FACE + EYES LOCKED", leftBox, Math.max(cy + 26, topBox - 5));
    } else {
      ctx.strokeStyle = danger ? "rgba(255, 36, 36, 0.7)" : "rgba(239, 68, 68, 0.28)";
      ctx.strokeRect(cx + 12, cy + 28, cw - 24, ch - 40);
      ctx.fillStyle = danger ? "#ff6b6b" : "rgba(252, 165, 165, 0.9)";
      ctx.font = "11px monospace";
      ctx.fillText(danger ? "SIREN RED STANDBY" : "CAM STANDBY", cx + 18, cy + ch * 0.48);
      ctx.fillStyle = danger ? "#ff9999" : "rgba(253, 224, 71, 0.8)";
      ctx.font = "10px monospace";
      ctx.fillText("CLICK [SCAN FACE & EYES]", cx + 18, cy + ch * 0.48 + 16);
    }

    const beamY = cy + ((now * (danger ? 0.22 : 0.11)) % Math.max(1, ch));
    ctx.fillStyle = danger ? "rgba(255, 30, 30, 0.45)" : "rgba(255, 75, 75, 0.25)";
    ctx.fillRect(cx, beamY, cw, 2);

    ctx.fillStyle = danger ? "#ff6b6b" : "rgba(252, 165, 165, 0.88)";
    ctx.font = "10px monospace";
    ctx.fillText("OPTIC // CAM", cx + 10, cy + 18);

    ctx.restore();
  }

  draw(now = performance.now()) {
    if (!this.canvas || !this.ctx) return;
    const danger = this.isDangerActive(now);
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
    this._updateSparks();

    const shakeMult = danger ? 1.25 : 1;
    const shakeX = this.sparkIntensity > 0 ? (Math.random() - 0.5) * 8 * this.sparkIntensity * shakeMult : 0;
    const shakeY = this.sparkIntensity > 0 ? (Math.random() - 0.5) * 6 * this.sparkIntensity * shakeMult : 0;
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = danger ? "#120305" : "#040509";
    ctx.fillRect(-12, -12, width + 24, height + 24);

    const pad = 6;
    const boxW = Math.max(1, width - pad * 2);
    const boxH = Math.max(1, height - pad * 2);
    this._drawRobotPane(ctx, now, pad, pad, boxW, boxH);

    if (danger) {
      const flashAlpha = 0.14 + 0.14 * Math.abs(Math.sin(now * 0.022));
      ctx.fillStyle = `rgba(255, 20, 20, ${flashAlpha})`;
      ctx.fillRect(pad, pad, boxW, boxH);
    } else if (this.sparkIntensity > 0.05) {
      ctx.fillStyle = `rgba(255, 60, 30, ${Math.min(0.2, this.sparkIntensity * 0.14)})`;
      ctx.fillRect(pad, pad, boxW, boxH);
    }

    for (const arc of this.arcs) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, arc.life));
      ctx.strokeStyle = danger ? "#ff2a2a" : "#fde047";
      ctx.lineWidth = 2.4;
      ctx.shadowColor = "#ff2424";
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
    ctx.strokeStyle = danger ? "#ff2424" : (this.sparkIntensity > 0.2 ? "rgba(253, 224, 71, 0.98)" : "rgba(248, 113, 113, 0.95)");
    ctx.lineWidth = danger ? 2.6 : 2.2;
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

    ctx.fillStyle = danger ? "rgba(38, 5, 8, 0.92)" : "rgba(4, 6, 12, 0.88)";
    ctx.fillRect(pad + 4, height - pad - 34, boxW - 8, 30);

    ctx.fillStyle = danger ? "#ff5252" : "rgba(253, 224, 71, 0.96)";
    ctx.font = "11px monospace";
    const lockRem = Math.max(0, Math.ceil((this.defensiveLockUntil - now) / 1000));
    const alertTag = lockRem > 0
      ? ` // 🛡️ LOCK ${lockRem}s: ${this.dangerReason}`
      : (danger ? ` // 🚨 SIREN: ${this.dangerReason}` : (this.sparkIntensity > 0.1 ? ` // ⚡ ${this.sparkReason}` : ""));
    ctx.fillText(`VOID-09 ${this.readinessPercent}% (STEP #${this.upgradeStep} // ${this._formatPower(this.evolutionPower)}) // ${danger ? "RED_ALERT" : this.state}${alertTag}`, pad + 12, height - pad - 21);
    ctx.fillStyle = danger ? "#ff9999" : "rgba(252, 165, 165, 0.9)";
    ctx.font = "10px monospace";
    ctx.fillText(`${this.bridgeStatus} // NO-CAM MODE`, pad + 12, height - pad - 8);

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