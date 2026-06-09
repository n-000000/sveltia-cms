# Inline Create for Relation Fields — Design Spec

**Date:** 2026-06-09
**Status:** Approved
**Branch:** musictide-patches

---

## Problem

When writing an article in musictide CMS, the photographer must pre-create referenced entries (authors, events) before linking them via relation fields. If an author or event doesn't exist yet, the user must navigate away from the article, create the entry in the target collection, navigate back, and resume editing. This is disruptive, especially mid-event on mobile.

---

## Goal

Add a "Create new…" option to relation field dropdowns so users can create a referenced entry inline without leaving the article form. New entries are committed to git immediately and the field auto-selects the new value on completion.

---

## Scope

- **In scope:** single-select relation fields with `inline_create: true` in config
- **Out of scope:** multi-select relation fields, relation fields without the opt-in flag, non-relation widgets

---

## Config Schema

Two new optional properties on any `relation` widget:

```yaml
- label: Evento
  name: event
  widget: relation
  collection: events
  inline_create: true                # opt-in flag; feature is disabled unless present
  create_label: "Criar evento…"      # optional; text shown in dropdown and dialog title
                                     # defaults to "Create new…" if omitted
```

**Opt-in rationale:** behavioral safety — future relation fields added to configs get no implicit behavior. Unknown properties are silently ignored by upstream Sveltia, so this config is safe to deploy against either fork or upstream.

### musictide fields getting inline_create

| Field | Collection | create_label |
|-------|-----------|--------------|
| `event` | `events` | "Criar evento…" |
| `credit_texto` | `authors` | "Criar colaborador…" |
| `credit_fotos` | `authors` | "Criar colaborador…" |
| `credit_video` | `authors` | "Criar colaborador…" |

---

## Component Architecture

```
relation-editor.svelte
  ├── reads fieldConfig.inline_create and fieldConfig.create_label
  ├── owns: let dialogOpen = $state(false)
  ├── passes onCreateNew callback + createLabel to SelectEditor
  └── mounts InlineCreateDialog (new component)

select-editor.svelte
  └── threads onCreateNew + createLabel as optional props to SelectSingle

select-single.svelte
  ├── when onCreateNew is defined:
  │     appends { label: createLabel, value: '__inline_create__' } to options
  │     uses local value intermediary to intercept sentinel selection
  │     calls onCreateNew() instead of propagating '__inline_create__' to currentValue
  └── sentinel never leaves this component

inline-create-dialog.svelte  ← NEW
  └── all save logic isolated here (see Save Flow)
```

`select-multiple.svelte` is not modified. The `onCreateNew` prop is never passed to it.

---

## Dialog: Required Fields

The dialog renders only fields where `isFieldRequired({ fieldConfig, locale })` returns `true` — the same utility already used by `field-editor.svelte`. Fields with `required: false` (explicit) or schema defaults that mark them optional are excluded.

For musictide's target collections at time of writing:
- **events:** `title` (string) only
- **authors:** `title` (string) only — all other fields are `required: false`

The implementation is generic: it reads the target collection's field list at runtime and filters dynamically, so adding a required field to a collection automatically includes it in the dialog.

Field rendering reuses the existing `FieldEditor` component. No custom field rendering code is introduced.

---

## Save Flow

```
1. User selects "Create new…" in dropdown
   → relation-editor sets dialogOpen = true

2. Dialog mounts / opens:
   a. snapshot = get(entryDraft)
   b. targetCollection = getCollection(fieldConfig.collection)
      // from $lib/services/contents/collection — already imported in relation-editor.svelte context
   c. createDraft({ collection: targetCollection, dynamicValues: {} })
      // entryDraft is now the new empty draft for the target collection
      // non-required fields get their schema defaults (e.g. draft: false on authors)
   d. render FieldEditor for each required field

3. User fills required fields, clicks Save:
   a. saving = true  (disables Save + Cancel buttons)
   b. defaultLocale = get(entryDraft).defaultLocale
   c. newValue = get(entryDraft).currentValues[defaultLocale][fieldConfig.value_field]
      // captured before saveEntry() to guarantee availability
   d. await saveEntry()
      // commits new file to git; updates allEntries store
      // if saveEntry() throws: set saving = false, show error message, keep dialog open
   e. entryDraft.set(snapshot)     // restore article draft
   f. onCreated(newValue)          // relation-editor sets currentValue = newValue
   g. dialogOpen = false

4. User clicks Cancel (only available when not saving):
   a. entryDraft.set(snapshot)
   b. dialogOpen = false
```

**Error handling:** If `saveEntry()` throws (e.g. validation failure, network error), the dialog stays open, an error message is shown, and the snapshot is not restored. The user can fix the issue and retry, or cancel.

---

## Auto-select After Save

After step 3f, `currentValue` on the relation field is set to `newValue` (the `value_field` value from the saved entry, e.g. the author's `title`). The `getOptions` reactive derived in `relation-editor.svelte` will include the new entry on next tick (since `allEntries` was updated by `saveEntry()`), and the select widget will reflect the selection.

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `src/lib/components/contents/details/fields/relation/relation-editor.svelte` | modify | read `inline_create`/`create_label`; pass `onCreateNew` to SelectEditor; mount dialog |
| `src/lib/components/contents/details/fields/relation/inline-create-dialog.svelte` | **new** | entryDraft swap + FieldEditor rendering + saveEntry flow |
| `src/lib/components/contents/details/fields/select/select-editor.svelte` | modify | thread `onCreateNew` + `createLabel` optional props |
| `src/lib/components/contents/details/fields/select/select-single.svelte` | modify | sentinel option + local value interceptor |
| `/home/n0xx/Code/infra/service/musictide/static/admin/config.yaml` | modify | `inline_create: true` + `create_label` on 4 relation fields |

---

## Out-of-scope / Future

- **Multi-select inline create** — not needed for musictide; omitted intentionally
- **Pre-fill from search text** — if the user typed "Ana" in the combobox before selecting "Create new…", pre-populating the title field with "Ana" would be a nice touch; deferred
- **Nested inline create** — creating an entry that itself has a relation field; not handled, not needed
- **PT-PT i18n string for default label** — "Create new…" default falls back to English; musictide fields all specify `create_label` explicitly in Portuguese so this is a non-issue in practice
