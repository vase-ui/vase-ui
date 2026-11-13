import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Tabs } from '@vase-ui/vue/tabs';
import TabsIndicatorHydration from '../indicator/TabsIndicatorHydration.test.vue';
import TabsRootHydration from './TabsRootHydration.test.vue';

/** The start tag of the element that has the selector text. */
function findTag(html: string, selector: string) {
  return html.match(new RegExp(`<[^>]*${selector}[^>]*>`))?.[0];
}

function readTag(html: string, selector: string) {
  const tag = findTag(html, selector);
  if (tag === undefined) {
    throw new Error(`The HTML has no element with ${selector}:\n${html}`);
  }
  return tag;
}

// The attribute order in the HTML is not part of the test.
function readAttribute(html: string, selector: string, name: string) {
  return findTag(html, selector)?.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
}

// Vue writes a Boolean attribute, and an attribute with an empty value, with no `=` on a server.
function hasBareAttribute(tag: string, name: string) {
  return new RegExp(` ${name}(?=[ >/])`).test(tag);
}

function readTabindexes(html: string) {
  return ['a', 'b', 'c'].map((testId) =>
    readAttribute(html, `data-testid="${testId}"`, 'tabindex'),
  );
}

describe('<Tabs.Root />', () => {
  describe('server-side rendering', () => {
    it('renders the tabs with no DOM', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<TabsRootHydration defaultValue="b" />);

      expect(html).toContain('role="tablist"');
      expect(readAttribute(html, 'data-testid="b"', 'aria-selected')).toBe('true');
    });

    it.each([
      { name: 'an explicit default value', props: { defaultValue: 'b' }, stop: 1 },
      {
        name: 'a controlled value, vertical',
        props: { value: 'c', orientation: 'vertical' },
        stop: 2,
      },
      { name: 'a selected disabled tab', props: { value: 'a', firstDisabled: true }, stop: 0 },
      { name: 'a value of null', props: { value: null }, stop: 0 },
      {
        name: 'a value of null, first disabled',
        props: { value: null, firstDisabled: true },
        stop: 0,
      },
      {
        name: 'a default value of null, first disabled',
        props: { defaultValue: null, firstDisabled: true },
        stop: 0,
      },
      { name: 'the implicit default, numbers', props: { numeric: true }, stop: 0 },
      { name: 'the implicit default, strings', props: {}, stop: 0 },
      { name: 'the implicit default, first disabled', props: { firstDisabled: true }, stop: 1 },
      // A server cannot tell which tab a value names when no tab has that value.
      { name: 'a value that names no tab', props: { value: 'zzz' }, stop: undefined },
    ] as const)('gives the tab stop for $name', async ({ props, stop }) => {
      const html = await renderToString(<TabsRootHydration {...props} />);

      expect(readTabindexes(html)).toEqual([0, 1, 2].map((index) => (index === stop ? '0' : '-1')));
    });

    it('renders the open panel, a hidden panel that stays mounted and no other panel', async () => {
      const html = await renderToString(
        <Tabs.Root defaultValue="a">
          <Tabs.List>
            <Tabs.Tab value="a" />
            <Tabs.Tab value="b" />
            <Tabs.Tab value="c" />
          </Tabs.List>
          <Tabs.Panel value="a" data-testid="open" />
          <Tabs.Panel value="b" keepMounted data-testid="hidden" />
          <Tabs.Panel value="c" data-testid="unmounted" />
        </Tabs.Root>,
      );
      const open = readTag(html, 'data-testid="open"');
      const hidden = readTag(html, 'data-testid="hidden"');

      expect(open).toContain(' tabindex="0"');
      expect(hasBareAttribute(open, 'hidden')).toBe(false);
      expect(hasBareAttribute(open, 'inert')).toBe(false);
      expect(hasBareAttribute(open, 'data-hidden')).toBe(false);
      // A panel that is open in the server HTML does not animate in.
      expect(hasBareAttribute(open, 'data-starting-style')).toBe(false);

      expect(hidden).toContain(' tabindex="-1"');
      expect(hasBareAttribute(hidden, 'hidden')).toBe(true);
      expect(hasBareAttribute(hidden, 'inert')).toBe(true);
      expect(hasBareAttribute(hidden, 'data-hidden')).toBe(true);

      expect(html).not.toContain('data-testid="unmounted"');
    });

    it.each([
      { name: 'a panel after the list', panel: 'after', controls: undefined, labelledby: 'tab-a' },
      {
        name: 'a panel before the list',
        panel: 'before',
        controls: 'panel-a',
        labelledby: undefined,
      },
    ] as const)(
      'gives only the second part the id of the first part, $name',
      async ({ panel, controls, labelledby }) => {
        const html = await renderToString(<TabsRootHydration defaultValue="a" panel={panel} />);

        expect(readAttribute(html, 'data-testid="a"', 'aria-controls')).toBe(controls);
        expect(readAttribute(html, 'id="panel-a"', 'aria-labelledby')).toBe(labelledby);
      },
    );

    it('renders a hidden indicator with no style, and the script directly after it', async () => {
      const html = await renderToString(<TabsIndicatorHydration renderBeforeHydration />);
      const tag = readTag(html, 'data-testid="indicator"');

      expect(tag).toContain(' role="presentation"');
      expect(hasBareAttribute(tag, 'hidden')).toBe(true);
      expect(tag).not.toContain(' style=');
      expect(html).toMatch(
        /<span [^>]*data-testid="indicator"[^>]*>(<!--[[\]]-->)*<\/span><script>/,
      );
    });

    it('allows the style and the attributes that the script changes, only with the script', async () => {
      const withScript = readTag(
        await renderToString(<TabsIndicatorHydration renderBeforeHydration />),
        'data-testid="indicator"',
      );
      const withoutScript = readTag(
        await renderToString(<TabsIndicatorHydration />),
        'data-testid="indicator"',
      );

      expect(withScript).toContain(' data-allow-mismatch="style,attribute"');
      expect(withoutScript).not.toContain('data-allow-mismatch');
    });

    it('renders no script without `renderBeforeHydration`', async () => {
      const html = await renderToString(<TabsIndicatorHydration />);

      expect(html).toContain('data-testid="indicator"');
      expect(html).not.toContain('<script');
    });

    it('renders no indicator and no script when the value is null', async () => {
      const html = await renderToString(
        <TabsIndicatorHydration value={null} renderBeforeHydration />,
      );

      expect(html).toContain('role="tablist"');
      expect(html).not.toContain('data-testid="indicator"');
      expect(html).not.toContain('<script');
    });

    it('sets the orientation and the activation direction of the indicator', async () => {
      const html = await renderToString(<TabsIndicatorHydration />);
      const tag = readTag(html, 'data-testid="indicator"');

      expect(tag).toContain(' data-orientation="horizontal"');
      expect(tag).toContain(' data-activation-direction="none"');
    });
  });
});
