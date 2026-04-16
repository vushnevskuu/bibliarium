/* global chrome, BibliariumApi */
(function () {
  "use strict";

  const DEFAULT_URL = "https://bibliarium.vercel.app";
  const baseEl = document.getElementById("baseUrl");
  const sessionEl = document.getElementById("session");
  const status = document.getElementById("status");

  function setStatus(text, ok) {
    status.textContent = text;
    status.className = ok ? "ok" : "err";
  }

  async function ensurePermission(base) {
    if (!/^https:\/\//i.test(base)) return true; // http is fine without permission
    try {
      const u = new URL(base);
      const already = await chrome.permissions.contains({ origins: [`${u.origin}/*`] });
      if (already) return true;
      return await chrome.permissions.request({ origins: [`${u.origin}/*`] });
    } catch {
      return false;
    }
  }

  async function load() {
    const v = await chrome.storage.sync.get(BibliariumApi.STORAGE.baseUrl);
    const saved = typeof v[BibliariumApi.STORAGE.baseUrl] === "string"
      ? v[BibliariumApi.STORAGE.baseUrl]
      : "";
    baseEl.value = saved || DEFAULT_URL;

    const s = await chrome.storage.local.get(BibliariumApi.STORAGE.session);
    if (typeof s[BibliariumApi.STORAGE.session] === "string") {
      try {
        const o = JSON.parse(s[BibliariumApi.STORAGE.session]);
        sessionEl.value = JSON.stringify(
          { access_token: o.access_token, refresh_token: o.refresh_token, expires_at: o.expires_at },
          null, 2
        );
      } catch {
        sessionEl.value = s[BibliariumApi.STORAGE.session];
      }
    }
  }

  document.getElementById("save").onclick = async () => {
    const base = baseEl.value.trim().replace(/\/$/, "") || DEFAULT_URL;

    // Auto-request permission for production HTTPS URL
    const ok = await ensurePermission(base);
    if (!ok) {
      setStatus("Permission denied — allow the URL in the browser prompt and try again.", false);
      return;
    }

    await chrome.storage.sync.set({ [BibliariumApi.STORAGE.baseUrl]: base });

    const raw = sessionEl.value.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed.access_token) throw new Error("Missing access_token");
        await BibliariumApi.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token ?? "",
          expires_at: parsed.expires_at ?? 0,
        });
        setStatus("Connected. You can close this tab.", true);
      } catch (e) {
        setStatus("Invalid JSON: " + (e.message || "parse error"), false);
        return;
      }
    } else {
      await chrome.storage.local.remove(BibliariumApi.STORAGE.session);
      setStatus("Saved. Paste session JSON to connect.", true);
    }
  };

  document.getElementById("openConnect").onclick = async () => {
    const base = baseEl.value.trim().replace(/\/$/, "") || DEFAULT_URL;
    // Ensure permission before opening
    await ensurePermission(base);
    await chrome.storage.sync.set({ [BibliariumApi.STORAGE.baseUrl]: base });
    chrome.tabs.create({ url: `${base}/extension/connect` });
  };

  void load();
})();
