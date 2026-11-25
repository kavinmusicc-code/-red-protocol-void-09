import { brainRouter } from "../../brains/router.js";

export function mountCommandDeck(container) {
  if (!container) return null;

  container.innerHTML = [
    "<div style=\"display:flex;flex-direction:column;gap:10px;\">",
    "<div style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap;\">",
    "<label for=\"brain-select\" style=\"font-family:ui-monospace,monospace;font-size:0.8rem;color:#f2ece6;\">BRAIN:</label>",
    "<select id=\"brain-select\" style=\"padding:6px 10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.2);border-radius:6px;font-family:ui-monospace,monospace;\">",
    "<option value=\"predator\">Predator Core</option>",
    "<option value=\"surgeon\">Bug Surgeon</option>",
    "</select>",
    "<button id=\"send-brain-prompt\" type=\"button\" class=\"btn-crimson\" style=\"flex:0 0 auto;padding:7px 14px;\">EXECUTE</button>",
    "</div>",
    "<input id=\"brain-prompt-input\" type=\"text\" placeholder=\"Enter command or technical query...\" style=\"width:100%;padding:9px 12px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.16);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.84rem;\" />",
    "<pre id=\"brain-response-output\" style=\"padding:10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.14);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.8rem;white-space:pre-wrap;min-height:64px;\">[READY]</pre>",
    "</div>"
  ].join("");

  const brainEl = container.querySelector("#brain-select");
  const inputEl = container.querySelector("#brain-prompt-input");
  const outEl = container.querySelector("#brain-response-output");
  const btnEl = container.querySelector("#send-brain-prompt");

  const handleSend = async () => {
    const prompt = inputEl.value.trim();
    if (!prompt) {
      outEl.textContent = "Enter a prompt first.";
      return;
    }
    outEl.textContent = "Routing through brain...";
    try {
      const reply = await brainRouter.ask({ prompt: prompt, brainId: brainEl.value });
      outEl.textContent = "[" + (reply.source || "CORE") + "]\n" + (reply.text || "");
    } catch (err) {
      outEl.textContent = "ERROR: " + (err && err.message ? err.message : err);
    }
  };

  btnEl.addEventListener("click", handleSend);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  return () => {
    btnEl.removeEventListener("click", handleSend);
  };
}