import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  AccordionItemChangeEventDetails,
  AccordionRootChangeEventDetails,
} from '@vase-ui/vue/accordion';
import { expectNoAxeViolations } from '../../test/axe';
import { dataAttributes } from '../../test/field';
import AccordionElements from '../../test/fixtures/AccordionElements.vue';
import AccordionPartOutside from '../../test/fixtures/AccordionPartOutside.vue';
import AccordionParts from '../../test/fixtures/AccordionParts.vue';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

afterEach(() => {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
});

type Item = {
  key: string;
  value?: unknown;
  attrs?: Record<string, unknown>;
  header?: Record<string, unknown>;
  trigger?: Record<string, unknown> | false;
  panel?: Record<string, unknown> | false;
};

const items = (...keys: string[]): Item[] => keys.map((key) => ({ key }));

interface Setup {
  root?: Record<string, unknown>;
  items: Item[];
  panelsFirst?: boolean;
  transition?: string;
}

async function mountAccordion(setup: Setup) {
  const log: string[] = [];
  const { root, exposed } = mount(AccordionParts, {
    ...setup,
    log: { add: (entry: string) => log.push(entry) },
  });
  await nextTick();
  const part = (role: string, key: string) =>
    root.querySelector<HTMLElement>(`${role}[data-key="${key}"]`);
  return {
    root,
    exposed,
    log,
    item: (key: string) => part('div:not([role])', key)!,
    header: (key: string) => part('h3', key)!,
    trigger: (key: string) => part('[aria-expanded]', key)!,
    panel: (key: string) => part('[role=region]', key),
    open: () =>
      [...root.querySelectorAll('[aria-expanded=true]')].map((trigger) =>
        trigger.getAttribute('data-key'),
      ),
    press: async (key: string) => {
      part('[aria-expanded]', key)!.click();
      await nextTick();
    },
  };
}

/** Props of a root and items that write each event in `log`. */
function events(log: string[], root: Record<string, unknown> = {}) {
  const rootProps = reactive<Record<string, unknown>>({
    ...root,
    onValueChange: (value: unknown[], details: AccordionRootChangeEventDetails) =>
      log.push(`valueChange ${JSON.stringify(value)} ${details.reason} ${details.event.type}`),
    'onUpdate:modelValue': (value: unknown[]) => log.push(`update ${JSON.stringify(value)}`),
  });
  const itemAttrs = (key: string) => ({
    onOpenChange: (open: boolean, details: AccordionItemChangeEventDetails) =>
      log.push(`openChange ${key} ${open} ${details.reason}`),
  });
  return { root: rootProps, itemAttrs };
}

describe('the elements', () => {
  test('render a div, items, an h3, a button with type="button" and a region; the panel and the trigger name each other; the attributes of the developer win', async () => {
    const { exposed, item, header, trigger, panel, press } = await mountAccordion({
      root: { class: 'Root' },
      items: [{ key: 'a', trigger: { type: 'submit' } }, { key: 'b' }],
    });
    const element = exposed.root.element as HTMLElement;
    expect(element.tagName).toBe('DIV');
    expect(element).toHaveClass('Root');
    expect(item('a').tagName).toBe('DIV');
    expect(header('a').tagName).toBe('H3');
    expect(trigger('a').tagName).toBe('BUTTON');
    expect(trigger('a')).toHaveAttribute('type', 'submit');
    expect(trigger('b')).toHaveAttribute('type', 'button');
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'false');
    expect(trigger('a')).not.toHaveAttribute('aria-controls');
    expect(panel('a')).toBeNull();
    await press('a');
    expect(trigger('a')).toHaveAttribute('aria-expanded', 'true');
    expect(trigger('a')).toHaveAttribute('aria-controls', panel('a')!.id);
    expect(panel('a')).toHaveAttribute('aria-labelledby', trigger('a').id);
    expect(dataAttributes(element)).toEqual([]);
    expect(dataAttributes(item('a'))).toEqual(['data-key', 'data-open']);
    expect(dataAttributes(header('a'))).toEqual(['data-key', 'data-open']);
    expect(dataAttributes(trigger('a'))).toEqual(['data-key']);
    expect(dataAttributes(panel('a')!)).toEqual(['data-key']);
    expect(dataAttributes(item('b'))).toEqual(['data-key']);
  });

  test('render the tag of `as`, such as an h2 for the header', async () => {
    const { root } = await mountAccordion({
      root: { as: 'section', defaultValue: ['a'] },
      items: [
        {
          key: 'a',
          attrs: { as: 'article' },
          header: { as: 'h2' },
          trigger: { as: 'span' },
          panel: { as: 'aside' },
        },
      ],
    });
    expect(root.querySelector('section > article > h2 > span[role=button]')).not.toBeNull();
    expect(root.querySelector('article > aside[role=region]')).not.toBeNull();
  });

  test('render the element of the `element` slot with the props, the ref and the state', async () => {
    const { root, exposed } = mount(AccordionElements);
    await nextTick();
    const span = root.querySelector('span')!;
    const state = '{"value":["a"],"open":true,"disabled":false}';
    expect(exposed.root.element.tagName).toBe('SECTION');
    expect(exposed.root.element).toHaveAttribute('data-state', '{"value":["a"],"disabled":false}');
    for (const [part, tag] of [
      ['item', 'ARTICLE'],
      ['header', 'H4'],
      ['trigger', 'SPAN'],
      ['panel', 'ASIDE'],
    ] as const) {
      expect(exposed[part].element.tagName).toBe(tag);
      expect(exposed[part].element).toHaveAttribute('data-state', state);
    }
    expect(span).toHaveAttribute('role', 'button');
    expect(span).toHaveAttribute('aria-controls', exposed.panel.element.id);
    expect(exposed.panel.element).toHaveAttribute('aria-labelledby', span.id);
  });
});

