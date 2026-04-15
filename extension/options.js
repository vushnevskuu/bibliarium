/* global chrome, BibliariumApi */
(function () {
  "use strict";

  const baseEl = document.getElementById("baseUrl");
  const sessionEl = document.getElementById("session");
  const status = document.getElementById("status");

  async function load() {
    const v = await chrome.storage.sync.get(BibliariumApi.STORAGE.baseUrl);
    baseEl.value =
      (typeof v[BibliariumApi.STORAGE.baseUrl] === "string" &&
        v[BibliariumApi.STORAGE.baseUrl]) ||
      "http://127.0.0.1:3333";
    const s = await chrome.storage.local.get(BibliariumApi.STORAGE.session);
    if (typeof s[BibliariumApi.STORAGE.session] === "string") {
      try {
        const o = JSON.parse(s[BibliariumApi.STORAGE.session]);
        sessionEl.value = JSON.stringify(
          {
            access_token: o.access_token,
            refresh_token: o.refresh_token,
            expires_at: o.expires_at,
          },
          null,
          2
        );
      } catch {
        sessionEl.value = s[BibliariumApi.STORAGE.session];
      }
    }
  }

  function setStatus(text, ok) {
    status.textContent = text;
    status.className = ok ? "ok" : "err";
  }

  document.getElementById("save").onclick = async () => {
    const base = baseEl.value.trim().replace(/\/$/, "");
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
      } catch (e) {
        setStatus("Invalid JSON: " + (e.message || "parse error"), false);
        return;
      }
    } else {
      await chrome.storage.local.remove(BibliariumApi.STORAGE.session);
    }
    setStatus("Saved.", true);
  };

  document.getElementById("grant").onclick = async () => {
    const base = baseEl.value.trim();
    if (!/^https:\/\//i.test(base)) {
      setStatus("Use an https:// base URL first.", false);
      return;
    }
    try {
      const u = new URL(base);
      const ok = await chrome.permissions.request({
        origins: [`${u.origin}/*`],
      });
      setStatus(ok ? "Permission granted." : "Permission denied.", ok);
    } catch (e) {
      setStatus(e.message || "Permission error", false);
    }
  };

  document.getElementById("openConnect").onclick = async () => {
    const base = baseEl.value.trim().replace(/\/$/, "") || "http://127.0.0.1:3333";
    chrome.tabs.create({ url: `${base}/extension/connect` });
  };

  void load();
})();
