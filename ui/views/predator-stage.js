import { HudCanvas } from "../../render/hud-canvas.js";
import { gazeTracker } from "../../vision/gaze-tracker.js";
import { scanEngine } from "../../vision/scan-engine.js";
import { eventBus } from "../../core/event-bus.js";

export function mountPredatorStage(container) {
  if (!container) return null;

  container.innerHTML = [
    "<div style=\"display:flex;flex-direction:column;gap:12px;\">",
    "<canvas id=\"predator-canvas\" width=\"640\" height=\"260\" style=\"width:100%;max-width:760px;height:auto;border:1px solid rgba(217,30,54,0.4);border-radius:8px;background:#09090d;\"></canvas>",
    "<div style=\"font-family:ui-monospace,monospace;font-size:0.8rem;color:#9a949c;\" id=\"scan-telemetry\">SCAN TICK: 0</div>",
    "</div>"
  ].join("");

  const canvas = container.querySelector("#predator-canvas");
  const telemetry = container.querySelector("#scan-telemetry");
  const hud = new HudCanvas(canvas);

  const unsubGaze = eventBus.on("vision:gaze", (pos) => {
    if (pos) hud.setGaze(pos.x, pos.y);
  });

  const unsubScan = eventBus.on("vision:scan_tick", (info) => {
    if (telemetry && info) telemetry.textContent = "SCAN TICK: " + info.tick;
  });

  gazeTracker.start();
  scanEngine.start();
  hud.start();

  return () => {
    hud.stop();
    gazeTracker.stop();
    scanEngine.stop();
    unsubGaze();
    unsubScan();
  };
}