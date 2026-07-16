# Backlog — musictide × Sveltia CMS fork

> ⚠️ **NOT canonical — this is a recovered point-in-time snapshot (P0–P7 + cleanup).**
> The single source of truth is **Magrathea** (`/home/n0xx/Code/infra/service/Magrathea`):
> live status + sequencing in `operations.md`, full item detail — **including the newer
> priority items P8–P14** (conditional inputs, AR validation, YouTube video, …) — in
> `components/sveltia-cms.md`. Update Magrathea, not this file.
>
> Recovered 2026-07-16 from session transcript `39ea8b98` (the original was untracked on
> `main` and lost on upstream re-sync). Fork is **frozen at 0.170.8** (see P2).

---

## P0 — Prod serving a broken CMS build  ✅ RESOLVED
0.170.6 was live and crashed after login (`TypeError: n is not a function`, collections
didn't render). Root cause: stale R2 artifact + upstream `{const}` syntax. 0.170.7/0.170.8
shipped clean and verified.

## P1 — Root-cause the crash  ✅ DONE
6901 unit tests passed but missed the render path. Isolated to the `{const}` collision /
stale-artifact; not a musictide-patch fault.

## P2 — Version policy: upstream is a moving target  ✅ SUPERSEDED (FREEZE, 2026-07-15)
Decision: freeze at 0.170.8, stop re-porting per patch-release. Pull a specific upstream
fix only if one ever actually matters.

## P3 — Branch & merge strategy: the port has no durable home  🟡 OPEN (risk materialized)
The rewrite-proof artifacts (`REBASE-RUNBOOK.md`, `0001-Port-musictide-patches-*.patch`,
`TEST-PLAN-*.md`) survive **only** in worktrees `wt-0.170.5` / `wt-0.170.6`; the current
`wt-0.170.8` has no `docs/musictide/`, and `patch-0.170.8` carries no committed runbook.
One `git worktree prune` from data loss. Fix: commit a 0.170.8 runbook/patch here before
pruning worktrees. (Committing this file is step 1.)

## P4 — `publish-cms` moved into the fork  ✅ FORK-SIDE / musictide cleanup pending
`scripts/publish-cms` created here (fixes the old `dist/`→`package/dist/` path bug).
Pending in musictide: delete `.rc.d/publish-cms`, repoint CLAUDE.md at this script, close
musictide PR #5 (moot).

## P5 — Push the R2 fetch interceptor into the fork  ⏸ DEFERRED → superseded by bundle plan
Only `mt-r2-proxy.js` is a true monkeypatch (no public Sveltia API). Deferred until a 2nd
consumer exists. Evolved goal: *delete* the interceptor via bundle-native, build-time R2
key prefixing (kills worker+glue). Gated on reading the `musictide-media-proxy` source.

## P6 — Feature: live-render preview pane (user-requested)  🔴 OPEN
Replace Sveltia's Markdown-approximation preview with an actual render of the live Blowfish
theme so the editor sees the real page. `registerPreviewTemplate`/`registerPreviewStyle`
render JS in the CMS, not Hugo output; a faithful render needs Hugo/Blowfish markup+CSS in
the preview iframe (dedicated Hugo template emitting the article shell + theme CSS, fed
edit-time field data). Non-trivial; own spec when picked up.

## P7 — Fix `widget: image` Ctrl+A → Insert multi-insert  🔴 OPEN (half-covered)
Insert reads internal Svelte 5 `selectedAssets`; Ctrl+A sets DOM `aria-selected` via
synthetic clicks but doesn't update `selectedAssets`, so only 1 image inserts. Current
`selectAll()`/`autoSelectAll` is wired only to the external R2 panel
(`autoSelectAll={multiple && open && !isDefaultLibrary}`); the internal/default library
Ctrl+A path is still unwired. Fork fix required; verify in the actual browser.

## Cleanup / housekeeping
- Prune worktrees `wt-0.170.5` / `wt-0.170.6` — but only AFTER P3 rescues their artifacts.
- GitHub release `v0.166.1-mt.1` on the fork is vestigial (R2 is source of truth) — delete
  or leave.
- Real email in git history (`espinhomagazine@gmail.com` from CMS commits): musictide now
  has an `emails` pre-push guard + clears the Utilizadores email after token-gen; a one-time
  history scrub of the already-committed address may still be outstanding. Fix commit-author
  injection to no-reply first, then scrub.
