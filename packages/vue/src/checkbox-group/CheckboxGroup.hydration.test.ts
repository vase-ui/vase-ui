import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import AppleGroup from '../../test/fixtures/AppleGroup.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML has role group, the state of each checkbox and of the parent, and no aria-controls', async () => {
    const props = {
      group: { allValues: ['fuji', 'gala'], defaultValue: ['fuji'] },
      items: [
        { key: 'all', parent: true },
        { key: 'fuji', value: 'fuji' },
        { key: 'gala', value: 'gala' },
      ],
      field: {},
    };
    const root = await renderOnServer('AppleGroup', props);
    const group = root.querySelector('[role=group]')!;
    const all = root.querySelector<HTMLInputElement>('#all')!;
    expect(group).toHaveAttribute('aria-labelledby', root.querySelector('label')!.id);
    expect(root.querySelector<HTMLInputElement>('#fuji')!.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>('#gala')!.checked).toBe(false);
    expect(all).toHaveAttribute('data-indeterminate');
    expect(all).not.toHaveAttribute('aria-controls');
    hydrate(AppleGroup, props, root);
    await nextTick();
    expect(all.indeterminate).toBe(true);
    expect(all).toHaveAttribute('aria-controls', 'fuji gala');
  });
});