describe('the value', () => {
  test('a press of an item emits its openChange, then valueChange and update:modelValue of the root; one item is open at a time', async () => {
    const log: string[] = [];
    const { root, itemAttrs } = events(log);
    const { press, open } = await mountAccordion({
      root,
      items: ['a', 'b'].map((key) => ({ key, attrs: itemAttrs(key) })),
    });
    await press('a');
    await press('b');
    expect(open()).toEqual(['b']);
    await press('b');
    expect(open()).toEqual([]);
    expect(log).toEqual([
      'openChange a true trigger-press',
      'valueChange ["a"] trigger-press click',
      'update ["a"]',
      'openChange b true trigger-press',
      'valueChange ["b"] trigger-press click',
      'update ["b"]',
      'openChange b false trigger-press',
      'valueChange [] trigger-press click',
      'update []',
    ]);
  });

  test('with multiple, an open adds the value and a close removes it; an array value stays whole', async () => {
    const values: unknown[] = [];
    const { press, open } = await mountAccordion({
      root: { multiple: true, onValueChange: (value: unknown) => values.push(value) },
      items: [{ key: 'a', value: ['x', 'y'] }, { key: 'b' }],
    });
    await press('a');
    await press('b');
    expect(open()).toEqual(['a', 'b']);
    await press('a');
    expect(open()).toEqual(['b']);
    expect(values).toEqual([[['x', 'y']], [['x', 'y'], 'b'], ['b']]);
  });

  test('with multiple, the value lists the items in the order of the presses', async () => {
    const values: unknown[] = [];
    const { press } = await mountAccordion({
      root: { multiple: true, onValueChange: (value: unknown) => values.push(value) },
      items: items('a', 'b'),
    });
    await press('b');
    await press('a');
    expect(values).toEqual([['b'], ['b', 'a']]);
  });

  test('an item with no value has a generated value; defaultValue opens the items of its values', async () => {
    const values: unknown[][] = [];
    const { press, open } = await mountAccordion({
      root: { defaultValue: [2], onValueChange: (value: unknown[]) => values.push(value) },
      items: [
        { key: 'one', value: 1 },
        { key: 'two', value: 2 },
        { key: 'none', value: undefined },
      ],
    });
    expect(open()).toEqual(['two']);
    await press('none');
    expect(open()).toEqual(['none']);
    expect(values[0]).toEqual([expect.any(String)]);
  });

  test('details.cancel() in openChange stops the root, and in valueChange stops update:modelValue', async () => {
    for (const where of ['item', 'root']) {
      const log: string[] = [];
      const { root, itemAttrs } = events(log, { multiple: true });
      const attrs: Record<string, unknown> = itemAttrs('a');
      const cancel = (details: { cancel(): void }) => details.cancel();
      if (where === 'item') attrs.onOpenChange = (_: boolean, details: never) => cancel(details);
      else root.onValueChange = (_: unknown, details: never) => cancel(details);
      const { press, open } = await mountAccordion({ root, items: [{ key: 'a', attrs }] });
      await press('a');
      expect(open()).toEqual([]);
      expect(log).toEqual(where === 'item' ? [] : ['openChange a true trigger-press']);
    }
  });

  test.each([
    {
      name: 'a close, without multiple',
      where: 'root',
      root: { defaultValue: ['a'] },
      open: ['a'],
    },
    {
      name: 'a close, with multiple',
      where: 'root',
      root: { defaultValue: ['a'], multiple: true },
      open: ['a'],
    },
    { name: 'an open, without multiple', where: 'root', root: {}, open: [] },
    { name: 'an open of a controlled root', where: 'root', root: { modelValue: [] }, open: [] },
    { name: 'an open of a controlled root', where: 'item', root: { modelValue: [] }, open: [] },
  ])('details.cancel() in the $where keeps the items as they are: $name', async (setup) => {
    const log: string[] = [];
    const { root, itemAttrs } = events(log, setup.root);
    root['onUpdate:modelValue'] = (value: unknown[]) => {
      log.push(`update ${JSON.stringify(value)}`);
      root.modelValue = value;
    };
    const attrs: Record<string, unknown> = itemAttrs('a');
    const cancel = (details: { cancel(): void }) => details.cancel();
    if (setup.where === 'item') {
      attrs.onOpenChange = (_: boolean, details: never) => cancel(details);
    } else {
      root.onValueChange = (value: unknown[], details: never) => {
        log.push(`valueChange ${JSON.stringify(value)}`);
        cancel(details);
      };
    }
    const { press, open, panel } = await mountAccordion({ root, items: [{ key: 'a', attrs }] });
    await press('a');
    expect(open()).toEqual(setup.open);
    expect(panel('a') !== null).toBe(setup.open.length > 0);
    const next = JSON.stringify(setup.open.length ? [] : ['a']);
    expect(log).toEqual(
      setup.where === 'item'
        ? []
        : [`openChange a ${!setup.open.length} trigger-press`, `valueChange ${next}`],
    );
  });

  test('v-model: a controlled root shows the value of its parent, and a change of the parent emits nothing', async () => {
    const log: string[] = [];
    let write = false;
    const { root } = events(log, { modelValue: [] });
    root['onUpdate:modelValue'] = (value: unknown[]) => {
      log.push(`update ${JSON.stringify(value)}`);
      if (write) root.modelValue = value;
    };
    const { press, open } = await mountAccordion({ root, items: items('a', 'b') });
    await press('a');
    expect(open()).toEqual([]);
    write = true;
    await press('a');
    expect(open()).toEqual(['a']);
    root.modelValue = ['b'];
    await nextTick();
    expect(open()).toEqual(['b']);
    expect(log).toEqual([
      'valueChange ["a"] trigger-press click',
      'update ["a"]',
      'valueChange ["a"] trigger-press click',
      'update ["a"]',
    ]);
  });

  test('VUE-114: a null modelValue is an empty value, and the root stays controlled; a null defaultValue is no value', async () => {
    const root = reactive<Record<string, unknown>>({ modelValue: ['a'] });
    const { press, open } = await mountAccordion({ root, items: items('a') });
    root.modelValue = null;
    await nextTick();
    expect(open()).toEqual([]);
    await press('a');
    expect(open()).toEqual([]);
    const uncontrolled = await mountAccordion({ root: { defaultValue: null }, items: items('c') });
    await uncontrolled.press('c');
    expect(uncontrolled.open()).toEqual(['c']);
  });
});

