import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { SliderRootChangeEventDetails, SliderRootCommitEventDetails } from '@vase-ui/vue/slider';
import { dataAttributes } from '../../test/field';
import SliderInToolbar from '../../test/fixtures/SliderInToolbar.vue';
import SliderPartAlone from '../../test/fixtures/SliderPartAlone.vue';
import SliderParts from '../../test/fixtures/SliderParts.vue';
import SliderSlots from '../../test/fixtures/SliderSlots.vue';
import { takeReportedMessages } from '../../test/reportedMessages';
import { mount, mountError, settle } from '../../test/render';

type Attrs = Record<string, unknown>;

async function mountSlider(props: {
  root?: Attrs;
  thumbs?: Attrs[];
  label?: 'before' | 'after';
  labelAttrs?: Attrs;
  value?: 'before' | 'after';
  field?: Attrs;
  fieldset?: { native: boolean; disabled: boolean };
}) {
  const { root, exposed } = mount(SliderParts, props);
  await nextTick();
  const inputs = () => [...root.querySelectorAll<HTMLInputElement>('input[type=range]')];
  return {
    root,
    exposed,
    group: root.querySelector<HTMLElement>('[role=group]')!,
    inputs,
    input: (index = 0) => inputs()[index]!,
    thumb: (index = 0) => inputs()[index]!.parentElement!,
    values: () => inputs().map((input) => input.valueAsNumber),
    output: () => root.querySelector('output')!,
    label: () => root.querySelector<HTMLLabelElement>('[role=group] label')!,
    focused: () => document.activeElement as HTMLElement,
  };
}

/** Props of `Slider.Root` with `v-model`, which write each event in `log`. */
function sliderModel(log: string[], modelValue: unknown, write = true) {
  const root = reactive<Attrs>({
    modelValue,
    onValueChange: (value: unknown, details: SliderRootChangeEventDetails) =>
      log.push(`change ${String(value)} ${details.reason} ${details.activeThumbIndex}`),
    onValueCommitted: (value: unknown, details: SliderRootCommitEventDetails) =>
      log.push(`commit ${String(value)} ${details.reason}`),
  });
  root['onUpdate:modelValue'] = (value: unknown) => {
    log.push(`update ${String(value)}`);
    if (write) root.modelValue = value;
  };
  return root;
}

async function press(input: HTMLInputElement, keys: string) {
  input.focus();
  await userEvent.keyboard(keys);
  await nextTick();
}

