# Design: Local Repo Fix + Google SSO Button

**Date:** 2026-06-08  
**Branch:** musictide-patches  
**Status:** Approved

---

## Problem Summary

Two independent improvements for the musictide fork:

1. **Local repository broken** — clicking "Work with Local Repository" always errors with
   "A repository root directory could not be selected. Please try again."
   (`picker_dismissed` / `AbortError`).

2. **Sign-in UI is a lie** — the "Sign In with GitHub" button actually opens a Google sign-in
   popup (via the `musictide-auth` Worker), which is confusing. A dedicated "Sign In with
   Google" button would make the UI honest.

---

## Issue 1 — Local Repo `AbortError` Fix

### Root Cause

`getRootDirHandle` in `src/lib/services/backends/fs/local.js` does an IndexedDB read
(`await rootDirHandleDB?.get(ROOT_DIR_HANDLE_KEY)`) **before** calling
`window.showDirectoryPicker()`. IndexedDB is a macrotask; Chrome's File System Access API
requires `showDirectoryPicker` to be called within the same task as the originating user
gesture. By the time the IndexedDB read resolves, the transient user activation has expired
and Chrome throws `AbortError`.

### Fix

Restructure `getRootDirHandle` so that when `showPicker: true` (manual button click),
`showDirectoryPicker()` is called **first** — before any IndexedDB or async permission
checks. When `showPicker: false` (auto sign-in on page load), keep the existing cache-first
path unchanged.

Concretely:

```
showPicker: false (auto)          showPicker: true (manual click)
─────────────────────────         ──────────────────────────────
1. Check IndexedDB cache          1. showDirectoryPicker()  ← within user gesture
2. requestPermission on handle    2. Validate .git exists
3. If invalid → return null       3. Cache handle in IndexedDB
4. Return cached handle           4. Return handle
```

The `.git` validation and IndexedDB write happen AFTER the picker resolves, so they don't
affect the user activation window.

### Files changed

- `src/lib/services/backends/fs/local.js` — `getRootDirHandle` only (~25 lines)

### Dev workflow enabled

After this fix:
1. `pnpm dev` in sveltia-cms
2. `yarn watch` in musictide  
3. `http://localhost:PORT/admin/` → "Work with Local Repository" → pick musictide folder
4. Full CMS, no credentials, changes write directly to local files

No auth Worker involvement. No PAT needed. `localhost` stays out of `ALLOWED_DOMAINS`
(no security regression).

---

## Issue 2 — Google SSO Button in Sign-In UI (optional)

### Context

The `musictide-auth` Worker at `base_url` (from `config.yml`) serves a Google sign-in page
at `/auth`. Currently, Sveltia opens this as a GitHub OAuth popup (hijacking the standard
OAuth flow). The postMessage response format is already what Sveltia expects:
`authorization:github:success:{token}` + `mt-user-data`.

### Fix

Add a "Sign In with Google" button above the existing GitHub button in `sign-in.svelte`.
The button is only shown when `base_url` is set in the backend config (so it's
musictide-specific via config, not hardcoded). It opens a popup to `base_url + /auth`
directly — the same URL the hijacked GitHub flow was going to anyway — and listens for the
same two postMessages.

The existing "Sign In with GitHub" button stays as a fallback and remains functional.

### Approach

`signInManually('github')` already opens the popup and sets up the message listener
(`authorize` in `shared/auth.js`) that handles `authorization:github:success:{token}`.
The musictide-auth Worker already sends exactly that message. No new message handling needed.

- In `sign-in.svelte`: derive `hasGoogleAuth` from `configuredBackend.base_url` being set.
  If true, render a "Sign In with Google" button above the existing GitHub button.
- The Google button's `onclick` simply calls `signInManually(backendName)` — identical to
  the existing GitHub button's handler.
- No new config keys. `base_url` already exists in the musictide `config.yml`.
- No changes to the auth Worker.
- This means the "Sign In with Google" button is literally 10 lines added to the template.

### Files changed

- `src/lib/components/entrance/sign-in.svelte` (~40 lines added)

### What stays the same

- Auth Worker: unchanged
- `musictide/static/admin/index.html`: unchanged (the `mt-user-data` listener already
  handles both the old and new flow)
- All other Sveltia components: unchanged

---

## Scope: What's NOT in this spec

- Adding `localhost` to Worker `ALLOWED_DOMAINS` — explicitly ruled out (security risk)
- Configurable auth backend list — deferred; not needed given the above fixes
- Any changes to the R2 proxy Worker

---

## Build & verification steps

After implementing:
```bash
pnpm build
cp package/dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
# In a real browser on localhost:
# 1. Click "Work with Local Repository" → picker opens → select musictide folder → in
# 2. Click "Sign In with Google" → popup → Google sign-in → redirects back → authenticated
```