describe('disabled', () => {
  test('a disabled root disables each trigger, and a disabled item its own; the parts say it', async () => {
    const log: string[] = [];
    const { root, itemAttrs } = events(log, { disabled: true });
    const disabledRoot = await mountAccordion({
      root,
      items: [{ key: 'a', attrs: itemAttrs('a') }],
    });
    expect(disabledRoot.trigger('a')).toBeDisabled();
    expect(disabledRoot.trigger('a')).toHaveTextContent('a disabled');
    expect(dataAttributes(disabledRoot.exposed.root.element)).toEqual(['data-disabled']);
    await userEvent.click(disabledRoot.trigger('a'), { force: true });
    expect(log).toEqual([]);

    const {
      root: element,
      trigger,
      item,
      header,
      press,
      open,
    } = await mountAccordion({
      root: { keepMounted: true },
      items: [
        { key: 'a', attrs: { disabled: true } },
        { key: 'b', trigger: { disabled: true } },
      ],
    });
    expect(trigger('a')).toBeDisabled();
    expect(trigger('a')).not.toHaveAttribute('aria-disabled');
    for (const element of [item('a'), header('a')]) {
      expect(element).toHaveAttribute('data-disabled');
    }
    expect(element.querySelector('[role=region][data-key=a]')).toHaveAttribute('data-disabled');
    expect(item('b')).not.toHaveAttribute('data-disabled');
    expect(trigger('b')).toBeDisabled();
    await press('a');
    await press('b');
    expect(open()).toEqual([]);
  });

  test('a disabled root gives data-disabled to each item, header and panel', async () => {
    const { item, header, panel } = await mountAccordion({
      root: { disabled: true, defaultValue: ['a'], keepMounted: true },
      items: items('a', 'b'),
    });
    for (const key of ['a', 'b']) {
      for (const element of [item(key), header(key), panel(key)!]) {
        expect(element).toHaveAttribute('data-disabled');
      }
    }
  });

  test('a disabled trigger that is not a button has aria-disabled and tabindex -1, and Tab passes it', async () => {
    const { root, trigger } = await mountAccordion({
      items: [{ key: 'a', attrs: { disabled: true }, trigger: { as: 'span' } }],
    });
    expect(trigger('a')).toHaveAttribute('role', 'button');
    expect(trigger('a')).toHaveAttribute('aria-disabled', 'true');
    expect(trigger('a')).toHaveAttribute('tabindex', '-1');
    expect(trigger('a')).not.toHaveAttribute('disabled');
    root.querySelector<HTMLElement>('[aria-label=Before]')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(root.querySelector('[aria-label=After]'));
  });

  test.each([
    { name: 'a button', trigger: {} },
    { name: 'a span', trigger: { as: 'span' } },
  ])(
    'Tab reaches a trigger that is $name; Enter opens and closes it, and Space at its keyup',
    async ({ trigger: triggerAttrs }) => {
      const log: string[] = [];
      const { itemAttrs } = events(log);
      const { root, trigger, open } = await mountAccordion({
        items: [{ key: 'a', attrs: itemAttrs('a'), trigger: triggerAttrs }],
      });
      root.querySelector<HTMLElement>('[aria-label=Before]')!.focus();
      await userEvent.keyboard('{Tab}');
      expect(document.activeElement).toBe(trigger('a'));
      expect(trigger('a').getAttribute('tabindex')).toBe(triggerAttrs.as ? '0' : null);
      const states: unknown[] = [];
      for (const key of ['{Enter}', '{Enter}', '{ >}', '{/ }', '{ >}', '{/ }']) {
        await userEvent.keyboard(key);
        await nextTick();
        states.push(open());
      }
      expect(states).toEqual([['a'], [], [], ['a'], ['a'], []]);
      expect(log).toEqual([
        'openChange a true trigger-press',
        'openChange a false trigger-press',
        'openChange a true trigger-press',
        'openChange a false trigger-press',
      ]);
    },
  );

  test('Space on a trigger that is not a button opens the item at keyup', async () => {
    const { trigger, open } = await mountAccordion({
      items: [{ key: 'a', trigger: { as: 'span' } }],
    });
    trigger('a').focus();
    await userEvent.keyboard('{ >}');
    expect(open()).toEqual([]);
    await userEvent.keyboard('{/ }');
    await nextTick();
    expect(open()).toEqual(['a']);
  });
});

