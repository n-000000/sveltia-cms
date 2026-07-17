<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  import { ROLE_VALUES } from '$lib/services/contents/fields/visibility';
  import { prefs } from '$lib/services/user/prefs.svelte';

  /**
   * P16 role filter. One independent toggle per role in {@link ROLE_VALUES}; turning a role off
   * hides fields tagged only with roles that are off. State in `prefs.roleFilter` (auto-persisted).
   * Purely a view filter — see `isRoleVisible`; hidden fields keep their data.
   */

  /** @type {Record<string, string>} Icon per role. */
  const icons = { text: 'text_fields', photos: 'image', videos: 'movie' };
</script>

<div role="none" class="role-filter">
  {#each ROLE_VALUES as role (role)}
    {@const enabled = prefs.roleFilter?.[role] !== false}
    <Button
      variant="ghost"
      iconic
      pressed={enabled}
      aria-label={_(`show_role_${role}`)}
      onclick={() => {
        prefs.roleFilter = { ...prefs.roleFilter, [role]: !enabled };
      }}
    >
      {#snippet startIcon()}
        <Icon name={icons[role]} />
      {/snippet}
    </Button>
  {/each}
</div>

<style>
  .role-filter {
    display: flex;
    align-items: center;
  }
</style>
