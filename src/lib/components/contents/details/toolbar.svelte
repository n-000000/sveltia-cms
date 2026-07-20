<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import {
    Alert,
    AlertDialog,
    Button,
    Divider,
    Menu,
    MenuButton,
    MenuItem,
    MenuItemCheckbox,
    SplitButton,
    Switch,
    Toast,
    Toolbar,
    TruncatedText,
  } from '@sveltia/ui';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import EditSlugDialog from '$lib/components/contents/details/edit-slug-dialog.svelte';
  import RoleFilter from '$lib/components/global/toolbar/items/role-filter.svelte';
  import { goBack, goto } from '$lib/services/app/navigation';
  import { skipCIConfigured, skipCIEnabled } from '$lib/services/backends/git/shared/integration';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import { entryDraft, entryDraftModified } from '$lib/services/contents/draft';
  import { createDraft } from '$lib/services/contents/draft/create';
  import { saveEntry } from '$lib/services/contents/draft/save';
  import { revertChanges } from '$lib/services/contents/draft/update/revert';
  import { copyFromLocaleToast, editorFirstPane } from '$lib/services/contents/editor';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getEntryPreviewURL } from '$lib/services/contents/entry';
  import { getLocalizedEntrySummary } from '$lib/services/contents/entry/summary';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { env } from '$lib/services/user/env.svelte';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] Whether to disable controls other than the Back button.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    disabled = false,
    /* eslint-enable prefer-const */
  } = $props();

  let showValidationToast = $state(false);
  let showEditSlugDialog = $state(false);
  let showErrorDialog = $state(false);
  let errorMessage = $state('');
  let saving = $state(false);
  /** @type {MenuButton | undefined} */
  let menuButton = $state();

  const notFound = $derived($entryDraft === undefined);
  const isNew = $derived($entryDraft?.isNew ?? true);
  const isIndexFile = $derived($entryDraft?.isIndexFile ?? false);
  const collection = $derived($entryDraft?.collection);
  const entryCollection = $derived(collection?._type === 'entry' ? collection : undefined);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const originalEntry = $derived($entryDraft?.originalEntry);
  const { defaultLocale } = $derived((collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG);
  const collectionName = $derived(collection?.name);
  const collectionLabel = $derived(
    // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
    appLocale.current && collection ? getCollectionLabel(collection) : '',
  );
  const canPreview = $derived($entryDraft?.canPreview ?? true);
  const modified = $derived(isNew || $entryDraftModified);
  const errorCount = $derived(
    Object.values($entryDraft?.validities ?? {})
      .flatMap((validity) => Object.values(validity).map(({ valid }) => !valid))
      .filter(Boolean).length,
  );
  const previewURL = $derived(
    collection && originalEntry
      ? getEntryPreviewURL(originalEntry, defaultLocale, collection, collectionFile)
      : undefined,
  );
  const isDraft = $derived(
    !!($entryDraft?.currentValues?.[
      defaultLocale ?? Object.keys($entryDraft?.currentValues ?? {})[0]
    ]?.draft),
  );
  const identifierField = $derived(collection?.identifier_field ?? 'title');
  // The locale shown in the primary (left) editor pane, when it's in edit mode — the "current
  // language" the user is typing in. Undefined when that pane is previewing.
  const currentLocale = $derived(
    $editorFirstPane?.mode === 'edit' ? $editorFirstPane.locale : undefined,
  );
  // Show the title from the locale being edited first, then the default locale, then any locale
  // that has one — so the breadcrumb tracks the current language and never goes blank when only a
  // non-default locale is filled in.
  const liveTitle = $derived(
    getLocalizedEntrySummary($entryDraft?.currentValues ?? {}, {
      localePriority: [currentLocale, defaultLocale],
      identifierField,
    }),
  );

  /**
   * Go back to the previous page. If the entry is a singleton file, go to the collections list.
   * Otherwise, go to the collection entries list.
   */
  const _goBack = () => {
    goBack(collectionName === '_singletons' ? '/collections' : `/collections/${collectionName}`);
  };

  /**
   * Save the entry draft.
   * @param {object} [options] Options.
   * @param {boolean} [options.skipCI] Whether to disable automatic deployments for the change.
   */
  const save = async ({ skipCI = undefined } = {}) => {
    saving = true;

    if (!collection) {
      return;
    }

    try {
      const savedEntry = await saveEntry({ skipCI });

      if (prefs.closeOnSave ?? true) {
        _goBack();
        $entryDraft = null;
      } else {
        if (isNew) {
          // Update the URL
          goto(`/collections/${collectionName}/entries/${savedEntry.subPath}`, {
            replaceState: true,
            notifyChange: false,
            transitionType: 'backwards',
          });
        }

        // Reset the draft
        createDraft({
          collection,
          collectionFile,
          originalEntry: savedEntry,
          extraValues: $entryDraft?.extraValues,
          expanderStates: $entryDraft?.expanderStates,
        });
      }
    } catch (/** @type {any} */ ex) {
      if (ex.message === 'validation_failed') {
        showValidationToast = true;
      } else if (ex.message === 'saving_failed') {
        showErrorDialog = true;
        errorMessage = ex.cause?.message ?? ex.message ?? _('unexpected_error');
      } else {
        showErrorDialog = true;
        errorMessage = '';
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    } finally {
      saving = false;
    }
  };
</script>

<Toolbar variant="primary" aria-label={_('primary')}>
  <BackButton
    aria-label={_('cancel_editing')}
    useShortcut={prefs.closeWithEscape}
    onclick={() => {
      _goBack();
    }}
  />
  <h2 role="none" class="breadcrumb">
    {#if !notFound}
      <button type="button" class="crumb-back" onclick={() => _goBack()}>{collectionLabel}</button>
      {#if liveTitle}
        <span class="sep" aria-hidden="true">/</span>
        <TruncatedText>{liveTitle}</TruncatedText>
      {/if}
    {/if}
  </h2>
  <Switch
    class="draft-toggle"
    label={_('draft_toggle')}
    checked={isDraft}
    onChange={() => {
      if ($entryDraft) {
        $entryDraft.currentValues[defaultLocale].draft = !$entryDraft.currentValues[defaultLocale]
          .draft;
      }
    }}
  />
  {#if !disabled && previewURL && !isDraft}
    <Button
      variant="tertiary"
      label={_('view_publication')}
      onclick={() => {
        openNewTab(previewURL);
      }}
    />
  {/if}
  <RoleFilter />
  <MenuButton
    {disabled}
    variant="ghost"
    iconic
    popupPosition="bottom-right"
    aria-label={_('show_editor_options')}
    bind:this={menuButton}
  >
    {#snippet popup()}
      <Menu aria-label={_('editor_options')}>
        <MenuItem
          label={_('edit_slug')}
          disabled={!!collectionFile || isNew || isIndexFile || entryCollection?.delete === false}
          onclick={() => {
            showEditSlugDialog = true;
          }}
        />
        <MenuItem
          label={_('revert_all_changes')}
          disabled={!modified}
          onclick={() => {
            revertChanges();
          }}
        />
        {#if !(env.isSmallScreen || env.isMediumScreen)}
          <Divider />
          <MenuItemCheckbox
            label={_('show_preview')}
            checked={$entryEditorSettings?.showPreview}
            disabled={!canPreview}
            onChange={() => {
              entryEditorSettings.update((view = {}) => ({
                ...view,
                showPreview: !view.showPreview,
              }));
            }}
          />
          <MenuItemCheckbox
            label={_('sync_scrolling')}
            checked={$entryEditorSettings?.syncScrolling}
            disabled={!canPreview && Object.keys($entryDraft?.currentValues ?? {}).length === 1}
            onChange={() => {
              entryEditorSettings.update((view = {}) => ({
                ...view,
                syncScrolling: !view.syncScrolling,
              }));
            }}
          />
        {/if}
      </Menu>
    {/snippet}
  </MenuButton>
  {#if $skipCIConfigured}
    <SplitButton
      variant="primary"
      label={_($skipCIEnabled ? (saving ? 'saving' : 'save') : saving ? 'publishing' : 'publish')}
      disabled={disabled || !modified || saving}
      keyShortcuts="Accel+S"
      onclick={() => {
        save();
      }}
    >
      {#snippet popup()}
        <!-- Show the opposite option: if automatic deployments are enabled, allow to disable it -->
        <Menu>
          <MenuItem
            label={_($skipCIEnabled ? 'save_and_publish' : 'save_without_publishing')}
            onclick={() => {
              save({ skipCI: !$skipCIEnabled });
            }}
          />
        </Menu>
      {/snippet}
    </SplitButton>
  {:else}
    <Button
      variant="primary"
      label={_(saving ? 'saving' : 'save')}
      disabled={disabled || !modified || saving}
      keyShortcuts="Accel+S"
      onclick={() => {
        save();
      }}
    />
  {/if}
</Toolbar>

<Toast bind:show={showValidationToast}>
  <Alert status="error">
    {_('entry_validation_errors', { values: { count: errorCount } })}
  </Alert>
</Toast>

<Toast id={$copyFromLocaleToast.id} bind:show={$copyFromLocaleToast.show}>
  {@const { status, message, count, sourceLanguage } = $copyFromLocaleToast}
  {#if message}
    <Alert {status}>
      {_(`editor.${message}`, {
        values: {
          count,
          source: sourceLanguage ? (getLocaleLabel(sourceLanguage) ?? sourceLanguage) : '',
        },
      })}
    </Alert>
  {/if}
</Toast>

<EditSlugDialog bind:open={showEditSlugDialog} />

<!-- @todo make the error message more informative -->
<AlertDialog
  bind:open={showErrorDialog}
  title={_('saving_entry.error.title')}
  onClose={() => {
    menuButton?.focus();
  }}
>
  {_('saving_entry.error.description')}
  {#if errorMessage}
    <div role="none" class="error">
      {errorMessage}
    </div>
  {/if}
</AlertDialog>

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .crumb-back {
    flex: none;
    border: 0;
    padding: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .crumb-back:hover {
    text-decoration: underline;
  }

  .sep {
    flex: none;
    margin: 0 6px;
    opacity: 0.5;
  }

  /* Bump the draft Switch a notch so it reads at the same scale as the neighbouring toolbar items.
     The class lands on the child Switch component's element, so it must be :global to match. */
  :global(.draft-toggle) {
    margin-inline: 4px;
    font-size: var(--sui-font-size-large);
  }

  .error {
    margin-top: 8px;
    border-radius: var(--sui-control-medium-border-radius);
    padding: 12px;
    background-color: var(--sui-secondary-background-color);
    font-size: var(--sui-font-size-default);
    line-height: 1.5;
  }
</style>
