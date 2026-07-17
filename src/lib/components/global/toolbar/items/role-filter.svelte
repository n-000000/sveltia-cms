<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import { ROLE_VALUES } from '$lib/services/contents/fields/visibility';
  import { prefs } from '$lib/services/user/prefs.svelte';

  /**
   * P16 role filter. One toggle per role in {@link ROLE_VALUES}; each hides fields tagged only with
   * roles that are currently off. State lives in `prefs.roleFilter` (auto-persisted).
   * Purely a view filter — see `isRoleVisible`; hidden fields keep their data.
   */

  /** @type {Record<string, string>} Icon per role. */
  const icons = { text: 'text_fields', photos: 'image', videos: 'movie' };
</script>

<div role="none" class="wrapper">
  <SelectButtonGroup aria-label={_('role_filter')}>
    {#each ROLE_VALUES as role (role)}
      {@const enabled = prefs.roleFilter?.[role] !== false}
      <SelectButton
        selected={enabled}
        variant="ghost"
        iconic
        aria-label={_(`show_role_${role}`)}
        onSelect={() => {
          prefs.roleFilter = { ...prefs.roleFilter, [role]: !enabled };
        }}
      >
        {#snippet startIcon()}
          <Icon name={icons[role]} />
        {/snippet}
      </SelectButton>
    {/each}
  </SelectButtonGroup>
</div>

<style>
  .wrapper {
    display: contents;

    :global {
      .select-button-group button {
        border-radius: var(--sui-button-medium-border-radius) !important;
      }
    }
  }
</style>