describe('the parts', () => {
  test('render their elements with the state attributes; the thumb holds a range input; a template ref has the element', async () => {
    const { root, exposed, group, input, thumb } = await mountSlider({
      root: { defaultValue: 30 },
      label: 'before',
      value: 'after',
    });
    expect(group.tagName).toBe('DIV');
    expect(exposed.root.element).toBe(group);
    expect(exposed.control.element).toBe(group.querySelector('[style*="touch-action"]'));
    expect(exposed.thumbs[0].element).toBe(thumb());
    expect(exposed.thumbs[0].input).toBe(input());
    expect(root.querySelector('[role=group] label')!.tagName).toBe('LABEL');
    expect(root.querySelector('output')).toHaveAttribute('aria-live', 'off');
    const parts = group.querySelectorAll('[data-orientation]');
    expect(parts).toHaveLength(6);
    for (const part of [group, ...parts]) {
      expect(dataAttributes(part)).toEqual(['data-orientation']);
    }
    expect(input().type).toBe('range');
    expect(input().getAttributeNames().sort()).toEqual([
      'aria-labelledby',
      'aria-orientation',
      'id',
      'max',
      'min',
      'step',
      'style',
      'type',
      'value',
    ]);
  });

  test('the element slot renders the elements of the developer; the input of a thumb can be in a Teleport', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const { root, exposed } = mount(SliderSlots, { target });
    await nextTick();
    const section = root.querySelector('section')!;
    expect(section).toHaveAttribute('role', 'group');
    expect(section).toHaveAttribute('data-values', '20,60');
    expect(exposed.root.element).toBe(section);
    expect(exposed.label.element).toBe(root.querySelector('.Label'));
    expect(exposed.value.element.textContent).toBe('20 to 60');
    expect(exposed.control.element).toBe(root.querySelector('.Control'));
    expect(exposed.track.element).toBe(root.querySelector('.Track'));
    expect(exposed.indicator.element).toBe(root.querySelector('.StyledDiv'));
    expect(exposed.thumb.element).toBe(root.querySelector('.Thumb'));
    const [start, end] = [root.querySelector<HTMLInputElement>('.Input')!, target.querySelector('input')!];
    expect(exposed.thumb.input).toBe(start);
    expect([start.value, end.value, end.name]).toEqual(['20', '60', 'volume']);
    expect(root.querySelector('.Label')).toHaveAttribute('for', start.id);
    end.focus();
    await userEvent.keyboard('{ArrowRight}');
    await nextTick();
    expect(section).toHaveAttribute('data-values', '20,61');
    expect(new FormData(root.querySelector('form')!).getAll('volume')).toEqual(['20']);
    target.remove();
  });

  test('the attributes of a thumb: aria-*, tabindex, autofocus, focus, blur and keydown go to the input; the others to the thumb; the developer wins on each', async () => {
    const log: string[] = [];
    const record = (name: string) => (event: Event) =>
      log.push(`${name} ${(event.currentTarget as Element).localName}`);
    const { input, thumb } = await mountSlider({
      thumbs: [
        {
          class: 'Thumb',
          'data-kind': 'start',
          'aria-label': 'Start',
          'aria-orientation': 'vertical',
          tabindex: -1,
          style: { position: 'relative' },
          onFocus: record('focus'),
          onBlur: record('blur'),
          onKeydown: record('keydown'),
          onFocusin: record('focusin'),
          onInput: record('input'),
          onClick: record('click'),
        },
      ],
    });
    expect(thumb()).toHaveClass('Thumb');
    expect(thumb()).toHaveAttribute('data-kind', 'start');
    expect(thumb().style.position).toBe('relative');
    expect(input()).toHaveAttribute('aria-label', 'Start');
    expect(input()).toHaveAttribute('aria-orientation', 'vertical');
    expect(input()).toHaveAttribute('tabindex', '-1');
    expect(input()).not.toHaveAttribute('aria-labelledby');
    expect(thumb()).not.toHaveAttribute('aria-label');
    await press(input(), '{ArrowRight}');
    input().dispatchEvent(new Event('input', { bubbles: true }));
    input().blur();
    thumb().click();
    expect(log).toEqual([
      'focus input',
      'focusin div',
      'keydown input',
      'input div',
      'blur input',
      'click div',
    ]);
  });

});

