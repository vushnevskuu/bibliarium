/* global chrome */
(function () {
  "use strict";

  const STORAGE = {
    baseUrl: "baseUrl",
    session: "sessionJson",
    defaultCollectionId: "defaultCollectionId",
    queue: "offlineCaptureQueue",
  };

  async function getBaseUrl() {
    const v = await chrome.storage.sync.get(STORAGE.baseUrl);
    return (
      (typeof v[STORAGE.baseUrl] === "string" && v[STORAGE.baseUrl].trim()) ||
      "https://bibliarium.vercel.app"
    ).replace(/\/$/, "");
  }

  async function getSession() {
    const v = await chrome.storage.local.get(STORAGE.session);
    const raw = v[STORAGE.session];
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function setSession(obj) {
    await chrome.storage.local.set({
      [STORAGE.session]: JSON.stringify(obj),
    });
  }

  async function tryRefreshSession(session) {
    if (!session || !session.refresh_token) return session;
    const exp = session.expires_at;
    if (typeof exp === "number" && exp * 1000 > Date.now() + 90_000) {
      return session;
    }
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/extension/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };
    await setSession(next);
    return next;
  }

  async function authorizedFetch(path, init) {
    let session = await getSession();
    if (!session?.access_token) throw new Error("NOT_AUTH");
    session = await tryRefreshSession(session);
    if (!session?.access_token) throw new Error("NOT_AUTH");
    const base = await getBaseUrl();
    const headers = new Headers(init?.headers || {});
    headers.set("Authorization", `Bearer ${session.access_token}`);
    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${base}${path}`, { ...init, headers });
  }

  async function enqueueCapture(payload) {
    const v = await chrome.storage.local.get(STORAGE.queue);
    const q = Array.isArray(v[STORAGE.queue]) ? v[STORAGE.queue] : [];
    q.push({ payload, ts: Date.now() });
    await chrome.storage.local.set({ [STORAGE.queue]: q.slice(-50) });
  }

  async function flushQueue() {
    const v = await chrome.storage.local.get(STORAGE.queue);
    const q = Array.isArray(v[STORAGE.queue]) ? v[STORAGE.queue] : [];
    if (!q.length) return;
    const remain = [];
    for (const item of q) {
      try {
        await captureToServer(item.payload);
      } catch {
        remain.push(item);
      }
    }
    await chrome.storage.local.set({ [STORAGE.queue]: remain });
  }

  async function captureToServer(body) {
    const res = await authorizedFetch("/api/extension/capture", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text || res.statusText);
    }
    if (!res.ok) {
      const err = new Error(data.error || res.statusText);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function captureWithQueue(body) {
    try {
      return await captureToServer(body);
    } catch (e) {
      if (e && e.message === "NOT_AUTH") throw e;
      if (!navigator.onLine) {
        await enqueueCapture(body);
        throw new Error("QUEUED_OFFLINE");
      }
      throw e;
    }
  }

  globalThis.BibliariumApi = {
    getBaseUrl,
    getSession,
    setSession,
    tryRefreshSession,
    authorizedFetch,
    captureToServer,
    captureWithQueue,
    flushQueue,
    STORAGE,
  };
})();
