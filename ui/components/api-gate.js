import { apiVault } from "../../core/api-vault.js";

export function initApiGate(onUnlock) {
  const backdrop = document.getElementById("api-gate");
  const form = document.getElementById("api-gate-form");
  const providerEl = document.getElementById("api-provider");
  const modelEl = document.getElementById("api-model");
  const keyEl = document.getElementById("api-key-input");
  const clearBtn = document.getElementById("api-clear-btn");
  const msgEl = document.getElementById("api-gate-msg");

  if (!backdrop || !form || !keyEl) return;

  function syncFromVault() {
    const current = apiVault.load();
    if (providerEl) providerEl.value = current.provider;
    if (modelEl) modelEl.value = current.model;
    keyEl.value = current.apiKey;
  }

  function open() {
    syncFromVault();
    if (msgEl) msgEl.textContent = "";
    backdrop.hidden = false;
    keyEl.focus();
  }

  function close() {
    backdrop.hidden = true;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const key = keyEl.value.trim();
    if (!key) {
      if (msgEl) msgEl.textContent = "API key required to unlock VOID-09.";
      return;
    }

    const saved = apiVault.save({
      provider: providerEl ? providerEl.value : "openai",
      model: modelEl ? modelEl.value : "",
      apiKey: key
    });

    close();
    if (typeof onUnlock === "function") {
      onUnlock(saved);
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      apiVault.clear();
      keyEl.value = "";
      if (msgEl) msgEl.textContent = "Local key wiped.";
    });
  }

  if (!apiVault.hasKey()) {
    open();
  } else {
    close();
    if (typeof onUnlock === "function") {
      onUnlock(apiVault.load());
    }
  }

  return { open, close };
}