describe('the value', () => {
  test('with no model and no default it is min; a number makes one thumb, an array one value for each thumb', async () => {
    const one = await mountSlider({ root: { min: 10 } });
    expect(one.values()).toEqual([10]);
    const range = await mountSlider({ root: { defaultValue: [70, 20] }, thumbs: [{}, {}] });
    expect(range.values()).toEqual([20, 70]);
    expect(range.output()).toBeNull();
  });

  test('a controlled slider shows only what the parent writes; undefined makes it uncontrolled with its value', async () => {
    const log: string[] = [];
    const root = sliderModel(log, 50, false);
    const { input, values } = await mountSlider({ root });
    await press(input(), '{ArrowRight}');
    await settle();
    expect(log).toEqual(['change 51 keyboard 0', 'update 51', 'commit 51 keyboard']);
    expect(values()).toEqual([50]);
    root.modelValue = undefined;
    await nextTick();
    expect(values()).toEqual([50]);
    await press(input(), '{ArrowRight}');
    expect(values()).toEqual([51]);
  });

  test('a value of the parent shows at the nearest value of the grid, with no event; max off the grid gives the last value below it', async () => {
    const log: string[] = [];
    const root = sliderModel(log, 33);
    Object.assign(root, { step: 10 });
    const { values, output } = await mountSlider({ root, value: 'after' });
    expect(values()).toEqual([30]);
    root.modelValue = 35;
    await nextTick();
    expect(values()).toEqual([40]);
    expect(output().textContent).toBe('40');
    Object.assign(root, { min: 6, max: 108, modelValue: 200 });
    await nextTick();
    expect(values()).toEqual([106]);
    expect(log).toEqual([]);
  });

  test('an action on a model off the grid or out of order gives one event with the shown form', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [2, 1]);
    const { input } = await mountSlider({ root, thumbs: [{}, {}] });
    input(0).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(log).toEqual(['change 1,2 input-change 0', 'update 1,2', 'commit 1,2 input-change']);
    log.length = 0;
    input(0).dispatchEvent(new Event('input', { bubbles: true }));
    expect(log).toEqual([]);
  });

  test('a decimal step gives exact values', async () => {
    const { input, values } = await mountSlider({
      root: { defaultValue: 0.2, min: 0, max: 1, step: 0.1 },
    });
    await press(input(), '{ArrowRight}');
    expect(values()).toEqual([0.3]);
  });

  test('with max not above min each value is min, and no action changes it; a development build warns', async () => {
    const log: string[] = [];
    const root = sliderModel(log, 50);
    Object.assign(root, { min: 10, max: 10 });
    const { input, values, thumb } = await mountSlider({ root });
    expect(takeReportedMessages()).toEqual([
      'console.warn: Vase UI: Slider `max` must be greater than `min`. With `max` at or below `min`, the slider has no range of values to choose from. Set `max` above `min`.',
    ]);
    expect(values()).toEqual([10]);
    expect(thumb().style.insetInlineStart).toBe('0%');
    await press(input(), '{ArrowRight}{End}');
    expect(log).toEqual([]);
  });

  test('a thumb with no value changes nothing', async () => {
    const log: string[] = [];
    const { input } = await mountSlider({ root: sliderModel(log, [20]), thumbs: [{}, {}] });
    await press(input(1), '{ArrowRight}');
    expect(log).toEqual([]);
    expect(input(1).parentElement!.style.insetInlineStart).toBe('');
  });
});

describe('the events', () => {
  test('a change gives one valueChange with the native event and then one update:modelValue; a cancel keeps the value and each input', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [20, 40]);
    const events: SliderRootChangeEventDetails[] = [];
    let cancel = false;
    root.onValueChange = (value: unknown, details: SliderRootChangeEventDetails) => {
      log.push(`change ${String(value)}`);
      events.push(details);
      if (cancel) details.cancel();
    };
    const { input, values } = await mountSlider({ root, thumbs: [{ name: 'a' }, {}] });
    await press(input(1), '{ArrowLeft}');
    expect(log).toEqual(['change 20,39', 'update 20,39', 'commit 20,39 keyboard']);
    expect(events[0]!.event).toBeInstanceOf(KeyboardEvent);
    expect(events[0]!.activeThumbIndex).toBe(1);
    cancel = true;
    log.length = 0;
    await press(input(1), '{ArrowLeft}');
    input(0).value = '30';
    input(0).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(log).toEqual(['change 20,38', 'change 30,39']);
    expect(values()).toEqual([20, 39]);
    expect(events[2]!.reason).toBe('input-change');
    expect(events[2]!.event.type).toBe('input');
  });

  test('a native input event changes the thumb to its limit at most and commits; a change event gives nothing', async () => {
    const log: string[] = [];
    const root = sliderModel(log, [20, 40, 80]);
    const { input, values } = await mountSlider({ root, thumbs: [{}, {}, {}] });
    input(1).value = '90';
    input(1).dispatchEvent(new Event('input', { bubbles: true }));
    input(1).dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(values()).toEqual([20, 80, 80]);
    expect(log).toEqual([
      'change 20,80,80 input-change 1',
      'update 20,80,80',
      'commit 20,80,80 input-change',
    ]);
  });
});