describe('ids and ARIA', () => {
  test('VUE-18, VUE-93: the id props name the parts in both directions; an empty id counts as none', async () => {
    const trigger = reactive<Record<string, unknown>>({ id: 'trigger-a' });
    const panel = reactive<Record<string, unknown>>({ id: 'panel-a' });
    const accordion = await mountAccordion({
      root: { defaultValue: ['a'] },
      items: [{ key: 'a', trigger, panel }],
    });
    expect(accordion.trigger('a')).toHaveAttribute('aria-controls', 'panel-a');
    expect(accordion.panel('a')).toHaveAttribute('aria-labelledby', 'trigger-a');
    trigger.id = '';
    panel.id = '';
    await nextTick();
    expect(accordion.trigger('a').id).not.toBe('');
    expect(accordion.panel('a')!.id).not.toBe('');
    expect(accordion.trigger('a')).toHaveAttribute('aria-controls', accordion.panel('a')!.id);
    expect(accordion.panel('a')).toHaveAttribute('aria-labelledby', accordion.trigger('a').id);
  });

  test('a new id of the trigger goes to aria-labelledby, and an id that the developer removes gives the generated one', async () => {
    const trigger = reactive<Record<string, unknown>>({});
    const accordion = await mountAccordion({
      root: { defaultValue: ['a'] },
      items: [{ key: 'a', trigger }],
    });
    const generated = accordion.trigger('a').id;
    expect(accordion.panel('a')).toHaveAttribute('aria-labelledby', generated);
    for (const id of ['trigger-1', 'trigger-2']) {
      trigger.id = id;
      await nextTick();
      expect(accordion.trigger('a')).toHaveAttribute('id', id);
      expect(accordion.panel('a')).toHaveAttribute('aria-labelledby', id);
    }
    trigger.id = undefined;
    await nextTick();
    expect(accordion.trigger('a').id).toBe(generated);
    expect(accordion.panel('a')).toHaveAttribute('aria-labelledby', generated);
  });

  test('VUE-80: an open trigger has no aria-controls while its panel is unmounted, and names the panel that mounts again', async () => {
    const shown = reactive<Item[]>([{ key: 'a' }]);
    const accordion = await mountAccordion({ root: { defaultValue: ['a'] }, items: shown });
    shown[0]!.panel = false;
    await nextTick();
    expect(accordion.trigger('a')).toHaveAttribute('aria-expanded', 'true');
    expect(accordion.trigger('a')).not.toHaveAttribute('aria-controls');
    shown[0]!.panel = {};
    await nextTick();
    expect(accordion.trigger('a')).toHaveAttribute('aria-controls', accordion.panel('a')!.id);
    expect(accordion.panel('a')).toHaveAttribute('aria-labelledby', accordion.trigger('a').id);
  });

  test('VUE-80: with no trigger, the panel has no aria-labelledby, and names the trigger that mounts again; a role of the developer wins', async () => {
    const shown = reactive<Item[]>([{ key: 'a', panel: { role: 'group', class: 'Group' } }]);
    const accordion = await mountAccordion({ root: { defaultValue: ['a'] }, items: shown });
    const element = accordion.root.querySelector('.Group')!;
    expect(element).toHaveAttribute('role', 'group');
    expect(element).toHaveAttribute('aria-labelledby', accordion.trigger('a').id);
    shown[0]!.trigger = false;
    await nextTick();
    expect(element).not.toHaveAttribute('aria-labelledby');
    shown[0]!.trigger = {};
    await nextTick();
    expect(element).toHaveAttribute('aria-labelledby', accordion.trigger('a').id);
  });
});

