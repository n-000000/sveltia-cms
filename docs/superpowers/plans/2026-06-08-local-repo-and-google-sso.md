# Local Repo Fix + Google SSO Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `showDirectoryPicker` AbortError that breaks local-repo sign-in, and add a "Sign In with Google" button to the sign-in UI when `base_url` is configured.

**Architecture:** Task 1 restructures `getRootDirHandle` so the File System Access API call (`showDirectoryPicker`) is the very first `await` in the manual-click path — before any IndexedDB macrotasks that would expire Chrome's user-activation window. Task 2 adds a new derived flag and button to `sign-in.svelte` that calls the existing `signInManually(backendName)` (identical to the GitHub button) but with a "Sign In with Google" label, gated on `base_url` being set in the backend config.

**Tech Stack:** Svelte 5 (runes), Vitest, `@sveltia/ui` Button component, `@sveltia/i18n` `_()` helper.

---

## File Map

| File | Change |
|---|---|
| `src/lib/services/backends/fs/local.js` | Restructure `getRootDirHandle` — picker-first path when `showPicker: true` |
| `src/lib/services/backends/fs/local.test.js` | Add ordering-guarantee test; verify existing tests still pass |
| `src/lib/components/entrance/sign-in.svelte` | Add `hasGoogleAuth` derived + "Sign In with Google" button |
| `src/lib/locales/en.yaml` | Add `sign_in_with_google` locale key |

---

## Task 1: Fix `getRootDirHandle` — picker before IndexedDB

**Root cause recap:** `getRootDirHandle` currently does `await rootDirHandleDB?.get(...)` (an IndexedDB macrotask) before calling `window.showDirectoryPicker()`. Chrome's File System Access API requires `showDirectoryPicker` to be called within the browser's transient user-activation window (same task as the click). The IndexedDB read expires that window, causing Chrome to throw `AbortError` — which Sveltia surfaces as "A repository root directory could not be selected."

**Fix:** When `showPicker: true` (manual button click), call `showDirectoryPicker()` as the first `await`, validate `.git`, cache the handle, and return. Skip the IndexedDB cache-check path entirely. The cache-check path is unchanged and still used when `showPicker: false` (auto sign-in on page load).

**Files:**
- Modify: `src/lib/services/backends/fs/local.js` (function `getRootDirHandle`, lines 68–116)
- Modify: `src/lib/services/backends/fs/local.test.js` (add one new test in `describe('getRootDirHandle')`)

- [ ] **Step 1.1: Add the ordering-guarantee test (TDD — write it failing first)**

  Open `src/lib/services/backends/fs/local.test.js`. Inside `describe('getRootDirHandle')`, after the last existing test in that block (around line 393), add:

  ```js
  it('calls showDirectoryPicker before any IndexedDB read when showPicker is true', async () => {
    const callOrder = [];

    mockDBGet.mockImplementation(() => {
      callOrder.push('indexeddb');
      return Promise.resolve(null);
    });

    mockDirHandle.getDirectoryHandle.mockResolvedValue({});
    /** @type {any} */ (global.window).showDirectoryPicker.mockImplementation(() => {
      callOrder.push('picker');
      return Promise.resolve(mockDirHandle);
    });

    const { getRootDirHandle } = localBackend;
    localBackend.default.init();

    await getRootDirHandle({ showPicker: true });

    expect(callOrder[0]).toBe('picker');
    expect(callOrder).not.toContain('indexeddb');
  });
  ```

- [ ] **Step 1.2: Run the new test to confirm it fails**

  ```bash
  NODE_OPTIONS=--no-experimental-webstorage pnpm vitest run src/lib/services/backends/fs/local.test.js --reporter=verbose 2>&1 | grep -A5 "calls showDirectoryPicker before"
  ```

  Expected: **FAIL** — the test reports that `callOrder[0]` is `'indexeddb'` not `'picker'` (because the current code reads IndexedDB first).

