import { describe, expect, test, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import { expectNoAxeViolations } from '../../test/axe';
import { dataAttributes } from '../../test/field';
import ProgressInTransition from '../../test/fixtures/ProgressInTransition.vue';
import ProgressLabelInTeleport from '../../test/fixtures/ProgressLabelInTeleport.vue';
import ProgressPartOutsideRoot from '../../test/fixtures/ProgressPartOutsideRoot.vue';
import ProgressParts from '../../test/fixtures/ProgressParts.vue';
import ProgressSlots from '../../test/fixtures/ProgressSlots.vue';
import { mockRuntimeLocale } from '../../test/mockRuntimeLocale';
import { screen } from '../../test/queries';
import { takeReportedMessages } from '../../test/reportedMessages';
import { mount, mountError } from '../../test/render';

type Attributes = Record<string, unknown>;

/** Mounts the five parts and waits one render. */
async function mountParts(props: Record<string, unknown> = {}) {
  const { root, exposed } = mount(ProgressParts, props);
  await nextTick();
  const part = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  return {
    exposed,
    root: part('[role=progressbar]'),
    label: part('.label'),
    value: part('.value'),
    track: part('.track'),
    indicator: part('.indicator'),
  };
}

const percent = (value: number, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'percent' }).format(value);

describe('the parts', () => {
  test('each part renders its element with the attributes of the developer, and its ref has the element', async () => {
    const onClick = vi.fn();
    const parts = await mountParts({
      root: { value: 30, class: 'Bar', 'data-kind': 'upload', onClick },
    });
    const { root, label, value, track, indicator, exposed } = parts;
    expect(root.tagName).toBe('DIV');
    expect(root).toHaveClass('Bar');
    expect(root).toHaveAttribute('data-kind', 'upload');
    root.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect([label, value, track, indicator].map(({ tagName }) => tagName)).toEqual([
      'SPAN',
      'SPAN',
      'DIV',
      'DIV',
    ]);
    expect(label).not.toHaveAttribute('role');
    expect(value).toHaveAttribute('aria-hidden', 'true');
    for (const name of ['root', 'label', 'value', 'track', 'indicator'] as const) {
      expect(exposed[name].element).toBe(parts[name]);
    }
    // The element of the root holds the content and no node of the part.
    expect([...root.children]).toEqual([label, value, track]);
  });

  test('the element slot of each part renders the element of the developer, with the state and the text', async () => {
    const scene = reactive<{ value: number | null }>({ value: 30 });
    const { root } = mount(ProgressSlots, { scene });
    await nextTick();
    const section = root.querySelector('section')!;
    expect(section).toHaveAttribute('role', 'progressbar');
    expect(section).toHaveAttribute('data-state', 'progressing');
    const strong = section.querySelector('strong')!;
    expect(strong).toHaveAttribute('data-state', 'progressing');
    expect(screen.getByRole('progressbar', { name: 'Upload' })).toBe(section);
    expect(section.querySelector('output')).toHaveTextContent(`${percent(0.3)} 30`);
    expect(section.querySelector('output')).toHaveAttribute('aria-hidden', 'true');
    expect(JSON.parse(section.querySelector('.scope')!.textContent!)).toEqual({
      formattedValue: percent(0.3),
      value: 30,
      status: 'progressing',
    });
    expect(section.querySelector('p')).toHaveAttribute('data-progressing');
    expect(section.querySelector('i')!.style.width).toBe('30%');
    // The slots give the `value` prop as the developer gave it.
    scene.value = 150;
    await nextTick();
    expect(section.querySelector('output')).toHaveTextContent(`${percent(1)} 150`);
    expect(JSON.parse(section.querySelector('.scope')!.textContent!)).toMatchObject({ value: 150 });
    scene.value = null;
    await nextTick();
    expect(JSON.parse(section.querySelector('.scope')!.textContent!)).toEqual({
      formattedValue: null,
      value: null,
      status: 'indeterminate',
    });
  });

  test('the root renders its element as the root, for Transition', async () => {
    const scene = reactive({ shown: false });
    const { root } = mount(ProgressInTransition, { scene });
    scene.shown = true;
    await nextTick();
    expect(root.querySelector('[role=progressbar]')).toHaveClass('v-enter-from', 'v-enter-active');
  });
});