describe('the panels', () => {
  test('the root gives keepMounted and hiddenUntilFound to each panel; the prop of a panel wins', async () => {
    const { root } = await mountAccordion({
      root: { keepMounted: true },
      items: [{ key: 'a' }, { key: 'b', panel: { keepMounted: false } }],
    });
    expect(root.querySelector('[data-key=a][role=region]')).toHaveAttribute('hidden', '');
    expect(root.querySelector('[data-key=a][role=region]')).toHaveAttribute('inert');
    expect(root.querySelector('[data-key=b][role=region]')).toBeNull();
    const found = await mountAccordion({
      root: { hiddenUntilFound: true },
      items: [{ key: 'c' }, { key: 'd', panel: { hiddenUntilFound: false } }],
    });
    expect(found.panel('c')).toHaveAttribute('hidden', 'until-found');
    expect(found.panel('c')).not.toHaveAttribute('inert');
    expect(found.panel('d')).toBeNull();
  });

  test('VUE-197: hiddenUntilFound of the root or of a panel keeps a closed panel with hidden="until-found", also with keepMounted of false', async () => {
    const fromRoot = await mountAccordion({
      root: { hiddenUntilFound: true, keepMounted: false },
      items: [{ key: 'a' }, { key: 'b', panel: { keepMounted: false } }],
    });
    expect(fromRoot.panel('a')).toHaveAttribute('hidden', 'until-found');
    expect(fromRoot.panel('b')).toHaveAttribute('hidden', 'until-found');
    const fromPanel = await mountAccordion({
      items: [{ key: 'c', panel: { hiddenUntilFound: true, keepMounted: false } }],
    });
    expect(fromPanel.panel('c')).toHaveAttribute('hidden', 'until-found');
  });
});

