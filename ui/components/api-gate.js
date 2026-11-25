import { apiVault } from "../../core/api-vault.js";

export function initApiGate(onReady) {
  const backdrop = document.getElementById("api-gate");
  const form = document.getElementById("api-gate-form");
  const providerEl = document.getElementById("api-provider");
  const modelEl = document.getElementById("api-model");
  const keyEl = document.getElementById("api-key-input");
  const msgEl = document.getElementById("api-gate-msg");
  const clearBtn = document.getElementById("api-clear-btn");

  if (!backdrop || !form) return null;

  const close = () => {
    backdrop.style.display = "none";
  };

  const open = () => {
    const saved = apiVault.load();
    if (providerEl) providerEl.value = saved.provider || "openai";
    if (modelEl) modelEl.value = saved.model || "";
    if (keyEl) keyEl.value = saved.apiKey || "";
    if (msgEl) msgEl.textContent = "";
    backdrop.style.display = "flex";
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const provider = providerEl?.value || "openai";
    const model = modelEl?.value.trim() || "";
    const apiKey = keyEl?.value.trim() || "";

    if (!apiKey) {
      apiVault.clear();
      close();
      if (typeof onReady === "function") onReady(apiVault.load());
      return;
    }

    const saved = apiVault.save({ provider, model, apiKey });
    close();
    if (typeof onReady === "function") onReady(saved);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      apiVault.clear();
      if (keyEl) keyEl.value = "";
      if (modelEl) modelEl.value = "";
      close();
      if (typeof onReady === "function") onReady(apiVault.load());
    });
  }

  // Start directly in unlocked Lite / Saved mode without blocking the screen
  close();
  if (typeof onReady === "function") onReady(apiVault.load());

  return { open, close };
}
