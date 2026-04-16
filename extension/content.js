/* global chrome */
(function () {
  "use strict";

  const HOST_ID = "__bibliarium_toast__";
  let dismissTimer = null;

  function removeToast() {
    clearTimeout(dismissTimer);
    const el = document.getElementById(HOST_ID);
    if (el) el.remove();
  }

  function showToast(url) {
    removeToast();

    let hostname;
    try {
      hostname = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return;
    }

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:2147483647;pointer-events:none;";

    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .wrap {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 14px;
          background: #141414;
          color: #fff;
          border-radius: 14px;
          font: 500 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          box-shadow: 0 8px 32px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.12);
          animation: in 0.18s ease;
          max-width: 300px;
          min-width: 220px;
        }
        @keyframes in {
          from { opacity:0; transform:translateY(10px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .host { font-size:12px; color:#999; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .save {
          background:#fff; color:#141414; border:none; border-radius:8px;
          padding:5px 12px; font:600 12px/1 inherit; cursor:pointer; flex-shrink:0;
          transition: opacity 0.12s;
        }
        .save:hover { opacity:0.85; }
        .save:disabled { opacity:0.5; cursor:not-allowed; }
        .close {
          background:transparent; border:none; color:#666; font-size:15px;
          cursor:pointer; flex-shrink:0; line-height:1; padding:0;
          transition: color 0.12s;
        }
        .close:hover { color:#fff; }
        .msg { font-size:13px; }
        .ok  { color:#6ee7a0; }
        .err { color:#ff8080; }
      </style>
      <div class="wrap">
        <span class="host" title="${hostname}">${hostname}</span>
        <button class="save" id="save">Save</button>
        <button class="close" id="close" aria-label="Dismiss">✕</button>
      </div>`;

    document.body.appendChild(host);

    shadow.getElementById("close").onclick = removeToast;

    shadow.getElementById("save").onclick = () => {
      const btn = shadow.getElementById("save");
      btn.disabled = true;
      btn.textContent = "…";

      chrome.runtime.sendMessage(
        {
          type: "BIBLIARIUM_QUICK_SAVE",
          url,
          title: document.title || null,
          faviconUrl:
            document.querySelector('link[rel~="icon"]')?.href ||
            document.querySelector('link[rel="shortcut icon"]')?.href ||
            null,
        },
        (resp) => {
          const wrap = shadow.querySelector(".wrap");
          if (!resp || !wrap) { removeToast(); return; }
          if (resp.notConnected) {
            wrap.innerHTML = '<span class="msg err">Not connected — open extension settings</span>';
          } else if (resp.duplicate) {
            wrap.innerHTML = '<span class="msg ok">✓ Already on board</span>';
          } else if (resp.ok) {
            wrap.innerHTML = '<span class="msg ok">✓ Saved!</span>';
          } else {
            wrap.innerHTML = `<span class="msg err">Failed: ${resp.error || "unknown"}</span>`;
          }
          dismissTimer = setTimeout(removeToast, 2000);
        }
      );
    };

    // Auto-dismiss after 5 s if no interaction
    dismissTimer = setTimeout(removeToast, 5000);
  }

  document.addEventListener("copy", () => {
    const text = window.getSelection()?.toString().trim() || "";
    if (!text) return;
    if (!/^https?:\/\//i.test(text)) return;

    chrome.storage.local.get(["sessionJson", "bibliarium_paused_until"], (v) => {
      // Not connected
      try {
        const s = JSON.parse(v.sessionJson || "null");
        if (!s?.access_token) return;
      } catch { return; }

      // Paused for today
      const pausedUntil = v["bibliarium_paused_until"];
      if (typeof pausedUntil === "number" && pausedUntil > Date.now()) return;

      showToast(text);
    });
  });
})();
