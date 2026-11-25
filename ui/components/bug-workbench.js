import { bugHunter } from "../../diagnostics/bug-hunter.js";

export function mountBugWorkbench(container) {
  if (!container) return null;

  container.innerHTML = 
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <label for="bug-lang" style="font-family:ui-monospace,monospace;font-size:0.8rem;color:#f2ece6;">TARGET LANG:</label>
        <select id="bug-lang" style="padding:6px 10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.2);border-radius:6px;font-family:ui-monospace,monospace;">
          <option value="html">HTML</option>
          <option value="python">Python</option>
          <option value="php">PHP</option>
          <option value="java">Java</option>
          <option value="mysql">MySQL</option>
        </select>
        <button id="run-bug-scan" type="button" class="btn-crimson" style="flex:0 0 auto;padding:7px 14px;">SCAN CODE</button>
      </div>
      <textarea id="bug-code-input" rows="6" placeholder="Paste HTML, Python, PHP, Java, or SQL code here to scan..." style="width:100%;padding:10px;background:#070709;color:#f2ece6;border:1px solid rgba(242,236,230,0.16);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.82rem;"></textarea>
      <pre id="bug-scan-output" style="padding:10px;background:#070709;color:#9a949c;border:1px solid rgba(217,30,54,0.35);border-radius:6px;font-family:ui-monospace,monospace;font-size:0.78rem;white-space:pre-wrap;">Awaiting scan...</pre>
    </div>
  ;

  const langEl = container.querySelector("#bug-lang");
  const codeEl = container.querySelector("#bug-code-input");
  const outEl = container.querySelector("#bug-scan-output");
  const btnEl = container.querySelector("#run-bug-scan");

  const runScan = () => {
    const res = bugHunter.scan(codeEl.value, langEl.value);
    if (res.totalIssues === 0) {
      outEl.textContent = [] No rule violations found.;
      return;
    }
    const lines = res.findings.map(
      (f, idx) => ${idx + 1}. [] () 
    );
    outEl.textContent = [] Issues found: \n + lines.join("\n");
  };

  btnEl.addEventListener("click", runScan);
  return () => btnEl.removeEventListener("click", runScan);
}
