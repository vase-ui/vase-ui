import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { NumberField } from '@vase-ui/vue/number-field';
import { defineNumberFieldContextProbe } from '../../../test/fixtures/numberFieldContextProbe';
import { platform } from '../../common/platform';
import NumberFieldRootHydration from './NumberFieldRootHydration.test.vue';

// A module namespace is read-only. The mock gives `os` as a plain object, so a case can set `ios`.
vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');
  return { platform: { ...actual.platform, os: { ...actual.platform.os } } };
});

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? '';
}

function getRoot(html: string) {
  return tag(html, /<div[^>]*data-testid="root"[^>]*>/);
}

function getHiddenInput(html: string) {
  return tag(html, /<input[^>]*type="number"[^>]*>/);
}

// The server writes the empty string as the attribute `value` with no text.
function getValueAttribute(input: string) {
  const match = input.match(/ value(?:="([^"]*)")?(?=[ >])/);
  return match ? (match[1] ?? '') : undefined;
}

function getText(html: string) {
  return html.match(/<span data-testid="text">([^<]*)<\/span>/)?.[1];
}

describe('<NumberField.Root />', () => {
  describe('server-side rendering', () => {
    it.each([
      { name: 'a field with no number', props: {}, value: '' },
      { name: 'a number', props: { defaultValue: 1234.5 }, value: '1234.5' },
      { name: 'a controlled number', props: { value: 7 }, value: '7' },
      { name: 'a controlled field with no number', props: { value: null }, value: '' },
    ])('renders the hidden input for $name with no DOM', async ({ props, value }) => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<NumberFieldRootHydration {...props} />);
      const input = getHiddenInput(html);

      expect(getRoot(html)).not.toBe('');
      expect(getValueAttribute(input)).toBe(value);
      expect(input).toContain(' aria-hidden="true"');
      expect(input).toContain(' tabindex="-1"');
      expect(input).toContain(' step="1"');
    });

    it('renders the attributes of the props on the hidden input', async () => {
      const html = await renderToString(
        <NumberFieldRootHydration name="quantity" min={2} max={20} step={2} />,
      );
      const input = getHiddenInput(html);

      expect(input).toContain(' name="quantity"');
      expect(input).toContain(' min="2"');
      expect(input).toContain(' max="20"');
      expect(input).toContain(' step="2"');
      expect(input).toContain('position:absolute');
    });

    it('renders a hidden input with no name at zero size', async () => {
      const html = await renderToString(<NumberFieldRootHydration />);

      expect(getHiddenInput(html)).toContain('position:fixed');
      expect(getHiddenInput(html)).toContain('width:0');
      expect(getHiddenInput(html)).toContain('height:0');
    });

    it('renders no data attribute for the number and for the text', async () => {
      const html = await renderToString(<NumberFieldRootHydration defaultValue={1234.5} />);

      expect(getRoot(html)).not.toMatch(/ data-(?:value|inputvalue)[ =>]/);
    });

    it('renders the states of a field that is disabled, read-only and required', async () => {
      const html = await renderToString(<NumberFieldRootHydration disabled readOnly required />);
      const root = getRoot(html);
      const input = getHiddenInput(html);

      expect(root).toContain(' data-disabled');
      expect(root).toContain(' data-readonly');
      expect(root).toContain(' data-required');
      expect(/ disabled[ >]/.test(input)).toBe(true);
      expect(/ readonly[ >]/.test(input)).toBe(true);
      expect(/ required[ >]/.test(input)).toBe(true);
    });

    // A server cannot know the locale of the visitor, so the text has `en-US` when the root has no
    // `locale` prop.
    const percent = { style: 'percent' } as const;

    it.each([
      {
        name: 'the default locale',
        props: { defaultValue: 1234.5 },
        text: new Intl.NumberFormat('en-US').format(1234.5),
      },
      {
        name: 'the `locale` prop',
        props: { defaultValue: 1234.5, locale: 'de-DE' },
        text: new Intl.NumberFormat('de-DE').format(1234.5),
      },
      {
        name: 'the `format` prop',
        props: { defaultValue: 0.5, format: percent },
        text: new Intl.NumberFormat('en-US', percent).format(0.5),
      },
    ])('formats the text of the input with $name', async ({ props, text }) => {
      const html = await renderToString(<NumberFieldRootHydration {...props} />);

      expect(getText(html)).toBe(text);
    });

    it('renders `numeric` on iOS, because a server cannot know the platform', async () => {
      Object.defineProperty(platform.os, 'ios', { value: true, configurable: true });
      onTestFinished(() => {
        Object.defineProperty(platform.os, 'ios', { value: false, configurable: true });
      });
      const { Probe } = defineNumberFieldContextProbe();

      const html = await renderToString(
        <NumberField.Root min={0}>
          <Probe />
        </NumberField.Root>,
      );

      expect(tag(html, /<input[^>]*data-testid="text"[^>]*>/)).toContain(' inputmode="numeric"');
    });

    it.each([
      { name: 'a number', props: { defaultValue: 3 }, filled: true },
      { name: 'no number', props: {}, filled: false },
    ])('in a field, has `data-filled` only for $name', async ({ props, filled }) => {
      const html = await renderToString(<NumberFieldRootHydration inField {...props} />);

      expect(/ data-filled[ >]/.test(getRoot(html))).toBe(filled);
    });
  });
});
