import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import SliderParts from '../../test/fixtures/SliderParts.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('VUE-29: the server HTML has each thumb of a range with no index at its value, the inputs, the text and the label; the root and an input before the label get their name at the mount', async () => {
    const props = {
      root: { defaultValue: [20, 60], name: 'volume' },
      thumbs: [{}, {}],
      label: 'after',
      value: 'before',
    };
    const root = await renderOnServer('SliderParts', props);
    const group = root.querySelector('[role=group]')!;
    const inputs = [...root.querySelectorAll<HTMLInputElement>('input[type=range]')];
    const label = root.querySelector('[role=group] label')!;
    const output = root.querySelector('output')!;
    const indicator = root.querySelector<HTMLElement>('[style*="inherit"]')!;
    expect(group).toHaveAttribute('data-orientation', 'horizontal');
    expect(inputs.map((input) => [input.getAttribute('value'), input.name])).toEqual([
      ['20', 'volume'],
      ['60', 'volume'],
    ]);
    expect(inputs.map((input) => input.parentElement!.style.insetInlineStart)).toEqual([
      '20%',
      '60%',
    ]);
    expect([indicator.style.insetInlineStart, indicator.style.width]).toEqual(['20%', '40%']);
    expect(output).toHaveTextContent('20 – 60');
    expect(label).toHaveAttribute('for', inputs[0]!.id);
    expect(group).not.toHaveAttribute('aria-labelledby');
    expect(output).not.toHaveAttribute('for');
    for (const input of inputs) expect(input).not.toHaveAttribute('aria-labelledby');

    hydrate(SliderParts, props, root);
    await nextTick();
    expect(root.querySelector('input[type=range]')).toBe(inputs[0]);
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(output).toHaveAttribute('for', inputs.map((input) => input.id).join(' '));
    for (const input of inputs) expect(input).toHaveAttribute('aria-labelledby', label.id);
  });

  test('VUE-29: an input after the label has its aria-labelledby in the server HTML; an edge thumb is in the control', async () => {
    const props = {
      root: { defaultValue: 100, thumbAlignment: 'edge' },
      label: 'before',
    };
    const root = await renderOnServer('SliderParts', props);
    const input = root.querySelector('input[type=range]')!;
    const label = root.querySelector('[role=group] label')!;
    expect(input).toHaveAttribute('aria-labelledby', label.id);
    expect(label).toHaveAttribute('for', input.id);
    const control = root.querySelector('[style*="touch-action"]')!.getBoundingClientRect();
    const thumb = input.parentElement!.getBoundingClientRect();
    expect(thumb.right).toBe(control.right);
  });

  test('dir="rtl" on the root places the thumbs in the server HTML; the label of a field names the input of the first thumb', async () => {
    const props = { root: { defaultValue: [20, 60], dir: 'rtl' }, thumbs: [{}, {}], field: {} };
    const root = await renderOnServer('SliderParts', props);
    const inputs = [...root.querySelectorAll<HTMLInputElement>('input[type=range]')];
    expect(inputs.map((input) => input.parentElement!.style.translate)).toEqual([
      '50% -50%',
      '50% -50%',
    ]);
    expect(root.querySelector('label')).toHaveAttribute('for', inputs[0]!.id);
    hydrate(SliderParts, props, root);
    await nextTick();
    expect(inputs[0]!.parentElement!.style.translate).toBe('50% -50%');
  });

  test('a thumb with no value has no place in the server HTML', async () => {
    const root = await renderOnServer('SliderParts', {
      root: { defaultValue: [20] },
      thumbs: [{}, {}],
    });
    const [, extra] = root.querySelectorAll('input[type=range]');
    expect(extra!.parentElement!.getAttribute('style')).not.toContain('NaN');
  });

  test.each([
    { name: 'a single slider', props: { root: { defaultValue: 30 }, label: 'before' } },
    {
      name: 'a range with index',
      props: { root: { defaultValue: [20, 60] }, thumbs: [{ index: 1 }, { index: 0 }] },
    },
    {
      name: 'a vertical slider',
      props: { root: { defaultValue: 30, orientation: 'vertical' }, value: 'after' },
    },
    {
      name: 'thumbAlignment edge',
      props: { root: { defaultValue: [10, 90], thumbAlignment: 'edge' }, thumbs: [{}, {}] },
    },
    { name: 'dir rtl', props: { root: { defaultValue: 30, dir: 'rtl' }, label: 'after' } },
    {
      name: 'a slider in a field',
      props: { root: { defaultValue: [20, 60] }, thumbs: [{}, {}], field: {} },
    },
  ])('$name hydrates with no message, and keeps its elements', async ({ props }) => {
    const root = await renderOnServer('SliderParts', props);
    const inputs = [...root.querySelectorAll('input[type=range]')];
    hydrate(SliderParts, props, root);
    await nextTick();
    expect([...root.querySelectorAll('input[type=range]')]).toEqual(inputs);
  });
});