describe('the status', () => {
  test('each part shows the status of the value in the same update', async () => {
    const attrs = reactive<Attributes>({ value: null });
    const { root, label, value, track, indicator } = await mountParts({ root: attrs });
    const statuses = () => [root, label, value, track, indicator].map(dataAttributes);
    const expectStatus = (name: string) =>
      expect(statuses()).toEqual(Array.from({ length: 5 }, () => [`data-${name}`]));

    expectStatus('indeterminate');
    expect(root).not.toHaveAttribute('aria-valuenow');
    expect(root).not.toHaveAttribute('aria-valuetext');
    expect(value).toBeEmptyDOMElement();
    expect(indicator).not.toHaveAttribute('style');

    attrs.value = 50;
    await nextTick();
    expectStatus('progressing');
    expect(root).toHaveAttribute('aria-valuenow', '50');
    expect(root).toHaveAttribute('aria-valuetext', percent(0.5));
    expect(value).toHaveTextContent(percent(0.5));
    expect(indicator.style.width).toBe('50%');

    attrs.value = 100;
    await nextTick();
    expectStatus('complete');
    expect(root).toHaveAttribute('aria-valuenow', '100');
    expect(indicator.style.width).toBe('100%');

    attrs.value = null;
    await nextTick();
    expectStatus('indeterminate');
    expect(root).not.toHaveAttribute('aria-valuenow');
    expect(root).not.toHaveAttribute('aria-valuetext');
    expect(value).toBeEmptyDOMElement();
    expect(indicator).not.toHaveAttribute('style');
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'a value of %s is indeterminate',
    async (given) => {
      const { root, value } = await mountParts({ root: { value: given } });
      expect(root).toHaveAttribute('data-indeterminate');
      expect(root).not.toHaveAttribute('aria-valuenow');
      expect(value).toBeEmptyDOMElement();
    },
  );

  test.each([40, 45])('a value of %s is complete with a max of 40', async (given) => {
    const { root } = await mountParts({ root: { value: given, max: 40 } });
    expect(dataAttributes(root)).toEqual(['data-complete']);
  });
});

describe('the range', () => {
  test('the text, aria-valuetext and the width are the percent of a custom range', async () => {
    const { root, value, indicator } = await mountParts({
      root: { value: 30, min: 20, max: 40 },
    });
    expect(root).toHaveAttribute('aria-valuemin', '20');
    expect(root).toHaveAttribute('aria-valuemax', '40');
    expect(root).toHaveAttribute('aria-valuetext', percent(0.5));
    expect(value).toHaveTextContent(percent(0.5));
    expect(indicator.style.width).toBe('50%');
  });

  test.each([
    { given: 50, held: '40', share: 1 },
    { given: 10, held: '20', share: 0 },
  ])('a value of $given is held in the range from 20 to 40', async ({ given, held, share }) => {
    const { root, value, indicator } = await mountParts({
      root: { value: given, min: 20, max: 40 },
    });
    expect(root).toHaveAttribute('aria-valuenow', held);
    expect(root).toHaveAttribute('aria-valuetext', percent(share));
    expect(value).toHaveTextContent(percent(share));
    expect(indicator.style.width).toBe(`${share * 100}%`);
  });

  test.each([
    { given: 50, held: 40 },
    { given: 10, held: 20 },
  ])(
    'format shows the value $held for a value of $given out of the range',
    async ({ given, held }) => {
      const format = { style: 'currency', currency: 'USD' } as const;
      const text = new Intl.NumberFormat('en-US', format).format(held);
      const getAriaValueText = vi.fn(
        (formatted: string, raw: number | null) => `${formatted} (${raw})`,
      );
      const { root, value } = await mountParts({
        root: { value: given, min: 20, max: 40, format, getAriaValueText },
      });
      expect(value).toHaveTextContent(text);
      expect(getAriaValueText).toHaveBeenLastCalledWith(text, given);
      expect(root).toHaveAttribute('aria-valuetext', `${text} (${given})`);
    },
  );

  test('with min equal to max, the percent is 0', async () => {
    const { root, value, indicator } = await mountParts({ root: { value: 5, min: 5, max: 5 } });
    expect(root).toHaveAttribute('aria-valuenow', '5');
    expect(root).toHaveAttribute('aria-valuetext', percent(0));
    expect(value).toHaveTextContent(percent(0));
    expect(indicator.style.width).toBe('0%');
  });
});

describe('the text', () => {
  test('format formats the value, and a change of format shows in the same update', async () => {
    const attrs = reactive<Attributes>({
      value: 30,
      format: { style: 'currency', currency: 'USD' },
    });
    const { root, value } = await mountParts({ root: attrs });
    const text = (currency: string) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(30);
    expect(value).toHaveTextContent(text('USD'));
    expect(root).toHaveAttribute('aria-valuetext', text('USD'));
    attrs.format = { style: 'currency', currency: 'EUR' };
    await nextTick();
    expect(value).toHaveTextContent(text('EUR'));
    expect(root).toHaveAttribute('aria-valuetext', text('EUR'));
  });

  test('locale sets the locale of the text', async () => {
    const format = { maximumFractionDigits: 2 };
    const { root, value } = await mountParts({
      root: { value: 70.51, format, locale: 'de-DE' },
    });
    const text = new Intl.NumberFormat('de-DE', format).format(70.51);
    expect(value).toHaveTextContent(text);
    expect(root).toHaveAttribute('aria-valuetext', text);
  });

  test('with no locale, the text is en-US also for a browser in another language', async () => {
    mockRuntimeLocale('de-DE');
    const format = { maximumFractionDigits: 1 };
    const { value } = await mountParts({ root: { value: 1234.5, max: 2000, format } });
    expect(new Intl.NumberFormat(undefined, format).format(1234.5)).toBe('1.234,5');
    expect(value).toHaveTextContent('1,234.5');
  });

  test('getAriaValueText makes aria-valuetext in each status', async () => {
    const getAriaValueText = vi.fn((formatted: string, raw: number | null) =>
      raw === null ? 'Waiting' : `${formatted} done`,
    );
    const attrs = reactive<Attributes>({ value: 30, getAriaValueText });
    const { root, value } = await mountParts({ root: attrs });
    expect(getAriaValueText).toHaveBeenLastCalledWith(percent(0.3), 30);
    expect(root).toHaveAttribute('aria-valuetext', `${percent(0.3)} done`);
    expect(value).toHaveTextContent(percent(0.3));
    attrs.value = null;
    await nextTick();
    expect(getAriaValueText).toHaveBeenLastCalledWith('', null);
    expect(root).toHaveAttribute('aria-valuetext', 'Waiting');
  });

  test('the aria-valuetext of the developer wins over getAriaValueText and the text', async () => {
    const { root } = await mountParts({
      root: { value: 30, 'aria-valuetext': 'A third', getAriaValueText: () => 'Other' },
    });
    expect(root).toHaveAttribute('aria-valuetext', 'A third');
  });
});

describe('the label', () => {
  test('the label names the root, follows its id prop, and goes with the label', async () => {
    const label = reactive<Attributes>({});
    const scene = reactive({ label: true });
    const { root } = await mountParts({ root: { value: 30 }, label, scene });
    expect(screen.getByRole('progressbar', { name: 'Upload' })).toBe(root);
    label.id = 'own';
    await nextTick();
    expect(root).toHaveAttribute('aria-labelledby', 'own');
    scene.label = false;
    await nextTick();
    expect(root).not.toHaveAttribute('aria-labelledby');
  });

  test.each(['', ' '])('an id prop of "%s" counts as no id', async (id) => {
    const { root, label } = await mountParts({ root: { value: 30 }, label: { id } });
    expect(label.id.trim()).not.toBe('');
    expect(root).toHaveAttribute('aria-labelledby', label.id);
  });

  test('with two labels, the root names the first; when it goes, the root names the second', async () => {
    const scene = reactive({ label: true, second: true });
    const { root } = await mountParts({ root: { value: 30 }, label: { id: 'first' }, scene });
    expect(root).toHaveAttribute('aria-labelledby', 'first');
    scene.label = false;
    await nextTick();
    expect(screen.getByRole('progressbar', { name: 'Transfer' })).toBe(root);
  });

  test.each([
    { name: 'aria-label', attribute: { 'aria-label': 'Storage' }, labelledBy: null },
    { name: 'aria-labelledby', attribute: { 'aria-labelledby': 'heading' }, labelledBy: 'heading' },
  ])(
    'an $name of the developer names a root that has a label',
    async ({ attribute, labelledBy }) => {
      const heading = document.body.appendChild(document.createElement('h2'));
      heading.id = 'heading';
      heading.textContent = 'Storage';
      try {
        const { root } = await mountParts({ root: { value: 30, ...attribute } });
        expect(screen.getByRole('progressbar', { name: 'Storage' })).toBe(root);
        expect(root.getAttribute('aria-labelledby')).toBe(labelledBy);
      } finally {
        heading.remove();
      }
    },
  );

  test('a root with no label has no aria-labelledby after the mount', async () => {
    const { root } = await mountParts({ root: { value: 30 }, scene: { label: false } });
    expect(root).not.toHaveAttribute('aria-labelledby');
  });

  test('a label in Teleport names the root, and its unmount removes the name', async () => {
    const outside = document.body.appendChild(document.createElement('div'));
    try {
      const scene = reactive({ label: true });
      const { root } = mount(ProgressLabelInTeleport, { outside, scene });
      await nextTick();
      const bar = root.querySelector('[role=progressbar]')!;
      expect(screen.getByRole('progressbar', { name: 'Upload' })).toBe(bar);
      scene.label = false;
      await nextTick();
      expect(bar).not.toHaveAttribute('aria-labelledby');
    } finally {
      outside.remove();
    }
  });
});

describe('the indicator', () => {
  test.each([
    { given: 33, width: '33%' },
    { given: 0, width: '0%' },
    { given: 100, width: '100%' },
  ])('the width is $width for a value of $given', async ({ given, width }) => {
    const { indicator } = await mountParts({ root: { value: given } });
    expect(indicator.style.insetInlineStart).toBe('0px');
    expect(indicator.style.height).toBe('inherit');
    expect(indicator.style.width).toBe(width);
  });

  test('a style of the developer wins', async () => {
    const { indicator } = await mountParts({
      root: { value: 30 },
      indicator: { style: { width: '10px', color: 'red' } },
    });
    expect(indicator.style.width).toBe('10px');
    expect(indicator.style.color).toBe('red');
    expect(indicator.style.insetInlineStart).toBe('0px');
  });

  test('a positioned indicator starts at the right edge of a track in a right-to-left text', async () => {
    const { track, indicator } = await mountParts({
      root: { value: 25, dir: 'rtl' },
      indicator: { style: { position: 'absolute' } },
    });
    track.style.position = 'relative';
    track.style.width = '200px';
    track.style.height = '4px';
    const trackBox = track.getBoundingClientRect();
    const indicatorBox = indicator.getBoundingClientRect();
    expect(indicatorBox.right).toBe(trackBox.right);
    expect(indicatorBox.width).toBe(50);
  });
});

describe('accessibility', () => {
  test.each([null, 30, 100])('a root with a value of %s has no axe violation', async (given) => {
    const { root } = await mountParts({ root: { value: given } });
    await expectNoAxeViolations(root);
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('a part outside the root', () => {
  test('throws an error that names the part and the root', () => {
    expect(String(mountError(ProgressPartOutsideRoot))).toContain(
      'Vase UI Progress: <Progress.Value> must be inside <Progress.Root>.',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
