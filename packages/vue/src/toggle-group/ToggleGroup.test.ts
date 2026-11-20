import { describe, expect, inject, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import ToggleGroupInToolbar from '../../test/fixtures/ToggleGroupInToolbar.vue';
import ToggleGroupParts from '../../test/fixtures/ToggleGroupParts.vue';
import TogglesInFieldset from '../../test/fixtures/TogglesInFieldset.vue';
import { mount, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Item = { key: string; value?: string; attrs?: Record<string, unknown> };

const items = (...keys: string[]): Item[] => keys.map((key) => ({ key }));

async function mountGroup(group: Record<string, unknown>, list: Item[] = items('a', 'b', 'c')) {
  const scene = { group: reactive(group), items: reactive(list) };
  const { root, exposed } = mount(ToggleGroupParts, scene);
  await nextTick();
  const element = root.querySelector<HTMLElement>('[role=group]')!;
  return {
    ...scene,
    root,
    exposed,
    element,
    before: root.querySelector<HTMLInputElement>('#before')!,
    after: root.querySelector<HTMLInputElement>('#after')!,
    toggle: (key: string) => root.querySelector<HTMLElement>(`#${key}`)!,
    pressed: () =>
      [...element.querySelectorAll('[aria-pressed=true]')].map((toggle) => toggle.id).join(''),
    tabindexes: () =>
      [...element.querySelectorAll('[aria-pressed]')].map((toggle) =>
        toggle.getAttribute('tabindex'),
      ),
  };
}

/** Group attributes that write each event in `log`, with `v-model` when `write`. */
function record(log: string[], attrs: Record<string, unknown> = {}, write = false) {
  const box: Record<string, unknown> = {
    onValueChange: (value: string[]) => log.push(`valueChange ${value.join(',')}`),
    ...attrs,
  };
  box['onUpdate:modelValue'] = (value: string[]) => {
    log.push(`update ${value.join(',')}`);
    if (write) group.modelValue = value;
  };
  const group = reactive(box);
  return group;
}

const focused = () => (document.activeElement as HTMLElement).id || 'none';

test('the project compiles ToggleGroup and the fixtures in the modes of its app', () => {
  const app = inject('app');
  const isVapor = (component: object) => '__vapor' in component;
  expect(isVapor(ToggleGroup)).toBe(app === 'vapor' || app === 'vdom-interop');
  expect(isVapor(ToggleGroupParts)).toBe(app.startsWith('vapor'));
});

describe('the element', () => {
  test('is one div with role group, data-orientation and the attributes of the developer; it has no aria-orientation', async () => {
    const { element, exposed } = await mountGroup({
      'aria-label': 'Alignment',
      class: 'Group',
      orientation: 'vertical',
    });
    expect(element.localName).toBe('div');
    expect(element.getAttributeNames().sort()).toEqual([
      'aria-label',
      'class',
      'data-orientation',
      'role',
    ]);
    expect(element).toHaveAttribute('data-orientation', 'vertical');
    expect(exposed.group.element).toBe(element);
  });

  test('a tag in as replaces the div; the slot gives the state, also multiple', async () => {
    const { element, group } = await mountGroup({ as: 'section', multiple: true });
    expect(element.localName).toBe('section');
    expect(element.querySelector('.State')).toHaveTextContent('false true horizontal');
    group.multiple = false;
    await nextTick();
    expect(element.querySelector('.State')).toHaveTextContent('false false horizontal');
    expect(element).not.toHaveAttribute('data-multiple');
  });
});

describe('the value', () => {
  test('starts at defaultValue; a press gives [value], and a press on the pressed toggle gives []', async () => {
    const log: string[] = [];
    const { toggle, pressed } = await mountGroup(record(log, { defaultValue: ['b'] }));
    expect(pressed()).toBe('b');
    await userEvent.click(toggle('a'));
    expect(pressed()).toBe('a');
    await userEvent.click(toggle('a'));
    expect(pressed()).toBe('');
    expect(log).toEqual(['valueChange a', 'update a', 'valueChange ', 'update ']);
  });

  test('with multiple, a press adds the value at the end, and a press on a pressed toggle removes it', async () => {
    const log: string[] = [];
    const { toggle, pressed } = await mountGroup(
      record(log, { multiple: true, defaultValue: ['b'] }),
    );
    await userEvent.click(toggle('a'));
    await userEvent.click(toggle('c'));
    await userEvent.click(toggle('b'));
    expect(pressed()).toBe('ac');
    expect(log.filter((entry) => entry.startsWith('update'))).toEqual([
      'update b,a',
      'update b,a,c',
      'update a,c',
    ]);
  });

  test('a controlled group shows its prop: v-model follows a press, and with no write the group stays as it was', async () => {
    const bound = record([], { modelValue: ['a'] }, true);
    const { toggle, pressed } = await mountGroup(bound);
    await userEvent.click(toggle('b'));
    expect(bound.modelValue).toEqual(['b']);
    expect(pressed()).toBe('b');

    const refused = await mountGroup(record([], { modelValue: ['a'] }));
    await userEvent.click(refused.toggle('b'));
    await nextTick();
    expect(refused.pressed()).toBe('a');
  });

  test('VUE-114: reads a null value as an empty value, and stays controlled; a value that changes to null is empty, not the default value', async () => {
    const log: string[] = [];
    const group = record(log, { modelValue: null, defaultValue: ['a'] });
    const { toggle, pressed } = await mountGroup(group);
    expect(pressed()).toBe('');
    await userEvent.click(toggle('b'));
    await nextTick();
    expect(pressed()).toBe('');
    expect(log).toEqual(['valueChange b', 'update b']);
    group.modelValue = ['c'];
    await nextTick();
    expect(pressed()).toBe('c');
    group.modelValue = null;
    await nextTick();
    expect(pressed()).toBe('');
  });

  test('a modelValue that becomes undefined leaves the group uncontrolled with its value', async () => {
    const group = reactive<Record<string, unknown>>({ modelValue: ['b'] });
    const { toggle, pressed } = await mountGroup(group);
    group.modelValue = undefined;
    await nextTick();
    expect(pressed()).toBe('b');
    await userEvent.click(toggle('c'));
    expect(pressed()).toBe('c');
  });

  test.each([false, true])(
    'toggles with no value get their own values, so the user presses them one at a time (multiple: %s)',
    async (multiple) => {
      const log: string[] = [];
      const noValues = [
        { key: 'a', value: undefined },
        { key: 'b', value: '' },
        { key: 'c', value: '' },
      ];
      const { toggle, pressed } = await mountGroup(record(log, { multiple }), noValues);
      await userEvent.click(toggle('a'));
      await userEvent.click(toggle('b'));
      expect(pressed()).toBe(multiple ? 'ab' : 'b');
      expect(log).toHaveLength(4);
    },
  );

  test.each(['modelValue', 'defaultValue'])(
    'a toggle with no value in a group with %s gives one development message; with no value of the group, none',
    async (prop) => {
      await mountGroup({}, [{ key: 'a', value: undefined }]);
      await mountGroup({ [prop]: [] }, [{ key: 'b', value: undefined }]);
      await nextTick();
      expect(takeReportedMessages()).toEqual([
        'console.error: Vase UI: A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop. This will cause issues between the Toggle Group and Toggle values. Give `<Toggle>` a `value` of the same type as an item in the `<ToggleGroup>` model.',
      ]);
    },
  );

  test('a change of multiple keeps the value and the focus, and emits nothing', async () => {
    const log: string[] = [];
    const group = record(log, { multiple: true, defaultValue: ['a', 'c'] });
    const { toggle, pressed } = await mountGroup(group);
    toggle('c').focus();
    group.multiple = false;
    await nextTick();
    expect(pressed()).toBe('ac');
    expect(toggle('c')).toHaveFocus();
    expect(log).toEqual([]);
  });
});

describe('the events of a press', () => {
  test('come in the order pressedChange, valueChange, the update of the group, the update of the toggle, with one details object', async () => {
    const log: string[] = [];
    const seen: unknown[] = [];
    const list = items('a', 'b');
    list[0]!.attrs = {
      onPressedChange: (_: boolean, details: unknown) => {
        log.push('pressedChange');
        seen.push(details);
      },
      'onUpdate:modelValue': () => log.push('toggle update'),
    };
    const group = {
      onValueChange: (_: string[], details: unknown) => {
        log.push('valueChange');
        seen.push(details);
      },
      'onUpdate:modelValue': () => log.push('group update'),
    };
    const { toggle } = await mountGroup(group, list);
    toggle('a').focus();
    await userEvent.keyboard('{Enter}');
    expect(log).toEqual(['pressedChange', 'valueChange', 'group update', 'toggle update']);
    expect(seen[0]).toBe(seen[1]);
    await userEvent.keyboard(' ');
    expect(log).toHaveLength(8);
  });

  test.each([
    { name: 'pressedChange', on: 'toggle' },
    { name: 'valueChange', on: 'group' },
  ])(
    'details.cancel() in $name stops each later event, and the group keeps its value',
    async ({ on }) => {
      const log: string[] = [];
      const cancel = (_: unknown, details: { cancel(): void }) => details.cancel();
      const list = items('a', 'b');
      list[0]!.attrs = {
        ...(on === 'toggle' && { onPressedChange: cancel }),
        'onUpdate:modelValue': () => log.push('toggle update'),
      };
      const group = record(log, on === 'group' ? { onValueChange: cancel } : {});
      const { toggle, pressed } = await mountGroup(group, list);
      await userEvent.click(toggle('a'));
      expect(pressed()).toBe('');
      expect(log).toEqual([]);
    },
  );
});

describe('the keys', () => {
  test.each([
    { orientation: 'horizontal', dir: 'ltr', next: 'ArrowRight', previous: 'ArrowLeft' },
    { orientation: 'horizontal', dir: 'rtl', next: 'ArrowLeft', previous: 'ArrowRight' },
    { orientation: 'vertical', dir: 'ltr', next: 'ArrowDown', previous: 'ArrowUp' },
    { orientation: 'vertical', dir: 'rtl', next: 'ArrowDown', previous: 'ArrowUp' },
  ])(
    '$orientation, $dir: $next and $previous move the focus and loop, and press nothing',
    async ({ orientation, dir, next, previous }) => {
      document.documentElement.dir = dir;
      onTestFinished(() => document.documentElement.removeAttribute('dir'));
      const { toggle, pressed } = await mountGroup({ orientation });
      const steps: string[] = [];
      toggle('a').focus();
      for (const key of [next, next, next, previous]) {
        await userEvent.keyboard(`{${key}}`);
        steps.push(focused());
      }
      expect(steps).toEqual(['b', 'c', 'a', 'c']);
      expect(pressed()).toBe('');
    },
  );

  test('Home and End move the focus to the first and the last toggle; the keys of the other axis do nothing', async () => {
    const { toggle } = await mountGroup({});
    const steps: string[] = [];
    toggle('b').focus();
    for (const key of ['{End}', '{Home}', '{ArrowDown}', '{ArrowUp}']) {
      await userEvent.keyboard(key);
      steps.push(focused());
    }
    expect(steps).toEqual(['c', 'a', 'a', 'a']);
  });

  test('a handled key prevents its default, so the page does not scroll', async () => {
    const { toggle } = await mountGroup({});
    const prevented: string[] = [];
    const record = (event: KeyboardEvent) =>
      prevented.push(`${event.key} ${event.defaultPrevented}`);
    window.addEventListener('keydown', record);
    onTestFinished(() => window.removeEventListener('keydown', record));
    toggle('a').focus();
    await userEvent.keyboard('{ArrowRight}{End}{ArrowDown}');
    expect(prevented).toEqual(['ArrowRight true', 'End true', 'ArrowDown false']);
  });

  test('with loopFocus false, the arrow keys stop at the two ends', async () => {
    const { toggle } = await mountGroup({ loopFocus: false });
    toggle('c').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('c');
    toggle('a').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(focused()).toBe('a');
  });

  test('the arrow keys skip a disabled toggle and an element that is not a button with disabled', async () => {
    const list = items('a', 'b', 'c', 'd');
    list[1]!.attrs = { disabled: true };
    list[2]!.attrs = { disabled: true, as: 'span' };
    const { toggle } = await mountGroup({}, list);
    toggle('a').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('d');
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('a');
  });

  test('the arrow keys move on from a disabled toggle that has the focus', async () => {
    const list = items('a', 'b', 'c');
    list[1]!.attrs = { disabled: true, as: 'span' };
    const { toggle } = await mountGroup({}, list);
    toggle('b').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('c');
    toggle('b').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(focused()).toBe('a');
  });

  test.each(['Shift', 'Control', 'Alt', 'Meta'])(
    'with %s, an arrow key does nothing',
    async (modifier) => {
      const { toggle } = await mountGroup({});
      toggle('a').focus();
      await userEvent.keyboard(`{${modifier}>}{ArrowRight}{/${modifier}}`);
      expect(focused()).toBe('a');
    },
  );

  test('a key on another element of the group keeps its default and the focus', async () => {
    const { root } = mount(ToggleGroupParts, { items: items('a', 'b'), input: true });
    await nextTick();
    const prevented: boolean[] = [];
    const record = (event: KeyboardEvent) => prevented.push(event.defaultPrevented);
    window.addEventListener('keydown', record);
    onTestFinished(() => window.removeEventListener('keydown', record));
    root.querySelector<HTMLInputElement>('#inner')!.focus();
    await userEvent.keyboard('{ArrowLeft}{Home}');
    expect(prevented).toEqual([false, false]);
    expect(focused()).toBe('inner');
  });

  test('a keydown listener on a toggle that stops the propagation stops the keys of the group', async () => {
    const list = items('a', 'b');
    list[0]!.attrs = { onKeydown: (event: KeyboardEvent) => event.stopPropagation() };
    const { toggle } = await mountGroup({}, list);
    toggle('a').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('a');
  });
});

describe('the tab stop', () => {
  test('is the first enabled toggle after the mount: Tab from an input reaches it, and Tab from a toggle leaves the group', async () => {
    const list = items('a', 'b', 'c');
    list[0]!.attrs = { disabled: true };
    const { before, tabindexes } = await mountGroup({ defaultValue: ['c'] }, list);
    await nextTick();
    expect(tabindexes()).toEqual(['-1', '0', '-1']);
    before.focus();
    await userEvent.keyboard('{Tab}');
    expect(focused()).toBe('b');
    await userEvent.keyboard('{Tab}');
    expect(focused()).toBe('after');
  });

  test('is the toggle that had the focus last, also after a press of another toggle', async () => {
    const { toggle, after, tabindexes } = await mountGroup({});
    await nextTick();
    toggle('a').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tabindexes()).toEqual(['-1', '0', '-1']);
    await userEvent.keyboard('{Tab}');
    expect(focused()).toBe('after');
    after.focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(focused()).toBe('b');
  });

  test('VUE-113: moves to the first enabled toggle when it becomes disabled or unmounts, and Tab still reaches the group', async () => {
    const list = items('a', 'b', 'c');
    const { toggle, after, tabindexes, items: shown } = await mountGroup({}, list);
    toggle('a').focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{Tab}');
    expect(focused()).toBe('after');
    shown[1]!.attrs = { disabled: true };
    await nextTick();
    expect(tabindexes()).toEqual(['0', '-1', '-1']);
    after.focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(focused()).toBe('a');
    shown.splice(0, 1);
    await nextTick();
    expect(tabindexes()).toEqual(['-1', '0']);
  });

  test('moves to the first enabled toggle when the toggle that had the focus unmounts', async () => {
    const { toggle, tabindexes, items: shown } = await mountGroup({});
    toggle('a').focus();
    await userEvent.keyboard('{ArrowRight}');
    shown.splice(1, 1);
    await nextTick();
    expect(tabindexes()).toEqual(['0', '-1']);
  });

  test('a toggle that mounts later before the others gets the tab stop by its place in the document', async () => {
    const { tabindexes, items: shown } = await mountGroup({}, items('b', 'c'));
    shown.unshift({ key: 'a' });
    await nextTick();
    await nextTick();
    expect(tabindexes()).toEqual(['0', '-1', '-1']);
  });

  test('a disabled group has no tab stop and data-disabled, and Tab passes it; a disabled group wins over disabled false of a toggle', async () => {
    const list = items('a', 'b');
    list[0]!.attrs = { disabled: false };
    const { element, before, tabindexes, toggle } = await mountGroup({ disabled: true }, list);
    await nextTick();
    expect(element).toHaveAttribute('data-disabled', '');
    expect(element.querySelector('.State')).toHaveTextContent('true false horizontal');
    expect(tabindexes()).toEqual([null, null]);
    expect(toggle('a').matches(':disabled')).toBe(true);
    expect(toggle('a')).not.toHaveAttribute('aria-disabled');
    before.focus();
    await userEvent.keyboard('{Tab}');
    expect(focused()).toBe('after');
  });
});

describe.each(['fieldset', 'root'] as const)('VUE-112: a disabled fieldset (%s)', (kind) => {
  test('the state and data-disabled of a group follow it, and the group in the first legend stays enabled; a <span> toggle stays enabled', async () => {
    const scene = reactive({ kind, disabled: false });
    const { root } = mount(TogglesInFieldset, { scene });
    const find = (name: string) => root.querySelector<HTMLElement>(`.${name}`)!;
    await settle();
    expect(find('Group')).not.toHaveAttribute('data-disabled');
    scene.disabled = true;
    await waitFor(() => expect(find('Group')).toHaveAttribute('data-disabled', ''));
    expect(find('Group').querySelector('.State')).toHaveTextContent('true');
    expect(find('GroupNative').matches(':disabled')).toBe(true);
    expect(find('GroupCustom')).not.toHaveAttribute('aria-disabled');
    expect(find('GroupCustom')).toHaveAttribute('tabindex', '0');
    expect(find('GroupInLegend')).not.toHaveAttribute('data-disabled');
    expect(find('GroupInLegend').querySelector('.State')).toHaveTextContent('false');
  });
});

describe('in a toolbar', () => {
  async function mountInToolbar(scene: Record<string, unknown> = {}) {
    const { root } = mount(ToggleGroupInToolbar, { scene: reactive(scene) });
    await settle();
    return {
      root,
      group: root.querySelector<HTMLElement>('[role=group]')!,
      element: (id: string) => root.querySelector<HTMLElement>(`#${id}`)!,
    };
  }

  test('the toolbar holds the one tab stop and the keys, with its orientation; the group keeps its value', async () => {
    const { element } = await mountInToolbar({ orientation: 'vertical' });
    element('before').focus();
    await userEvent.keyboard('{Tab}');
    expect(focused()).toBe('first');
    const steps: string[] = [];
    for (const key of ['{ArrowDown}', '{ArrowDown}', '{ArrowRight}', '{ArrowDown}']) {
      await userEvent.keyboard(key);
      steps.push(focused());
    }
    expect(steps).toEqual(['one', 'two', 'two', 'alone']);
    await userEvent.keyboard('{Tab}');
    expect(focused()).toBe('after');
    expect(element('one')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the arrow keys of the toolbar skip a disabled toggle that is not a button', async () => {
    const { element } = await mountInToolbar({ disabledSpan: true });
    element('first').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('two');
    await userEvent.keyboard('{ArrowLeft}');
    expect(focused()).toBe('first');
  });

  test.each([
    { name: 'a disabled toolbar', scene: { disabled: true } },
    { name: 'a disabled Toolbar.Group', scene: { groupDisabled: true } },
  ])('$name disables the group and its toggles', async ({ scene }) => {
    const { group, element } = await mountInToolbar(scene);
    expect(group).toHaveAttribute('data-disabled', '');
    expect(group.querySelector('.State')).toHaveTextContent('true');
    expect(element('one').matches(':disabled')).toBe(true);
  });

  test('a disabled Toolbar.Button that renders a Toggle keeps the focus with aria-disabled; with focusableWhenDisabled false, it has disabled', async () => {
    const { element } = await mountInToolbar({ buttonDisabled: true });
    expect(element('alone')).toHaveAttribute('aria-disabled', 'true');
    expect(element('alone').matches(':disabled')).toBe(false);
    element('alone').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await userEvent.click(element('alone'), { force: true });
    expect(element('alone')).toHaveAttribute('aria-pressed', 'false');

    const kept = await mountInToolbar({ buttonDisabled: true, focusableWhenDisabled: false });
    expect(kept.element('alone').matches(':disabled')).toBe(true);
  });
});
