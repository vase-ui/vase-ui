import axe from 'axe-core';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import MeterElementsReplaced from '../../test/fixtures/MeterElementsReplaced.vue';
import MeterLabelInTeleport from '../../test/fixtures/MeterLabelInTeleport.vue';
import MeterLabels from '../../test/fixtures/MeterLabels.vue';
import MeterPartAlone from '../../test/fixtures/MeterPartAlone.vue';
import MeterParts from '../../test/fixtures/MeterParts.vue';
import MeterValueSlot from '../../test/fixtures/MeterValueSlot.vue';
import { mockRuntimeLocale } from '../../test/mockRuntimeLocale';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

type Attributes = Record<string, unknown>;

interface Parts {
  root?: Attributes;
  label?: Attributes | null;
  value?: Attributes;
  track?: Attributes;
  indicator?: Attributes;
}

/** Mounts the five parts and waits for the render after the mount. */
async function mountMeter(parts: Parts = {}) {
  const { root, exposed } = mount(MeterParts, { parts });
  await nextTick();
  const element = (part: keyof Parts) => exposed[part]?.element as HTMLElement | undefined;
  return {
    root,
    meter: element('root')!,
    label: element('label'),
    value: element('value')!,
    track: element('track')!,
    indicator: element('indicator')!,
  };
}

