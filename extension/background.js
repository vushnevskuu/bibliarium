/* global chrome, BibliariumApi */
importScripts("api.js");

const MENU = {
  PAGE: "bibliarium-save-page",
  LINK: "bibliarium-save-link",
  IMAGE: "bibliarium-save-image",
};

function installMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU.PAGE,
      title: "Save page to Bibliarium",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: MENU.LINK,
      title: "Save link to Bibliarium",
      contexts: ["link"],
    });
    chrome.contextMenus.create({
      id: MENU.IMAGE,
      title: "Save image to Bibliarium",
      contexts: ["image"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  installMenus();
  chrome.alarms.create("flush-bibliarium-queue", { periodInMinutes: 30 });
});

chrome.runtime.onStartup.addListener(() => {
  installMenus();
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "flush-bibliarium-queue") {
    BibliariumApi.flushQueue().catch(() => {});
  }
});

async function notifyOk(title) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Bibliarium",
      message: title || "Saved to your board",
    });
  } catch {
    /* notifications optional */
  }
}

async function quickSaveTab(tab) {
  if (!tab?.id) return;
  const session = await BibliariumApi.getSession();
  if (!session?.access_token) {
    const base = await BibliariumApi.getBaseUrl();
    await chrome.tabs.create({ url: `${base}/extension/connect` });
    return;
  }
  const collectionId =
    (await chrome.storage.sync.get(BibliariumApi.STORAGE.defaultCollectionId))[
      BibliariumApi.STORAGE.defaultCollectionId
    ] || null;
  try {
    const data = await BibliariumApi.captureWithQueue({
      url: tab.url || "",
      title: tab.title || null,
      faviconUrl: tab.favIconUrl || null,
      note: null,
      selectedText: null,
      source: "keyboard",
      collectionId,
      tags: [],
    });
    const t =
      data.duplicate && data.link
        ? "Already on board"
        : data.link?.title || "Saved";
    await notifyOk(t);
  } catch (e) {
    if (e && e.message === "QUEUED_OFFLINE") {
      await notifyOk("Queued — will sync when online");
      return;
    }
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Bibliarium",
      message: e.message || "Save failed",
    });
  }
}

// Handle save request from content script (copy-event toast)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "BIBLIARIUM_QUICK_SAVE") return false;

  void (async () => {
    const session = await BibliariumApi.getSession();
    if (!session?.access_token) {
      sendResponse({ notConnected: true });
      return;
    }
    try {
      const data = await BibliariumApi.captureWithQueue({
        url: msg.url || "",
        title: msg.title || null,
        faviconUrl: msg.faviconUrl || null,
        note: null,
        selectedText: null,
        source: "copy-event",
        collectionId: null,
        tags: [],
      });
      sendResponse({ ok: true, duplicate: Boolean(data.duplicate) });
    } catch (e) {
      if (e && e.message === "QUEUED_OFFLINE") {
        sendResponse({ ok: true, queued: true });
      } else {
        sendResponse({ ok: false, error: e?.message || "Save failed" });
      }
    }
  })();

  return true; // keep channel open for async sendResponse
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "quick-save-tab") return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    void quickSaveTab(tab);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void (async () => {
    const session = await BibliariumApi.getSession();
    if (!session?.access_token) {
      const base = await BibliariumApi.getBaseUrl();
      await chrome.tabs.create({ url: `${base}/extension/connect` });
      return;
    }
    const collectionId =
      (await chrome.storage.sync.get(BibliariumApi.STORAGE.defaultCollectionId))[
        BibliariumApi.STORAGE.defaultCollectionId
      ] || null;

    let url = tab?.url || "";
    let title = tab?.title || null;
    let faviconUrl = tab?.favIconUrl || null;
    let source = "context-page";

    if (info.menuItemId === MENU.LINK && info.linkUrl) {
      url = info.linkUrl;
      title = info.linkText || null;
      source = "context-link";
    }
    if (info.menuItemId === MENU.IMAGE && info.srcUrl) {
      url = info.srcUrl;
      title = info.srcUrl;
      source = "context-image";
    }
    if (info.menuItemId === MENU.PAGE) {
      source = "context-page";
    }

    try {
      const data = await BibliariumApi.captureWithQueue({
        url,
        title,
        faviconUrl,
        note: null,
        selectedText: info.selectionText || null,
        source,
        collectionId,
        tags: [],
      });
      const t =
        data.duplicate && data.link
          ? "Already on board"
          : data.link?.title || "Saved";
      await notifyOk(t);
    } catch (e) {
      if (e && e.message === "QUEUED_OFFLINE") {
        await notifyOk("Queued offline");
        return;
      }
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Bibliarium",
        message: (e && e.message) || "Save failed",
      });
    }
  })();
});