describe('the keys', () => {
  test.each([
    { orientation: 'horizontal', dir: 'ltr', up: ['ArrowUp', 'ArrowRight'], down: ['ArrowDown', 'ArrowLeft'] },
    { orientation: 'horizontal', dir: 'rtl', up: ['ArrowUp', 'ArrowLeft'], down: ['ArrowDown', 'ArrowRight'] },
    { orientation: 'vertical', dir: 'ltr', up: ['ArrowUp', 'ArrowRight'], down: ['ArrowDown', 'ArrowLeft'] },
    { orientation: 'vertical', dir: 'rtl', up: ['ArrowUp', 'ArrowLeft'], down: ['ArrowDown', 'ArrowRight'] },
  ])(
    '$orientation, $dir: $up go one step up and $down one step down; Shift with an arrow, Page Up and Page Down a large step; Home and End to the ends',
    async ({ orientation, dir, up, down }) => {
      const { input, values } = await mountSlider({
        root: { defaultValue: 50, orientation, dir, largeStep: 20 },
      });
      const after = async (key: string) => {
        await press(input(), key);
        return values()[0];
      };
      expect(await after(`{${up[0]}}`)).toBe(51);
      expect(await after(`{${up[1]}}`)).toBe(52);
      expect(await after(`{${down[0]}}`)).toBe(51);
      expect(await after(`{${down[1]}}`)).toBe(50);
      expect(await after(`{Shift>}{${up[1]}}{/Shift}`)).toBe(70);
      expect(await after('{PageDown}')).toBe(50);
      expect(await after('{PageUp}')).toBe(70);
      expect(await after(`{Shift>}{${down[0]}}{/Shift}`)).toBe(50);
      expect(await after('{End}')).toBe(100);
      expect(await after('{Home}')).toBe(0);
    },
  );

  test('a key prevents its default action and stops at the ends with no event; End gives the largest value of the grid', async () => {
    const log: string[] = [];
    const root = sliderModel(log, 95);
    Object.assign(root, { step: 10, max: 99 });
    const prevented: boolean[] = [];
    const { input, values } = await mountSlider({
      root,
      thumbs: [{ onKeydown: (event: KeyboardEvent) => prevented.push(event.defaultPrevented) }],
    });
    await press(input(), '{End}{ArrowRight}{Enter}');
    expect(values()).toEqual([90]);
    expect(prevented).toEqual([true, true, false]);
    expect(log).toEqual(['change 90 keyboard 0', 'update 90', 'commit 90 keyboard']);
  });

  test('a large step off the grid goes on to the next value of the grid in the direction of the key', async () => {
    const { input, values } = await mountSlider({
      root: { defaultValue: 20, step: 2, largeStep: 5 },
    });
    await press(input(), '{PageUp}');
    expect(values()).toEqual([26]);
    await press(input(), '{PageDown}');
    expect(values()).toEqual([20]);
  });

  test('in a range, a key stops at the limit of the thumb, with the least distance; Home and End go to the limits', async () => {
    const { input, values } = await mountSlider({
      root: { defaultValue: [20, 40, 80], minStepsBetweenValues: 5 },
      thumbs: [{}, {}, {}],
    });
    await press(input(1), '{End}');
    expect(values()).toEqual([20, 75, 80]);
    await press(input(1), '{Home}');
    expect(values()).toEqual([20, 25, 80]);
    await press(input(1), '{ArrowLeft}');
    expect(values()).toEqual([20, 25, 80]);
  });

  test('Ctrl, Alt and Meta with a key change nothing and keep the shortcut of the browser', async () => {
    const log: string[] = [];
    const prevented: boolean[] = [];
    const { input, values } = await mountSlider({
      root: sliderModel(log, 50),
      thumbs: [{ onKeydown: (event: KeyboardEvent) => prevented.push(event.defaultPrevented) }],
    });
    for (const modifier of ['Control', 'Alt', 'Meta']) {
      for (const key of ['ArrowRight', 'ArrowDown', 'PageUp', 'End']) {
        await press(input(), `{${modifier}>}{${key}}{/${modifier}}`);
        await settle();
      }
    }
    expect(values()).toEqual([50]);
    expect(log).toEqual([]);
    expect(prevented).not.toContain(true);
  });

  // Chromium and WebKit change a range input at an arrow key with Ctrl, Alt or Meta.
  test.runIf(server.browser !== 'firefox')(
    'the thumb refuses the input event of a key with Ctrl and writes its value back',
    async () => {
      const inputs: string[] = [];
      const { input } = await mountSlider({
        root: { defaultValue: 50 },
        thumbs: [{ onInput: (event: Event) => inputs.push((event.target as HTMLInputElement).value) }],
      });
      await press(input(), '{Control>}{ArrowRight}{/Control}');
      expect(inputs).toEqual(['50']);
      expect(input().value).toBe('50');
    },
  );

  test('the toolbar around the slider does not take the arrow keys of a thumb; a button in the root stays an item of the toolbar', async () => {
    const { root } = mount(SliderInToolbar);
    await nextTick();
    const input = root.querySelector<HTMLInputElement>('input[type=range]')!;
    await press(input, '{ArrowRight}{End}');
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('100');
    root.querySelector<HTMLElement>('#first')!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(root.querySelector('#inside'));
  });
});

