# Bibliarium browser extension (MVP)

Chrome **Manifest V3**: toolbar popup, context menus, optional keyboard shortcut (`Alt+Shift+B`), background capture to your Bibliarium account.

## Features

- **Toolbar popup** — preview current tab, pick board (collection), tags, note, save.
- **Context menu** — save page, link, or image URL.
- **Quick-save** — command palette shortcut saves the active tab (uses default board from last popup save).
- **Offline queue** — failed saves are queued and retried periodically.
- **Notifications** — lightweight success / error toasts (where the browser allows).

## Auth model

The web app uses **Supabase** cookies; extensions cannot read those. Flow:

1. Sign in on the website.
2. Open **`/extension/connect`** in the same browser.
3. Copy the **session JSON** (access + refresh token).
4. Extension **Options** → paste JSON → **Save**.
5. For **HTTPS** production hosts, click **Request HTTPS access** so `fetch` to your API is allowed.

Tokens are stored in `chrome.storage.local` only on the user’s machine.

## API (same origin as the app)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/extension/me` | Validate bearer session |
| `GET` | `/api/extension/boards` | List collections (“boards”) |
| `POST` | `/api/extension/capture` | Create link (same ingestion as web) |
| `POST` | `/api/extension/refresh` | Rotate Supabase session |

All extension routes send `Authorization: Bearer <access_token>` and return CORS headers for `chrome-extension://` origins.

## Local dev

1. `npm run dev` (app on `http://127.0.0.1:3333`).
2. Chrome → `chrome://extensions` → **Load unpacked** → choose this `extension/` folder.
3. Options → base URL `http://127.0.0.1:3333` → save session from `/extension/connect`.

## Package for download

From repo root:

```bash
npm run extension:zip
```

Creates `public/bibliarium-extension.zip` (served by Next at `/bibliarium-extension.zip`).

## Firefox

- Reuse the same folder; replace `chrome.*` calls with `browser.*` via [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) in a thin wrapper.
- Add `browser_specific_settings.gecko` / `strict_min_version` in `manifest.json` when packaging for AMO.

## Permissions rationale

| Permission | Why |
| --- | --- |
| `storage` | Base URL, session JSON, default board, offline queue |
| `contextMenus` | Save page / link / image |
| `activeTab` | Read current tab when the user opens the popup |
| `tabs` | Keyboard shortcut + tab URL/title in background |
| `notifications` | Save feedback |
| `alarms` | Flush offline queue periodically |
| `host_permissions` | Local dev API |
| `optional_host_permissions` | Production HTTPS after user grants |

No remote code; no broad `<all_urls>` by default.
