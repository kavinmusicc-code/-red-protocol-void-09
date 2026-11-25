export class DevilHumanoidAvatar {
  constructor(container) {
    this.container = container;
    this.mode = "IDLE";
    this.pulse = 0;
    this.rafId = null;
    this.rootEl = null;
    this.svgEl = null;
    this._mount();
  }

  _mount() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "void09-devil-avatar";
    wrap.style.cssText = [
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "width:100%",
      "height:100%",
      "min-height:180px",
      "position:relative",
      "user-select:none"
    ].join(";");

    wrap.innerHTML = `
      <svg id="void09-devil-svg" viewBox="0 0 240 240" width="210" height="210" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;filter:drop-shadow(0 0 14px rgba(220,38,38,0.45));">
        <defs>
          <radialGradient id="devilCoreGlow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stop-color="#ff2a2a" stop-opacity="0.32" />
            <stop offset="65%" stop-color="#7f1d1d" stop-opacity="0.12" />
            <stop offset="100%" stop-color="#09090b" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="devilPlate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2b1215" />
            <stop offset="55%" stop-color="#14090b" />
            <stop offset="100%" stop-color="#090506" />
          </linearGradient>
          <linearGradient id="devilHorn" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#450a0a" />
            <stop offset="60%" stop-color="#dc2626" />
            <stop offset="100%" stop-color="#fca5a5" />
          </linearGradient>
        </defs>

        <circle id="devil-aura" cx="120" cy="122" r="96" fill="url(#devilCoreGlow)" />

        <!-- Subtle cyber horns -->
        <path d="M74 64 C48 44, 38 22, 46 10 C58 24, 70 38, 88 52 Z" fill="url(#devilHorn)" stroke="#ef4444" stroke-opacity="0.45" stroke-width="1" />
        <path d="M166 64 C192 44, 202 22, 194 10 C182 24, 170 38, 152 52 Z" fill="url(#devilHorn)" stroke="#ef4444" stroke-opacity="0.45" stroke-width="1" />

        <!-- Humanoid neck & collar struts -->
        <path d="M98 164 L98 206 L142 206 L142 164 Z" fill="url(#devilPlate)" stroke="#991b1b" stroke-width="1.2" />
        <path d="M80 212 Q120 192 160 212 L172 228 L68 228 Z" fill="#120709" stroke="#dc2626" stroke-opacity="0.5" stroke-width="1.2" />

        <!-- Humanoid sculpted head -->
        <path d="M76 84 C76 48, 164 48, 164 84 L168 122 C168 144, 148 168, 120 176 C92 168, 72 144, 72 122 Z"
              fill="url(#devilPlate)" stroke="#ef4444" stroke-opacity="0.65" stroke-width="1.4" />

        <!-- Cheekbone & jaw cyber lines -->
        <path d="M84 114 L104 126 L100 148" fill="none" stroke="#f87171" stroke-opacity="0.35" stroke-width="1.1" />
        <path d="M156 114 L136 126 L140 148" fill="none" stroke="#f87171" stroke-opacity="0.35" stroke-width="1.1" />

        <!-- Angled devil brow -->
        <path id="devil-brow-l" d="M82 96 L112 105" stroke="#fca5a5" stroke-width="2.4" stroke-linecap="round" />
        <path id="devil-brow-r" d="M158 96 L128 105" stroke="#fca5a5" stroke-width="2.4" stroke-linecap="round" />

        <!-- Eyes -->
        <g id="devil-eyes">
          <ellipse cx="98" cy="110" rx="11" ry="5.5" fill="#1f0505" stroke="#ff3b3b" stroke-width="1.3" />
          <circle id="devil-pupil-l" cx="98" cy="110" r="3.6" fill="#ff2e2e" />

          <ellipse cx="142" cy="110" rx="11" ry="5.5" fill="#1f0505" stroke="#ff3b3b" stroke-width="1.3" />
          <circle id="devil-pupil-r" cx="142" cy="110" r="3.6" fill="#ff2e2e" />
        </g>

        <!-- Nose bridge -->
        <path d="M120 102 L116 130 L124 134" fill="none" stroke="#ef4444" stroke-opacity="0.55" stroke-width="1.2" />

        <!-- Mouth / vocalizer line -->
        <path id="devil-mouth" d="M100 152 Q120 148 140 152" fill="none" stroke="#ff4d4d" stroke-width="2" stroke-linecap="round" />
      </svg>
    `;

    this.container.appendChild(wrap);
    this.rootEl = wrap;
    this.svgEl = wrap.querySelector("#void09-devil-svg");
    this._loop();
  }

  setMode(mode = "IDLE") {
    this.mode = String(mode || "IDLE").toUpperCase();
  }

  _loop() {
    this.pulse += this.mode === "LOCKDOWN" || this.mode === "ALERT" ? 0.14 : 0.05;
    const scale = 1 + Math.sin(this.pulse) * (this.mode === "LOCKDOWN" ? 0.035 : 0.015);
    const shiftX = Math.cos(this.pulse * 0.7) * 2.2;

    if (this.svgEl) {
      this.svgEl.style.transform = `scale(${scale.toFixed(4)})`;
    }
    const pl = this.rootEl?.querySelector("#devil-pupil-l");
    const pr = this.rootEl?.querySelector("#devil-pupil-r");
    if (pl && pr) {
      pl.setAttribute("cx", (98 + shiftX).toFixed(2));
      pr.setAttribute("cx", (142 + shiftX).toFixed(2));
    }

    this.rafId = requestAnimationFrame(() => this._loop());
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.container) this.container.innerHTML = "";
  }
}

export function mountDevilAvatar(selectorOrEl, mode = "IDLE") {
  const el = typeof selectorOrEl === "string"
    ? document.querySelector(selectorOrEl)
    : selectorOrEl;
  if (!el) return null;
  const avatar = new DevilHumanoidAvatar(el);
  avatar.setMode(mode);
  return avatar;
}