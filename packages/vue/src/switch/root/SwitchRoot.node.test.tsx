import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Switch } from '@vase-ui/vue/switch';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import SwitchRootHydration from './SwitchRootHydration.test.vue';

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? '';
}

describe('<Switch.Root />', () => {
  describe('server-side rendering', () => {
    it.each([
      { name: 'a switch that is off', props: {}, checked: false },
      { name: 'a switch that is on', props: { defaultChecked: true }, checked: true },
      { name: 'a controlled switch that is on', props: { checked: true }, checked: true },
    ])('renders $name with no DOM', async ({ props, checked }) => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<SwitchRootHydration name="notifications" {...props} />);
      const root = tag(html, /<span[^>]*role="switch"[^>]*>/);
      const thumb = tag(html, /<span[^>]*data-testid="thumb"[^>]*>/);
      const input = tag(html, /<input[^>]*type="checkbox"[^>]*>/);

      expect(root).toContain(` aria-checked="${checked}"`);
      expect(root).toContain(' aria-label="Notifications"');
      expect(root).toContain(' tabindex="0"');
      expect(/ data-checked[ >]/.test(root)).toBe(checked);
      expect(/ data-unchecked[ >]/.test(root)).toBe(!checked);
      expect(/ data-checked[ >]/.test(thumb)).toBe(checked);
      expect(/ checked[ >]/.test(input)).toBe(checked);
      expect(input).toContain(' name="notifications"');
      expect(input).toContain(' aria-hidden="true"');
      expect(input).toContain(' tabindex="-1"');
      expect(input).not.toContain(' value=');
    });

    it.each([
      { name: 'the unchecked value when off', props: {}, hidden: true },
      {
        name: 'no unchecked value when on',
        props: { defaultChecked: true },
        hidden: false,
      },
      {
        name: 'no unchecked value with no name',
        props: { name: undefined },
        hidden: false,
      },
    ])('renders $name', async ({ props, hidden }) => {
      const html = await renderToString(
        <SwitchRootHydration name="notifications" value="yes" uncheckedValue="no" {...props} />,
      );

      expect(html.includes('<input type="hidden" name="notifications" value="no">')).toBe(hidden);
      expect(tag(html, /<input[^>]*type="checkbox"[^>]*>/)).toContain(' value="yes"');
    });

    it('renders the states of a switch that is disabled, read-only and required', async () => {
      const html = await renderToString(<SwitchRootHydration disabled readOnly required />);
      const root = tag(html, /<span[^>]*role="switch"[^>]*>/);
      const input = tag(html, /<input[^>]*type="checkbox"[^>]*>/);

      expect(root).toContain(' aria-disabled="true"');
      expect(root).toContain(' aria-readonly="true"');
      expect(root).toContain(' aria-required="true"');
      expect(root).toContain(' data-disabled');
      expect(root).toContain(' data-readonly');
      expect(root).toContain(' data-required');
      expect(/ disabled[ >]/.test(root)).toBe(false);
      expect(/ disabled[ >]/.test(input)).toBe(true);
      expect(/ required[ >]/.test(input)).toBe(true);
    });

    it.each([
      { name: 'before the switch', label: 'before' as const },
      { name: 'after the switch', label: 'after' as const },
    ])('names the switch with a label of the provider $name', async ({ label }) => {
      const html = await renderToString(<SwitchRootHydration label={label} />);
      const root = tag(html, /<span[^>]*role="switch"[^>]*>/);
      const input = tag(html, /<input[^>]*type="checkbox"[^>]*>/);
      const labelTag = tag(html, /<label[^>]*data-testid="label"[^>]*>/);
      const labelId = labelTag.match(/ id="([^"]+)"/)?.[1];
      const inputId = input.match(/ id="([^"]+)"/)?.[1];

      expect(labelId).toBeTruthy();
      expect(root).toContain(` aria-labelledby="${labelId}"`);
      expect(labelTag).toContain(` for="${inputId}"`);
    });

    it('gives the switch no `aria-labelledby` from a native label, which a server cannot find', async () => {
      const html = await renderToString(<SwitchRootHydration label="native" />);

      expect(tag(html, /<span[^>]*role="switch"[^>]*>/)).not.toContain('aria-labelledby');
    });

    it('gives the id of the control to a native button and not to the input', async () => {
      const html = await renderToString(<SwitchRootHydration label="before" nativeButton />);
      const root = tag(html, /<button[^>]*role="switch"[^>]*>/);
      const input = tag(html, /<input[^>]*type="checkbox"[^>]*>/);
      const labelFor = tag(html, /<label[^>]*data-testid="label"[^>]*>/).match(
        / for="([^"]+)"/,
      )?.[1];

      expect(labelFor).toBeTruthy();
      expect(root).toContain(` id="${labelFor}"`);
      expect(input).not.toContain(' id=');
    });

    it.each([
      { name: 'has `data-filled` for a switch on', defaultChecked: true },
      { name: 'has no `data-filled` for a switch off', defaultChecked: false },
    ])('in a field, $name', async ({ defaultChecked }) => {
      const html = await renderToString(
        <FieldScope>
          <Switch.Root defaultChecked={defaultChecked} />
        </FieldScope>,
      );

      expect(/ data-filled[ >]/.test(tag(html, /<span[^>]*role="switch"[^>]*>/))).toBe(
        defaultChecked,
      );
    });
  });
});
