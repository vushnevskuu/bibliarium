/* global chrome, BibliariumApi */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function showMain() { $("main").classList.remove("hidden"); }
  function showAuth() { $("authGate").classList.remove("hidden"); }
  function hideAll() { ["main", "authGate"].forEach((id) => $( id).classList.add("hidden")); }

  function domainFromUrl(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }

  async function init() {
    const base = await BibliariumApi.getBaseUrl();

    // Connect button
    $("openConnect").addEventListener("click", () => {
      chrome.tabs.create({ url: `${base}/extension/connect` });
    });

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Fill page info
    if (tab?.title) $("pageTitle").textContent = tab.title;
    if (tab?.url) $("pageUrl").textContent = domainFromUrl(tab.url);
    if (tab?.favIconUrl) {
      const fav = $("fav");
      fav.src = tab.favIconUrl;
      fav.hidden = false;
    }

    // Check auth
    const session = await BibliariumApi.getSession();
    if (!session?.access_token) {
      showAuth();
      return;
    }

    // Verify session is still valid
    try {
      const res = await BibliariumApi.authorizedFetch("/api/extension/me", { method: "GET" });
      if (!res.ok) throw new Error("invalid");
    } catch {
      showAuth();
      return;
    }

    showMain();

    // Save button
    const btn = $("saveBtn");
    const label = $("saveBtnLabel");

    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      label.textContent = "Saving…";
      $("msg").classList.add("hidden");

      try {
        const res = await BibliariumApi.authorizedFetch("/api/extension/capture", {
          method: "POST",
          body: JSON.stringify({
            url: tab?.url || "",
            title: tab?.title || null,
            faviconUrl: tab?.favIconUrl || null,
            note: null,
            selectedText: null,
            source: "popup",
            collectionId: null,
            tags: [],
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);

        // Success
        btn.classList.add("success");
        label.textContent = data.duplicate ? "✓ Already on board" : "✓ Saved!";

        setTimeout(() => window.close(), 1400);
      } catch (err) {
        btn.disabled = false;
        btn.classList.remove("success");
        label.textContent = "Save to Bibliarium";
        const msg = $("msg");
        msg.textContent = err.message || "Save failed";
        msg.classList.remove("hidden");
      }
    });
  }

  void init();
})();