describe('the parts', () => {
  test('each part renders its element with the attributes of the developer, and a ref has it', async () => {
    const onClick = vi.fn();
    const { root, meter, label, value, track, indicator } = await mountMeter({
      root: { class: 'Meter', 'data-kind': 'storage', onClick },
      label: { class: 'Label' },
      value: { class: 'Value' },
      track: { class: 'Track' },
      indicator: { class: 'Indicator' },
    });
    expect(root.children).toHaveLength(1);
    expect(root.firstElementChild).toBe(meter);
    expect([...meter.children].slice(0, 3)).toEqual([label, value, track]);
    expect(indicator.parentElement).toBe(track);
    const names = (part: Element) => [part.localName, ...part.getAttributeNames().sort()];
    expect([meter, label!, value, track, indicator].map(names)).toEqual([
      [
        'div',
        'aria-labelledby',
        'aria-valuemax',
        'aria-valuemin',
        'aria-valuenow',
        'aria-valuetext',
        'class',
        'data-kind',
        'role',
      ],
      ['span', 'class', 'id'],
      ['span', 'aria-hidden', 'class'],
      ['div', 'class'],
      ['div', 'class', 'style'],
    ]);
    expect(value).toHaveAttribute('aria-hidden', 'true');
    meter.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('the element slot of each part renders the element of the developer, which alone gets the attributes', async () => {
    const onClick = vi.fn();
    const part = { class: 'Part' };
    const { root, exposed } = mount(MeterElementsReplaced, {
      parts: { root: { ...part, onClick }, label: part, value: part, track: part, indicator: part },
    });
    await nextTick();
    const meter = root.querySelector('section')!;
    const label = meter.querySelector('strong')!;
    const value = meter.querySelector('output')!;
    const track = meter.querySelector('p')!;
    const indicator = track.querySelector('i')!;
    expect(exposed.root.element).toBe(meter);
    expect(exposed.label.element).toBe(label);
    expect(exposed.value.element).toBe(value);
    expect(exposed.track.element).toBe(track);
    expect(exposed.indicator.element).toBe(indicator);
    for (const element of [meter, label, value, track, indicator]) {
      expect(element).toHaveAttribute('class', 'Part');
    }
    for (const frame of root.querySelectorAll('.frame')) {
      expect(frame.getAttributeNames()).toEqual(['class']);
      expect(frame).toHaveAttribute('class', 'frame');
    }
    meter.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(meter).toHaveAttribute('role', 'meter');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(meter).toHaveAttribute('aria-labelledby', label.id);
    expect(value).toHaveAttribute('aria-hidden', 'true');
    // The slot gets the text of the value held in the range, and the `value` prop.
    expect(value).toHaveTextContent('100 of 150');
    expect(indicator.style.width).toBe('100%');
    // The developer puts the text in their element.
    expect(meter.querySelector('[role=presentation]')).toBeNull();
  });

  test('Meter.Track outside a root renders its element', () => {
    const { root } = mount(MeterPartAlone, { part: 'Track' });
    expect(root.firstElementChild!.localName).toBe('div');
  });
});

describe('the value and the range', () => {
  test.each([
    { name: 'a value in the range', root: { value: 30 }, now: '30', text: '30%', width: '30%' },
    {
      name: 'a range from 0 to 1',
      root: { value: 0.5, min: 0, max: 1 },
      now: '0.5',
      text: '50%',
      width: '50%',
    },
    {
      name: 'a min that is not 0',
      root: { value: 30, min: 20, max: 40 },
      now: '30',
      text: '50%',
      width: '50%',
    },
    { name: 'a value over max', root: { value: 150 }, now: '100', text: '100%', width: '100%' },
    { name: 'a value under min', root: { value: -10 }, now: '0', text: '0%', width: '0%' },
    {
      name: 'a max equal to min',
      root: { value: 5, min: 5, max: 5 },
      now: '5',
      text: '0%',
      width: '0%',
    },
    { name: 'NaN', root: { value: Number.NaN }, now: '0', text: '0%', width: '0%' },
    { name: 'Infinity', root: { value: Infinity }, now: '100', text: '100%', width: '100%' },
    {
      name: 'a value that the text rounds',
      root: { value: 33.333 },
      now: '33.333',
      text: '33%',
      width: '33.333%',
    },
  ])('$name', async ({ root, now, text, width }) => {
    const { meter, value, indicator } = await mountMeter({ root });
    expect(meter).toHaveAttribute('aria-valuemin', String(root.min ?? 0));
    expect(meter).toHaveAttribute('aria-valuemax', String(root.max ?? 100));
    expect(meter).toHaveAttribute('aria-valuenow', now);
    expect(meter).toHaveAttribute('aria-valuetext', text);
    expect(value).toHaveTextContent(text);
    expect(indicator.style.width).toBe(width);
  });

  test('a change of value, min and max updates the attributes, the text and the indicator in one render', async () => {
    const root = reactive<Attributes>({ value: 20, min: 10, max: 30 });
    const { meter, value, indicator } = await mountMeter({ root });
    expect(meter).toHaveAttribute('aria-valuetext', '50%');
    Object.assign(root, { value: 50, min: 20, max: 60 });
    await nextTick();
    expect(meter).toHaveAttribute('aria-valuemin', '20');
    expect(meter).toHaveAttribute('aria-valuemax', '60');
    expect(meter).toHaveAttribute('aria-valuenow', '50');
    expect(meter).toHaveAttribute('aria-valuetext', '75%');
    expect(value).toHaveTextContent('75%');
    expect(indicator.style.width).toBe('75%');
  });
});

describe('the text of the value', () => {
  test('format formats the value held in the range, and locale gives the language', async () => {
    const root = reactive<Attributes>({
      value: 150,
      format: { style: 'currency', currency: 'USD' },
    });
    const { meter, value } = await mountMeter({ root });
    expect(meter).toHaveAttribute('aria-valuetext', '$100.00');
    expect(value).toHaveTextContent('$100.00');
    root.locale = 'de-DE';
    await nextTick();
    const text = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD' }).format(100);
    expect(meter).toHaveAttribute('aria-valuetext', text);
    expect(value.textContent).toBe(text);
    root.format = undefined;
    await nextTick();
    expect(value.textContent).toBe(new Intl.NumberFormat('de-DE', { style: 'percent' }).format(1));
  });

  test('with no locale and no LocaleProvider, the text is en-US, also in a browser with another locale', async () => {
    mockRuntimeLocale('de-DE');
    const { meter, value } = await mountMeter({
      root: { value: 1234.5, max: 2000, format: { maximumFractionDigits: 1 } },
    });
    expect(meter).toHaveAttribute('aria-valuetext', '1,234.5');
    expect(value.textContent).toBe('1,234.5');
  });

  test('getAriaValueText gives aria-valuetext from the text and the value prop, and the shown text stays', async () => {
    const getAriaValueText = vi.fn((text: string, value: number) => `${text} (${value})`);
    const { meter, value } = await mountMeter({ root: { value: 150, getAriaValueText } });
    expect(getAriaValueText).toHaveBeenLastCalledWith('100%', 150);
    expect(meter).toHaveAttribute('aria-valuetext', '100% (150)');
    expect(value).toHaveTextContent('100%');
  });

  test('an aria-valuetext of the developer wins', async () => {
    const getAriaValueText = () => 'From the function';
    const { meter } = await mountMeter({
      root: { getAriaValueText, 'aria-valuetext': 'Almost a third' },
    });
    expect(meter).toHaveAttribute('aria-valuetext', 'Almost a third');
  });

  test('the default slot of Meter.Value gets the text and the value prop, and follows a change', async () => {
    const root = reactive<Attributes>({ 'aria-label': 'Storage' });
    const { root: container } = mount(MeterValueSlot, { root });
    await nextTick();
    const value = container.querySelector('[aria-hidden]')!;
    expect(value).toHaveTextContent('30% of 30');
    root.value = 150;
    await nextTick();
    expect(value).toHaveTextContent('100% of 150');
  });
});

describe('the name', () => {
  test('VUE-93: a label names the root with its id prop or with an id of the root, and follows it', async () => {
    const label = reactive<Attributes>({});
    const { meter, label: element } = await mountMeter({ label });
    const generated = element!.id;
    expect(generated).not.toBe('');
    expect(meter).toHaveAttribute('aria-labelledby', generated);
    expect(meter).toHaveAccessibleName('Battery');
    label.id = 'own';
    await nextTick();
    expect(element!.id).toBe('own');
    expect(meter).toHaveAttribute('aria-labelledby', 'own');
    // HTML gives an id no white space, so a blank `id` counts as none.
    for (const blank of ['', ' ']) {
      label.id = blank;
      await nextTick();
      expect(element!.id).toBe(generated);
      expect(meter).toHaveAttribute('aria-labelledby', generated);
    }
  });

  test('a root has no aria-labelledby with no label and after its label unmounts', async () => {
    const parts = reactive<Parts>({ label: null });
    const { meter } = await mountMeter(parts);
    expect(meter).not.toHaveAttribute('aria-labelledby');
    parts.label = { id: 'own' };
    await nextTick();
    expect(meter).toHaveAttribute('aria-labelledby', 'own');
    parts.label = null;
    await nextTick();
    expect(meter).not.toHaveAttribute('aria-labelledby');
  });

  test('with two labels, the root names the first, and keeps it when the other unmounts', async () => {
    const ids = reactive(['first', 'second']);
    const meter = mount(MeterLabels, { ids }).root.firstElementChild!;
    await nextTick();
    expect(meter).toHaveAttribute('aria-labelledby', 'first');
    ids.pop();
    await nextTick();
    expect(meter).toHaveAttribute('aria-labelledby', 'first');
  });

  test('an aria-label of the developer names the root, also with a label; a bound null or undefined does not', async () => {
    const root = reactive<Attributes>({ 'aria-label': 'Charge' });
    const { meter, label } = await mountMeter({ root });
    for (const none of [null, undefined]) {
      root['aria-label'] = 'Charge';
      await nextTick();
      expect(meter).not.toHaveAttribute('aria-labelledby');
      expect(meter).toHaveAccessibleName('Charge');
      root['aria-label'] = none;
      await nextTick();
      expect(meter).not.toHaveAttribute('aria-label');
      expect(meter).toHaveAttribute('aria-labelledby', label!.id);
      expect(meter).toHaveAccessibleName('Battery');
    }
  });

  test('an aria-labelledby of the developer wins, with and without a label; a bound undefined removes it', async () => {
    const parts = reactive<Parts>({ root: { 'aria-labelledby': 'outside' } });
    const { meter } = await mountMeter(parts);
    expect(meter).toHaveAttribute('aria-labelledby', 'outside');
    parts.label = null;
    await nextTick();
    expect(meter).toHaveAttribute('aria-labelledby', 'outside');
    parts.label = {};
    parts.root!['aria-labelledby'] = undefined;
    await nextTick();
    expect(meter).not.toHaveAttribute('aria-labelledby');
  });

  test('a label in a Teleport names the root, and a v-if that replaces it moves the name', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => target.remove());
    const scene = reactive({ label: 'first' });
    const meter = mount(MeterLabelInTeleport, { scene, target }).root.firstElementChild!;
    await nextTick();
    expect(target.querySelector('#first')).not.toBeNull();
    expect(meter).toHaveAccessibleName('First');
    scene.label = 'second';
    await nextTick();
    expect(meter).toHaveAccessibleName('Second');
    scene.label = 'none';
    await nextTick();
    expect(meter).not.toHaveAttribute('aria-labelledby');
  });

  test('a meter with a label has no accessibility violation', async () => {
    const { root } = await mountMeter();
    const results = await axe.run(root);
    expect(results.violations).toEqual([]);
  });
});