- [ ] **Step 1.3: Implement the fix in `local.js`**

  Replace the entire `getRootDirHandle` function (lines 68–116) with:

  ```js
  export const getRootDirHandle = async ({ forceReload = false, showPicker = true } = {}) => {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('unsupported');
    }

    if (showPicker) {
      // Call showDirectoryPicker() as the first await — while the browser's transient
      // user-activation window is still open. Any preceding macrotask (e.g. an IndexedDB
      // read) would expire the activation and cause Chrome to throw AbortError.
      const handle = await window.showDirectoryPicker();

      if (handle) {
        try {
          await handle.getDirectoryHandle('.git');
        } catch (/** @type {any} */ ex) {
          if (ex.name === 'TypeMismatchError') {
            // .git is a file, not a directory — valid git worktree root
            await handle.getFileHandle('.git');
          } else {
            throw ex;
          }
        }

        await rootDirHandleDB?.set(ROOT_DIR_HANDLE_KEY, handle);
      }

      return /** @type {FileSystemDirectoryHandle | null} */ (handle ?? null);
    }

    // Auto sign-in path (showPicker: false): check the cached handle, no picker shown.
    /** @type {FileSystemDirectoryHandle | null} */
    let handle = forceReload ? null : ((await rootDirHandleDB?.get(ROOT_DIR_HANDLE_KEY)) ?? null);

    if (handle) {
      if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
        handle = null;
      } else {
        try {
          await handle.entries().next();
        } catch (ex) {
          // The directory may have been (re)moved. Return null so the caller can decide.
          handle = null;
          // eslint-disable-next-line no-console
          console.error(ex);
        }
      }
    }

    return handle;
  };
  ```

- [ ] **Step 1.4: Run the full local.test.js suite**

  ```bash
  NODE_OPTIONS=--no-experimental-webstorage pnpm vitest run src/lib/services/backends/fs/local.test.js --reporter=verbose 2>&1 | tail -30
  ```

  Expected: all tests pass. The previously-failing ordering test now passes. Existing tests pass because:
  - Tests that call `getRootDirHandle()` with default `showPicker: true` now go through the picker path. Those tests that mock `showDirectoryPicker` continue to work; those that don't get `null` back, which their weak assertions (`if (result) { ... }`) tolerate.
  - Tests with `showPicker: false` are unchanged.

