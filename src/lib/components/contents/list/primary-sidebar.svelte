<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Divider, Icon, Listbox, Option, OptionGroup } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import SingletonOption from '$lib/components/contents/list/singleton-option.svelte';
  import PublishButton from '$lib/components/global/toolbar/items/publish-button.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { cmsConfig } from '$lib/services/config';
  import { allEntries } from '$lib/services/contents';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { getValidCollectionFiles } from '$lib/services/contents/collection/files';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @typedef {object} Props
   * @property {boolean} [isSearchPage] Whether the current page is the search results page.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    isSearchPage = false,
    /* eslint-enable prefer-const */
  } = $props();

  const numberFormatter = $derived(Intl.NumberFormat(appLocale.current));
  // @ts-ignore Dividers can be included in the collection list
  const collections = $derived($cmsConfig?.collections?.filter(({ hide }) => !hide) ?? []);
  const singletons = $derived($cmsConfig?.singletons ?? []);
  /**
   * P9: nest collections carrying a `nav_group` under that label instead of the default
   * “Collections” heading — e.g. `Publicidade` for the `Conteúdo`/`Rodapé` collections — while
   * everything else keeps today’s single flat list. Groups appear in first-occurrence order.
   */
  const ungroupedCollections = $derived(
    collections.filter((collection) => 'divider' in collection || !collection.nav_group),
  );
  const navGroups = $derived.by(() => {
    /** @type {Map<string, object[]>} */
    const groups = new Map();

    collections.forEach((collection) => {
      const navGroup = 'divider' in collection ? undefined : collection.nav_group;

      if (navGroup) {
        groups.set(navGroup, [...(groups.get(navGroup) ?? []), collection]);
      }
    });

    return [...groups];
  });
</script>

{#snippet collectionOption(collection, index)}
  {#await sleep() then}
    {#if !('divider' in collection)}
      {@const { name, label, icon } = collection}
      {@const soleFile =
        'files' in collection && getValidCollectionFiles(collection.files).length === 1
          ? getValidCollectionFiles(collection.files)[0]
          : undefined}
      <Option
        label={label || name}
        selected={env.isSmallScreen || isSearchPage ? false : $selectedCollection?.name === name}
        onSelect={() => {
          // A files collection with exactly one file has nothing to list — open it directly,
          // same as a `singletons` entry does, instead of showing a one-row FileList first.
          goto(`/collections/${name}${soleFile ? `/entries/${soleFile.name}` : ''}`, {
            transitionType: 'forwards',
          });
        }}
      >
        {#snippet startIcon()}
          <Icon name={icon || 'bookmark_manager'} />
        {/snippet}
        {#snippet endIcon()}
          {#key $allEntries}
            {@const count = (
              'files' in collection ? collection.files : getEntriesByCollection(name)
            ).length}
            <span class="count" aria-label="({_('x_entries', { values: { count } })})">
              {numberFormatter.format(count)}
            </span>
          {/key}
        {/snippet}
      </Option>
    {:else if collection.divider}
      <Divider />
    {/if}
  {/await}
{/snippet}

<div role="none" class="primary-sidebar">
  {#if env.isSmallScreen}
    <header>
      <h2>{_('contents')}</h2>
      <PublishButton />
    </header>
    <QuickSearchBar
      onclick={(event) => {
        event.preventDefault();
        goto('/search');
      }}
    />
  {/if}
  <Listbox aria-label={_('collection_list')} aria-controls="collection-container">
    {#if ungroupedCollections.length}
      <OptionGroup label={_('collections')}>
        {#each ungroupedCollections as collection, index (collection.name ?? index)}
          {@render collectionOption(collection, index)}
        {/each}
      </OptionGroup>
    {/if}
    {#each navGroups as [groupLabel, groupCollections] (groupLabel)}
      <OptionGroup label={groupLabel}>
        {#each groupCollections as collection, index (collection.name ?? index)}
          {@render collectionOption(collection, index)}
        {/each}
      </OptionGroup>
    {/each}
    {#if singletons.length}
      {#if env.isSmallScreen || collections.length}
        <!-- Use the user-friendly “Files” label instead of “Singletons” -->
        <OptionGroup label={_('files')}>
          {#each singletons as file, index (file.name ?? index)}
            {#await sleep() then}
              {#if !('divider' in file)}
                <SingletonOption {file} />
              {:else if file.divider}
                <Divider />
              {/if}
            {/await}
          {/each}
        </OptionGroup>
      {:else}
        <!-- Show the singletons just like a file collection -->
        {@const count = singletons.length}
        <OptionGroup label={_('collections')}>
          <Option
            label={_('files')}
            selected={$selectedCollection?.name === '_singletons'}
            onSelect={() => {
              goto('/collections/_singletons', { transitionType: 'forwards' });
            }}
          >
            {#snippet startIcon()}
              <Icon name="bookmark_manager" />
            {/snippet}
            {#snippet endIcon()}
              <span class="count" aria-label="({_('x_entries', { values: { count } })})">
                {numberFormatter.format(count)}
              </span>
            {/snippet}
          </Option>
        </OptionGroup>
      {/if}
    {/if}
  </Listbox>
</div>
