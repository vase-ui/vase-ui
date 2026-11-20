import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { SelectRootChangeEventDetails, SelectRootOpenChangeEventDetails } from '@vase-ui/vue/select';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const trigger = () => byTestId('trigger');
const popup = () => byTestId('popup');
const item = (value: string) => byTestId(`item-${value}`);

async function mountSelect(setup: Props = {}) {
  const result = mount(SelectParts, setup);
  await nextTick();
  return result;
}

function shown(element: HTMLElement | null) {
  return !!element && element.checkVisibility();
}

async function opened() {
  await waitFor(() => expect(shown(popup())).toBe(true));
  return popup();
}

async function closed() {
  await waitFor(() => expect(shown(popup())).toBe(false));
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onValueChange: (value: unknown, details: SelectRootChangeEventDetails) =>
      log.push(`valueChange ${JSON.stringify(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: unknown) => log.push(`update ${JSON.stringify(value)}`),
    onOpenChange: (open: boolean, details: SelectRootOpenChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    'onUpdate:open': (open: boolean) => log.push(`update:open ${open}`),
  });
}

describe('the parts', () => {
  test('render their elements and roles', async () => {
    await mountSelect({ label: {}, list: {}, root: { defaultValue: 'banana' } });
    expect(byTestId('root').localName).toBe('div');
    expect(trigger().localName).toBe('button');
    expect(trigger()).toHaveAttribute('type', 'button');
    expect(trigger()).toHaveAttribute('role', 'combobox');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAttribute('aria-labelledby', byTestId('label').id);
    expect(byTestId('value')).toHaveTextContent('banana');
  });
});

describe('the value', () => {
  test('a press of an item selects it and closes the popup', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log) });
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(item('cherry'));
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'update:open true',
      'valueChange "cherry" item-press',
      'update "cherry"',
      'openChange false item-press',
      'update:open false',
    ]);
    expect(byTestId('value')).toHaveTextContent('cherry');
  });
});
