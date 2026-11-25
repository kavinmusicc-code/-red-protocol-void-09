import { bugHunter } from "../../diagnostics/bug-hunter.js";
import { dynamicRegistry } from "../../core/dynamic-registry.js";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mountBugWorkbench(container) {
  if (!container) return null;

  container.innerHTML = [
    "<div style=\"display:flex;flex-direction:column;gap:12px;\">",
    "<div style=\"display:flex;gap:8px;align-items:center;flex-wrap:wrap;\">",
    "<label for=\"bug-lang\" style=\"font-family:ui-monospace,monospace;font-size:0.8rem;color:#f2ece6;\">TARGET LANG:</label>",
    "<select id=\"bug-lang\" style=\"padding:6px 10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.2);border-radius:6px;font-family:ui-monospace,monospace;\">",
    "<option value=\"html\">HTML</option>",
    "<option value=\"python\">Python</option>",
    "<option value=\"php\">PHP</option>",
    "<option value=\"java\">Java</option>",
    "<option value=\"mysql\">MySQL</option>",
    "</select>",
    "<button id=\"run-bug-scan\" type=\"button\" class=\"btn-crimson\" style=\"flex:0 0 auto;padding:7px 14px;\">SCAN CODE</button>",
    "</div>",
    "<textarea id=\"bug-code-input\" rows=\"5\" placeholder=\"Paste HTML, Python, PHP, Java, or SQL code here to scan...\" style=\"width:100%;padding:10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.16);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.82rem;\"></textarea>",
    "<pre id=\"bug-scan-output\" style=\"padding:10px;background:#070709;color:#9a949c;border:1px solid rgba(217,30,54,0.35);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.78rem;white-space:pre-wrap;\">Awaiting scan...</pre>",
    "<div style=\"border-top:1px solid rgba(242,236,230,0.14);padding-top:10px;display:flex;flex-direction:column;gap:8px;\">",
    "<div style=\"font-family:ui-monospace,monospace;font-size:0.78rem;color:#d91e36;\">DYNAMIC BUG RULES (LOCALSTORAGE ADD / REMOVE)</div>",
    "<div style=\"display:flex;gap:6px;flex-wrap:wrap;\">",
    "<input id=\"rule-name-input\" type=\"text\" placeholder=\"Rule name...\" style=\"flex:1 1 130px;padding:7px 10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.16);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.8rem;\" />",
    "<input id=\"rule-pattern-input\" type=\"text\" placeholder=\"Match text / token (e.g. TODO, eval)...\" style=\"flex:2 1 190px;padding:7px 10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.16);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.8rem;\" />",
    "<button id=\"rule-add-btn\" type=\"button\" class=\"btn-crimson\" style=\"flex:0 0 auto;padding:7px 12px;\">ADD RULE</button>",
    "</div>",
    "<div id=\"dyn-rules-list\" style=\"display:flex;flex-direction:column;gap:6px;\"></div>",
    "</div>",
    "</div>"
  ].join("");

  const langEl = container.querySelector("#bug-lang");
  const codeEl = container.querySelector("#bug-code-input");
  const outEl = container.querySelector("#bug-scan-output");
  const btnEl = container.querySelector("#run-bug-scan");
  const ruleNameEl = container.querySelector("#rule-name-input");
  const rulePatEl = container.querySelector("#rule-pattern-input");
  const addRuleBtn = container.querySelector("#rule-add-btn");
  const rulesListEl = container.querySelector("#dyn-rules-list");

  const renderRulesList = () => {
    if (!rulesListEl) return;
    const customRules = dynamicRegistry.getItems("bug-rule");
    if (!customRules.length) {
      rulesListEl.innerHTML = "<div style=\"font-family:ui-monospace,monospace;font-size:0.76rem;color:#9a949c;\">No custom localStorage rules active.</div>";
      return;
    }

    rulesListEl.innerHTML = customRules.map((rule) => {
      return [
        "<div style=\"display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;background:#070709;border:1px solid rgba(242,236,230,0.12);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.78rem;\">",
        "<div style=\"display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;\">",
        "<strong style=\"color:#f2ece6;\">" + escapeHtml(rule.title) + "</strong>",
        "<span style=\"color:#9a949c;word-break:break-word;\">Pattern: " + escapeHtml(rule.value) + "</span>",
        "</div>",
        "<button type=\"button\" data-del-rule=\"" + escapeHtml(rule.id) + "\" style=\"padding:4px 8px;background:#2a0b10;color:#ff8a9b;border:1px solid rgba(217,30,54,0.45);border-radius:4px;cursor:pointer;font-family:ui-monospace,monospace;font-size:0.72rem;\">REMOVE</button>",
        "</div>"
      ].join("");
    }).join("");
  };

  const runScan = () => {
    const sourceText = codeEl.value || "";
    const res = bugHunter.scan(sourceText, langEl.value);
    const lines = [];

    if (res && Array.isArray(res.findings) && res.findings.length > 0) {
      res.findings.forEach((f, idx) => {
        lines.push((idx + 1) + ". [" + String(f.severity || "info").toUpperCase() + "] (" + (f.ruleId || "RULE") + ") " + (f.message || ""));
      });
    }

    const customRules = dynamicRegistry.getItems("bug-rule");
    const lowerCode = sourceText.toLowerCase();
    customRules.forEach((rule) => {
      const needle = String(rule.value || "").trim().toLowerCase();
      if (needle && lowerCode.includes(needle)) {
        lines.push("[CUSTOM/" + String(rule.title || "RULE").toUpperCase() + "] Matched pattern: " + rule.value);
      }
    });

    if (!lines.length) {
      outEl.textContent = "[" + langEl.value.toUpperCase() + "] No rule violations found.";
      return;
    }

    outEl.textContent = "[" + String(langEl.value).toUpperCase() + "] Findings: " + lines.length + "\n" + lines.join("\n");
  };

  const handleAddRule = () => {
    const created = dynamicRegistry.addItem({
      category: "bug-rule",
      title: ruleNameEl.value,
      value: rulePatEl.value
    });
    if (created) {
      ruleNameEl.value = "";
      rulePatEl.value = "";
      renderRulesList();
    }
  };

  const handleRuleListClick = (e) => {
    const target = e.target;
    if (!target || !target.getAttribute) return;
    const delId = target.getAttribute("data-del-rule");
    if (delId) {
      dynamicRegistry.removeItem(delId);
      renderRulesList();
    }
  };

  btnEl.addEventListener("click", runScan);
  addRuleBtn.addEventListener("click", handleAddRule);
  rulesListEl.addEventListener("click", handleRuleListClick);

  renderRulesList();

  return () => {
    btnEl.removeEventListener("click", runScan);
    addRuleBtn.removeEventListener("click", handleAddRule);
    rulesListEl.removeEventListener("click", handleRuleListClick);
  };
}