describe('the hidden text', () => {
  test('the default element holds the content, then a visually hidden text', async () => {
    const { root } = mount(MeterValueSlot, { root: { 'aria-label': 'Storage' } });
    await nextTick();
    const meter = root.firstElementChild!;
    expect(meter).toHaveAccessibleName('Storage');
    const [value, hidden] = meter.children;
    expect(meter.children).toHaveLength(2);
    expect(value).toHaveAttribute('aria-hidden', 'true');
    expect(hidden).toHaveAttribute('role', 'presentation');
    expect(hidden).toHaveTextContent('x');
    expect(hidden).toHaveStyle({ clipPath: 'inset(50%)', width: '1px', height: '1px' });
  });
});

describe('the indicator', () => {
  test.each(['ltr', 'rtl'])(
    'starts at the start edge in %s text, with the width of the percent',
    async (dir) => {
      const { indicator } = await mountMeter({
        root: { value: 33, dir, style: { width: '100px' } },
      });
      const style = getComputedStyle(indicator);
      expect(style.width).toBe('33px');
      expect(dir === 'ltr' ? style.left : style.right).toBe('0px');
      expect(dir === 'ltr' ? style.right : style.left).toBe('auto');
    },
  );

  test('a style of the developer merges with the style of the part, and its property wins', async () => {
    const { indicator } = await mountMeter({
      indicator: { style: { width: '10px', color: 'red' } },
    });
    expect(indicator.style.width).toBe('10px');
    expect(indicator.style.color).toBe('red');
    expect(indicator.style.height).toBe('inherit');
    expect(indicator.style.insetInlineStart).toBe('0px');
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('outside a root', () => {
  test.each(['Label', 'Value', 'Indicator'])('Meter.%s throws', (part) => {
    expect(String(mountError(MeterPartAlone, { part }))).toBe(
      `Error: Vase UI: <Meter.${part}> must be inside <Meter.Root>. Without a root the part has no value to show. Put the part inside <Meter.Root>.`,
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
