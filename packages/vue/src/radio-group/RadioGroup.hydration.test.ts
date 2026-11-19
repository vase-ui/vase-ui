import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import RadioChoices from '../../test/fixtures/RadioChoices.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML has the role, the checked radio, the names and values; the tab stop stays the checked radio', async () => {
    const props = {
      group: { name: 'storage', defaultValue: 'hdd' },
      items: [{ key: 'ssd' }, { key: 'hdd' }, { key: 'off', attrs: { disabled: true } }],
      field: {},
    };
    const root = await renderOnServer('RadioChoices', props);
    const group = root.querySelector('[role=radiogroup]')!;
    const [ssd, hdd, off] = root.querySelectorAll<HTMLInputElement>('[role=radiogroup] input');
    expect(group).toHaveAttribute('aria-labelledby', root.querySelector('label')!.id);
    expect(hdd!.checked).toBe(true);
    expect([ssd, hdd, off].map((radio) => `${radio!.name}=${radio!.value}`)).toEqual([
      'storage=ssd',
      'storage=hdd',
      'storage=off',
    ]);
    expect(off).toHaveAttribute('disabled');
    // Before the mount, the browser gives the checked radio the tab stop.
    expect(hdd).not.toHaveAttribute('tabindex');
    hydrate(RadioChoices, props, root);
    await nextTick();
    expect(hdd).toHaveAttribute('tabindex', '0');
    expect(ssd).toHaveAttribute('tabindex', '-1');
  });
});