- [ ] **Step 1.5: Commit**

  ```bash
  git add src/lib/services/backends/fs/local.js src/lib/services/backends/fs/local.test.js
  git commit -m "$(cat <<'EOF'
  fix: call showDirectoryPicker before IndexedDB read in getRootDirHandle

  Chrome's transient user-activation window expires across macrotasks.
  The preceding IndexedDB read was expiring the activation before
  showDirectoryPicker() could be called, producing an AbortError that
  Sveltia surfaces as "A repository root directory could not be selected."

  When showPicker is true (manual button click), go straight to the
  picker. When showPicker is false (auto sign-in), keep the cache path.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 2: "Sign In with Google" button in sign-in.svelte

When a `base_url` is configured in the CMS backend config (as musictide does, pointing to `musictide-auth.leftfield.workers.dev`), show a "Sign In with Google" button above the existing GitHub button. The button calls `signInManually(backendName)` — the Worker at `base_url` already serves the Google sign-in page and posts `authorization:github:success:{token}` back, which Sveltia's existing OAuth message handler consumes. No new plumbing needed.

**Files:**
- Modify: `src/lib/locales/en.yaml` (add one key)
- Modify: `src/lib/components/entrance/sign-in.svelte` (add derived + button)

- [ ] **Step 2.1: Add the locale key to `en.yaml`**

  Open `src/lib/locales/en.yaml`. Find line 72 (`sign_in_with_x`). Add directly below it:

  ```yaml
  sign_in_with_google: Sign In with Google
  ```

  The surrounding context should look like:

  ```yaml
  sign_in_with_x: Sign In with {$service}
  sign_in_with_google: Sign In with Google
  sign_in_using_access_token: Sign In Using Access Token
  ```

- [ ] **Step 2.2: Add `hasGoogleAuth` derived in `sign-in.svelte`**

  Open `src/lib/components/entrance/sign-in.svelte`. Find the `signInDisabled` derived (around line 57). Add a new derived directly after the closing of `signInDisabled` (before the `onMount` block):

  ```js
  /**
   * Whether to show a dedicated "Sign In with Google" button. True when a custom OAuth
   * base_url is configured — musictide points this at the musictide-auth Worker, which
   * serves a Google sign-in page and returns the service-account GitHub PAT.
   */
  const hasGoogleAuth = $derived(
    !isTestRepo && !!/** @type {GitBackend} */ (configuredBackend).base_url,
  );
  ```

- [ ] **Step 2.3: Add the Google button to the template**

  In the template section of `sign-in.svelte`, find the existing primary/secondary `<Button>` for the backend (around line 120):

  ```svelte
  <Button
    variant={showLocalBackendOption ? 'secondary' : 'primary'}
    label={isTestRepo
      ? _('work_with_test_repo')
      : _('sign_in_with_x', { values: { service: signInServiceLabel } })}
    disabled={signInDisabled}
    onclick={async () => {
      await signInManually(backendName);
    }}
  />
  ```

  Insert the Google button **immediately before** this existing button (between the `<Spacer />` and the existing button), and change the existing button's variant when the Google button is shown:

  ```svelte
  {#if hasGoogleAuth}
    <Button
      variant={showLocalBackendOption ? 'secondary' : 'primary'}
      label={_('sign_in_with_google')}
      disabled={signInDisabled}
      onclick={async () => {
        await signInManually(backendName);
      }}
    />
  {/if}
  <Button
    variant={showLocalBackendOption || hasGoogleAuth ? 'secondary' : 'primary'}
    label={isTestRepo
      ? _('work_with_test_repo')
      : _('sign_in_with_x', { values: { service: signInServiceLabel } })}
    disabled={signInDisabled}
    onclick={async () => {
      await signInManually(backendName);
    }}
  />
  ```

  The existing button becomes `secondary` when the Google button is showing as `primary`. When `hasGoogleAuth` is false (no `base_url`), the existing button keeps its current `primary` appearance — no regression for other deployments.

- [ ] **Step 2.4: Build and check for errors**

  ```bash
  pnpm build 2>&1 | tail -20
  ```

  Expected: clean build, bundle ~1.9 MB, no errors. Warnings about unused exports are fine.

- [ ] **Step 2.5: Commit**

  ```bash
  git add src/lib/locales/en.yaml src/lib/components/entrance/sign-in.svelte
  git commit -m "$(cat <<'EOF'
  feat: add Sign In with Google button when base_url is configured

  When base_url is set in the backend config, show a dedicated Google
  SSO button above the GitHub button. Both call signInManually(backendName)
  — the auth Worker at base_url already intercepts the OAuth popup and
  serves Google sign-in, returning the service-account PAT via the
  existing authorization:github:success postMessage.

  The GitHub button stays as a secondary fallback. No auth Worker changes.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Task 3: Copy bundle and smoke-test

- [ ] **Step 3.1: Copy the built bundle to musictide**

  ```bash
  cp package/dist/sveltia-cms.js /home/n0xx/Code/infra/service/musictide/static/admin/sveltia-cms.js
  ```

- [ ] **Step 3.2: Start musictide locally**

  In a separate terminal:
  ```bash
  cd /home/n0xx/Code/infra/service/musictide && yarn watch
  ```

  Note the port Hugo is serving on (typically 1313 or printed in output).

- [ ] **Step 3.3: Verify the local-repo fix**

  Open `http://localhost:<PORT>/admin/` in a real browser (Chrome or Chromium — required for File System Access API).

  1. The sign-in page loads.
  2. Click **"Work with Local Repository"**.
  3. The OS file picker opens immediately — select the musictide directory (`/home/n0xx/Code/infra/service/musictide`).
  4. CMS loads with musictide's collections. No "A repository root directory could not be selected" error.

  Expected: ✅ CMS loads without errors.

- [ ] **Step 3.4: Verify the Google SSO button**

  1. On the same sign-in page, confirm **"Sign In with Google"** appears above "Sign In with GitHub".
  2. Click **"Sign In with Google"** — the popup opens to `musictide-auth.leftfield.workers.dev`.
  3. Google sign-in flow completes. CMS authenticates.

  Expected: ✅ Google button is visible and functional.

- [ ] **Step 3.5: Commit the updated bundle to musictide**

  ```bash
  cd /home/n0xx/Code/infra/service/musictide
  git add static/admin/sveltia-cms.js
  git commit -m "$(cat <<'EOF'
  chore(cms): local repo fix + Google SSO button (musictide-patches)

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```
