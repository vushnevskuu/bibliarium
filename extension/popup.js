/* global chrome, BibliariumApi */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function showMsg(text, ok) {
    const el = $("msg");
    el.textContent = text;
    el.classList.remove("hidden", "ok", "err");
    el.classList.add(ok ? "ok" : "err");
  }

  function parseTags(raw) {
    if (!raw || !raw.trim()) return [];
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function init() {
    const base = await BibliariumApi.getBaseUrl();
    $("openApp").href = `${base}/board`;

    const tab = await chrome.tabs.query({ active: true, currentWindow: true });
    const t = tab[0];
    const urlEl = $("pageUrl");
    const titleEl = $("pageTitle");
    const fav = $("fav");

    if (t?.url) urlEl.textContent = t.url;
    titleEl.textContent = t?.title || "Current tab";

    if (t?.favIconUrl) {
      fav.src = t.favIconUrl;
      fav.hidden = false;
    }

    const session = await BibliariumApi.getSession();
    if (!session?.access_token) {
      $("authGate").classList.remove("hidden");
      $("openConnect").onclick = () => {
        chrome.tabs.create({ url: `${base}/extension/connect` });
      };
      $("openOptions").onclick = () => chrome.runtime.openOptionsPage();
      return;
    }

    $("form").classList.remove("hidden");

    let me;
    try {
      const res = await BibliariumApi.authorizedFetch("/api/extension/me", {
        method: "GET",
      });
      me = await res.json();
      if (!res.ok) throw new Error(me.error || "Session invalid");
    } catch {
      $("authGate").classList.remove("hidden");
      $("form").classList.add("hidden");
      $("openConnect").onclick = () => {
        chrome.tabs.create({ url: `${base}/extension/connect` });
      };
      $("openOptions").onclick = () => chrome.runtime.openOptionsPage();
      return;
    }

    const boardsRes = await BibliariumApi.authorizedFetch(
      "/api/extension/boards",
      { method: "GET" }
    );
    const boardsData = await boardsRes.json();
    const sel = $("board");
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— No board —";
    sel.appendChild(opt0);
    if (boardsRes.ok && Array.isArray(boardsData.boards)) {
      for (const b of boardsData.boards) {
        const o = document.createElement("option");
        o.value = b.id;
        o.textContent = `${b.name} (${b.linkCount})`;
        sel.appendChild(o);
      }
    }

    const def = await chrome.storage.sync.get(
      BibliariumApi.STORAGE.defaultCollectionId
    );
    if (def[BibliariumApi.STORAGE.defaultCollectionId]) {
      sel.value = def[BibliariumApi.STORAGE.defaultCollectionId];
    }

    $("form").onsubmit = async (ev) => {
      ev.preventDefault();
      const btn = $("saveBtn");
      btn.disabled = true;
      $("msg").classList.add("hidden");
      const collectionId = $("board").value || null;
      const tags = parseTags($("tags").value);
      const note = $("note").value.trim() || null;
      try {
        const res = await BibliariumApi.authorizedFetch("/api/extension/capture", {
          method: "POST",
          body: JSON.stringify({
            url: t.url,
            title: t.title,
            faviconUrl: t.favIconUrl || null,
            note,
            selectedText: null,
            source: "popup",
            collectionId,
            tags,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        if (data.duplicate) {
          showMsg("Already on your board.", true);
        } else {
          showMsg("Saved.", true);
        }
        await chrome.storage.sync.set({
          [BibliariumApi.STORAGE.defaultCollectionId]: collectionId || "",
        });
      } catch (err) {
        showMsg(err.message || "Save failed", false);
      } finally {
        btn.disabled = false;
      }
    };
  }

  void init();
})();
