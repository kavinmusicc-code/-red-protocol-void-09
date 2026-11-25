import { brainRouter } from "../../brains/router.js";
import { dynamicRegistry } from "../../core/dynamic-registry.js";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mountCommandDeck(container) {
  if (!container) return null;

  container.innerHTML = [
    "<div style=\"display:flex;flex-direction:column;gap:12px;\">",
    "<div style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap;\">",
    "<label for=\"brain-select\" style=\"font-family:ui-monospace,monospace;font-size:0.8rem;color:#f2ece6;\">BRAIN:</label>",
    "<select id=\"brain-select\" style=\"padding:6px 10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.2);border-radius:6px;font-family:ui-monospace,monospace;\">",
    "<option value=\"predator\">Predator Core</option>",
    "<option value=\"surgeon\">Bug Surgeon</option>",
    "</select>",
    "<button id=\"send-brain-prompt\" type=\"button\" class=\"btn-crimson\" style=\"flex:0 0 auto;padding:7px 14px;\">EXECUTE</button>",
    "</div>",
    "<input id=\"brain-prompt-input\" type=\"text\" placeholder=\"Enter command or technical query...\" style=\"width:100%;padding:9px 12px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.16);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.84rem;\" />",
    "<pre id=\"brain-response-output\" style=\"padding:10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.14);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.8rem;white-space:pre-wrap;min-height:56px;\">[READY]</pre>",
    "<div style=\"border-top:1px solid rgba(242,236,230,0.14);padding-top:10px;display:flex;flex-direction:column;gap:8px;\">",
    "<div style=\"font-family:ui-monospace,monospace;font-size:0.78rem;color:#d91e36;\">DYNAMIC STATE (LOCALSTORAGE — NO SOURCE CODE EDIT)</div>",
    "<div style=\"display:flex;gap:6px;flex-wrap:wrap;\">",
    "<input id=\"dyn-title-input\" type=\"text\" placeholder=\"Label / Title...\" style=\"flex:1 1 140px;padding:7px 10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.16);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.8rem;\" />",
    "<input id=\"dyn-value-input\" type=\"text\" placeholder=\"Command / Note / Swarm instruction...\" style=\"flex:2 1 200px;padding:7px 10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.16);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.8rem;\" />",
    "<button id=\"dyn-add-btn\" type=\"button\" class=\"btn-crimson\" style=\"flex:0 0 auto;padding:7px 12px;\">ADD</button>",
    "</div>",
    "<div id=\"dyn-items-list\" style=\"display:flex;flex-direction:column;gap:6px;\"></div>",
    "</div>",
    "</div>"
  ].join("");

  const brainEl = container.querySelector("#brain-select");
  const inputEl = container.querySelector("#brain-prompt-input");
  const outEl = container.querySelector("#brain-response-output");
  const btnEl = container.querySelector("#send-brain-prompt");
  const titleEl = container.querySelector("#dyn-title-input");
  const valEl = container.querySelector("#dyn-value-input");
  const addBtn = container.querySelector("#dyn-add-btn");
  const listEl = container.querySelector("#dyn-items-list");

  const renderDynamicList = () => {
    if (!listEl) return;
    const entries = dynamicRegistry.getItems("command");
    if (!entries.length) {
      listEl.innerHTML = "<div style=\"font-family:ui-monospace,monospace;font-size:0.76rem;color:#9a949c;\">No dynamic commands saved in localStorage.</div>";
      return;
    }

    listEl.innerHTML = entries.map((item) => {
      return [
        "<div style=\"display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;background:#070709;border:1px solid rgba(242,236,230,0.12);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.78rem;\">",
        "<div style=\"display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;\">",
        "<strong style=\"color:#f2ece6;\">" + escapeHtml(item.title) + "</strong>",
        "<span style=\"color:#9a949c;word-break:break-word;\">" + escapeHtml(item.value) + "</span>",
        "</div>",
        "<div style=\"display:flex;gap:6px;flex:0 0 auto;\">",
        "<button type=\"button\" data-use-id=\"" + escapeHtml(item.id) + "\" style=\"padding:4px 8px;background:#16161d;color:#f2ece6;border:1px solid rgba(242,236,230,0.2);border-radius:4px;cursor:pointer;font-family:ui-monospace,monospace;font-size:0.72rem;\">USE</button>",
        "<button type=\"button\" data-del-id=\"" + escapeHtml(item.id) + "\" style=\"padding:4px 8px;background:#2a0b10;color:#ff8a9b;border:1px solid rgba(217,30,54,0.45);border-radius:4px;cursor:pointer;font-family:ui-monospace,monospace;font-size:0.72rem;\">REMOVE</button>",
        "</div>",
        "</div>"
      ].join("");
    }).join("");
  };

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

  const handleAdd = () => {
    const created = dynamicRegistry.addItem({
      category: "command",
      title: titleEl.value,
      value: valEl.value
    });
    if (created) {
      titleEl.value = "";
      valEl.value = "";
      renderDynamicList();
    }
  };

  const handleListClick = (e) => {
    const target = e.target;
    if (!target || !target.getAttribute) return;
    const delId = target.getAttribute("data-del-id");
    if (delId) {
      dynamicRegistry.removeItem(delId);
      renderDynamicList();
      return;
    }
    const useId = target.getAttribute("data-use-id");
    if (useId) {
      const found = dynamicRegistry.getItems("command").find((x) => x.id === useId);
      if (found && inputEl) {
        inputEl.value = found.value;
        inputEl.focus();
      }
    }
  };

  btnEl.addEventListener("click", handleSend);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
  addBtn.addEventListener("click", handleAdd);
  listEl.addEventListener("click", handleListClick);

  renderDynamicList();

  return () => {
    btnEl.removeEventListener("click", handleSend);
    addBtn.removeEventListener("click", handleAdd);
    listEl.removeEventListener("click", handleListClick);
  };
}