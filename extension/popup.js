/* global chrome, BibliariumApi */
(function () {
  "use strict";

  const PAUSED_KEY = "bibliarium_paused_until";
  const $ = (id) => document.getElementById(id);

  function domainFromUrl(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }

  function endOfToday() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  async function isPaused() {
    const v = await chrome.storage.local.get(PAUSED_KEY);
    const until = v[PAUSED_KEY];
    return typeof until === "number" && until > Date.now();
  }

  async function setPaused(paused) {
    if (paused) {
      await chrome.storage.local.set({ [PAUSED_KEY]: endOfToday() });
    } else {
      await chrome.storage.local.remove(PAUSED_KEY);
    }
  }

  function renderPauseState(paused) {
    const pill  = $("pauseBtn");
    const label = $("pauseLabel");
    const sub   = $("pauseSub");

    if (paused) {
      pill.classList.remove("on");
      label.innerHTML = 'Auto-save on copy <span class="paused-badge">Paused</span>';
      sub.textContent  = "Resumes tomorrow. Click to enable now.";
    } else {
      pill.classList.add("on");
      label.textContent = "Auto-save on copy";
      sub.textContent   = "Toast appears when you copy a URL.";
    }
  }

  async function init() {
    const base = await BibliariumApi.getBaseUrl();

    $("openConnect").addEventListener("click", () => {
      chrome.tabs.create({ url: `${base}/extension/connect` });
    });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab?.title)      $("pageTitle").textContent = tab.title;
    if (tab?.url)        $("pageUrl").textContent   = domainFromUrl(tab.url);
    if (tab?.favIconUrl) {
      const fav = $("fav");
      fav.src    = tab.favIconUrl;
      fav.hidden = false;
    }

    // Auth check
    const session = await BibliariumApi.getSession();
    if (!session?.access_token) {
      $("authGate").classList.remove("hidden");
      return;
    }
    try {
      const res = await BibliariumApi.authorizedFetch("/api/extension/me", { method: "GET" });
      if (!res.ok) throw new Error();
    } catch {
      $("authGate").classList.remove("hidden");
      return;
    }

    $("main").classList.remove("hidden");

    // Pause toggle
    let paused = await isPaused();
    renderPauseState(paused);

    $("pauseBtn").addEventListener("click", async () => {
      paused = !paused;
      await setPaused(paused);
      renderPauseState(paused);
    });

    // Save button
    const btn   = $("saveBtn");
    const label = $("saveBtnLabel");

    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      btn.disabled        = true;
      label.textContent   = "Saving…";
      $("msg").classList.add("hidden");

      try {
        const res = await BibliariumApi.authorizedFetch("/api/extension/capture", {
          method: "POST",
          body: JSON.stringify({
            url:          tab?.url         || "",
            title:        tab?.title       || null,
            faviconUrl:   tab?.favIconUrl  || null,
            note:         null,
            selectedText: null,
            source:       "popup",
            collectionId: null,
            tags:         [],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);

        btn.classList.add("success");
        label.textContent = data.duplicate ? "✓ Already on board" : "✓ Saved!";
        setTimeout(() => window.close(), 1400);
      } catch (err) {
        btn.disabled      = false;
        btn.classList.remove("success");
        label.textContent = "Save to board";
        const msg         = $("msg");
        msg.textContent   = err.message || "Save failed";
        msg.classList.remove("hidden");
      }
    });
  }

  void init();
})();