describe('the active thumb', () => {
  test('is the thumb whose input has the focus; in a range it has z-index 2, and after a blur 1; a disabled thumb is not active', async () => {
    const thumbs = reactive<Attrs[]>([{}, {}]);
    const { input, thumb } = await mountSlider({ root: { defaultValue: [20, 40] }, thumbs });
    const zIndexes = () => [thumb(0).style.zIndex, thumb(1).style.zIndex];
    expect(zIndexes()).toEqual(['', '']);
    input(1).focus();
    await nextTick();
    expect(zIndexes()).toEqual(['', '2']);
    input(0).focus();
    await nextTick();
    expect(zIndexes()).toEqual(['2', '']);
    input(0).blur();
    await nextTick();
    expect(zIndexes()).toEqual(['1', '']);
    thumbs[0]!.disabled = true;
    input(1).focus();
    await nextTick();
    expect(zIndexes()).toEqual(['', '2']);
  });

  test('a single thumb has z-index 1 while it has the focus', async () => {
    const { input, thumb } = await mountSlider({});
    input().focus();
    await nextTick();
    expect(thumb().style.zIndex).toBe('1');
    input().blur();
    await nextTick();
    expect(thumb().style.zIndex).toBe('');
  });
});

describe('the names', () => {
  test('Slider.Label is the label of the first input; the root and each input have its id in aria-labelledby', async () => {
    const { group, label, inputs } = await mountSlider({
      root: { defaultValue: [20, 40] },
      thumbs: [{}, {}],
      label: 'after',
    });
    expect(label().htmlFor).toBe(inputs()[0]!.id);
    expect(group).toHaveAttribute('aria-labelledby', label().id);
    for (const input of inputs()) expect(input).toHaveAttribute('aria-labelledby', label().id);
  });

  test('VUE-93: an empty id of Slider.Label or Slider.Thumb is no id; an id of the developer wins', async () => {
    const thumbs = reactive([{ id: '' }]);
    const labelAttrs = reactive({ id: ' ' });
    const { label, input, group } = await mountSlider({ thumbs, label: 'before', labelAttrs });
    expect(label().id).not.toBe(' ');
    expect(label().id).not.toBe('');
    expect(input().id).not.toBe('');
    expect(label().htmlFor).toBe(input().id);
    thumbs[0]!.id = 'volume';
    labelAttrs.id = 'volume-label';
    await nextTick();
    expect(label()).toHaveAttribute('for', 'volume');
    expect(group).toHaveAttribute('aria-labelledby', 'volume-label');
  });

  test('an aria-label of the developer on the root or on a thumb stops the aria-labelledby of the part', async () => {
    const { group, input } = await mountSlider({
      root: { 'aria-label': 'Volume' },
      thumbs: [{ 'aria-labelledby': 'elsewhere' }],
      label: 'before',
    });
    expect(group).not.toHaveAttribute('aria-labelledby');
    expect(input()).toHaveAttribute('aria-labelledby', 'elsewhere');
  });

  test('the legend of a Fieldset.Root names a slider with no label', async () => {
    const { group } = await mountSlider({ fieldset: { native: false, disabled: false } });
    expect(group).toHaveAttribute('aria-labelledby', 'legend');
  });
});