describe('the size of the content', () => {
  test('an open writes it in --accordion-panel-height and --accordion-panel-width', async () => {
    const { panel, press } = await mountAccordion({ items: items('a') });
    await press('a');
    await waitFor(() =>
      expect(panel('a')!.style.getPropertyValue('--accordion-panel-height')).toMatch(/^\d+px$/),
    );
    expect(panel('a')!.style.getPropertyValue('--accordion-panel-width')).toMatch(/^\d+px$/);
  });
});

describe('animation', () => {
  test('in a <Transition>, the panel of one item leaves while the panel of the other enters', async () => {
    const { press, log } = await mountAccordion({
      root: { defaultValue: ['a'] },
      items: items('a', 'b'),
      transition: 'accordion-fade',
    });
    await press('b');
    expect(log).toEqual(['leave a', 'enter b']);
    await waitFor(() =>
      expect(log).toEqual(['leave a', 'enter b', 'after-leave a', 'after-enter b']),
    );
  });
});

describe('find-in-page', () => {
  test('a fragment navigation opens the item, with the openChange of the item and the valueChange of the root', async () => {
    const log: string[] = [];
    const { root, itemAttrs } = events(log, { hiddenUntilFound: true, disabled: true });
    const { panel, open } = await mountAccordion({
      root,
      items: ['a', 'b'].map((key) => ({ key, attrs: itemAttrs(key) })),
    });
    location.hash = 'b-target';
    await waitFor(() => expect(open()).toEqual(['b']));
    expect(panel('b')).not.toHaveAttribute('hidden');
    expect(log).toEqual([
      'openChange b true none',
      'valueChange ["b"] none beforematch',
      'update ["b"]',
    ]);
  });

  test('an open that the item or the root cancels gets hidden="until-found" back', async () => {
    for (const where of ['item', 'root']) {
      const cancel = (_: unknown, details: { cancel(): void }) => details.cancel();
      const accordion = await mountAccordion({
        root: { hiddenUntilFound: true, ...(where === 'root' && { onValueChange: cancel }) },
        items: [{ key: 'a', attrs: where === 'item' ? { onOpenChange: cancel } : {} }],
      });
      location.hash = 'a-target';
      await waitFor(() => expect(location.hash).toBe('#a-target'));
      await settle();
      await waitFor(() => expect(accordion.panel('a')).toHaveAttribute('hidden', 'until-found'));
      expect(accordion.open()).toEqual([]);
      history.replaceState(null, '', location.pathname + location.search);
      accordion.root.remove();
    }
  });
});

describe('accessibility', () => {
  test('has no axe violation', async () => {
    const { root, press } = await mountAccordion({
      root: { keepMounted: true },
      items: items('a', 'b'),
    });
    await expectNoAxeViolations(root);
    await press('a');
    await expectNoAxeViolations(root);
  });
});

// The cases throw in `setup`, so they are the last of the file.
describe('the errors', () => {
  test.each([
    {
      part: 'item',
      message:
        'Vase UI: <Accordion.Item> must be inside <Accordion.Root>. Without a root the item has no value to read. Put the item inside <Accordion.Root>.',
    },
    ...['header', 'trigger', 'panel'].map((part) => ({
      part,
      message:
        'Vase UI: A part of Accordion must be inside <Accordion.Item>. Without an item the part has no open state to read. Put the part inside <Accordion.Item>.',
    })),
  ])('a $part outside its parent throws an error that says so', ({ part, message }) => {
    expect((mountError(AccordionPartOutside, { part }) as Error).message).toBe(message);
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