describe('the text', () => {
  test('Slider.Value shows the formatted values; aria-valuetext comes from the attribute, getAriaValueText, or format', async () => {
    const root = reactive<Attrs>({ defaultValue: [0.2, 0.5], min: 0, max: 1, step: 0.1 });
    const thumbs = reactive<Attrs[]>([
      { getAriaValueText: (text: string, value: number, index: number) => `${text}|${value}|${index}` },
      {},
    ]);
    const { output, input } = await mountSlider({ root, thumbs, value: 'before' });
    expect(output().textContent).toBe('0.2 – 0.5');
    expect(output()).toHaveAttribute('for', `${input(0).id} ${input(1).id}`);
    expect(input(0)).toHaveAttribute('aria-valuetext', '0.2|0.2|0');
    expect(input(1)).not.toHaveAttribute('aria-valuetext');
    Object.assign(root, { format: { style: 'percent' }, locale: 'de-DE' });
    thumbs[0]!['aria-valuetext'] = 'low';
    await nextTick();
    expect(output().textContent).toBe('20\u00a0% – 50\u00a0%');
    expect(input(0)).toHaveAttribute('aria-valuetext', 'low');
    expect(input(1)).toHaveAttribute('aria-valuetext', '50\u00a0%');
  });

  test('the default locale is en-US', async () => {
    const { output } = await mountSlider({
      root: { defaultValue: 1234.5, max: 2000, step: 0.5 },
      value: 'after',
    });
    expect(output().textContent).toBe('1,234.5');
  });
});

describe('disabled', () => {
  test('a disabled slider has data-disabled on each part and disabled inputs; a key does nothing', async () => {
    const root = reactive<Attrs>({ defaultValue: 50, disabled: true });
    const { group, inputs, values } = await mountSlider({ root, label: 'before', value: 'after' });
    for (const part of [group, ...group.querySelectorAll('[data-orientation]')]) {
      expect(part).toHaveAttribute('data-disabled');
    }
    expect(inputs().every((input) => input.disabled)).toBe(true);
    root.disabled = false;
    await nextTick();
    expect(group).not.toHaveAttribute('data-disabled');
    expect(values()).toEqual([50]);
  });

  test('a disabled thumb has data-disabled and a disabled input; the others stay enabled', async () => {
    const { thumb, input } = await mountSlider({
      root: { defaultValue: [20, 40] },
      thumbs: [{ disabled: true }, {}],
    });
    expect(thumb(0)).toHaveAttribute('data-disabled');
    expect(input(0).disabled).toBe(true);
    expect(thumb(1)).not.toHaveAttribute('data-disabled');
    expect(input(1).disabled).toBe(false);
  });
});

describe('the order of the thumbs', () => {
  test('a thumb takes its place in the document; index wins', async () => {
    const thumbs = reactive<Attrs[]>([{ key: 'b' }]);
    const { inputs, values } = await mountSlider({ root: { defaultValue: [20, 40] }, thumbs });
    thumbs.unshift({ key: 'a' });
    await settle();
    expect(values()).toEqual([20, 40]);
    thumbs.splice(0, 2, { key: 'c', index: 1 }, { key: 'd', index: 0 });
    await settle();
    expect(values()).toEqual([40, 20]);
    expect(inputs()).toHaveLength(2);
  });
});

// The cases throw in `setup`, so they are the last of the file.
describe('a part outside a root', () => {
  test.each(['Label', 'Value', 'Control', 'Track', 'Indicator', 'Thumb'] as const)(
    'Slider.%s throws an error that says so',
    (part) => {
      const error = mountError(SliderPartAlone, { part });
      expect((error as Error).message).toBe(
        `Vase UI Slider: <Slider.${part}> must be inside <Slider.Root>.`,
      );
      takeReportedMessages();
    },
  );
});
