import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Popover } from '@vase-ui/vue/popover';
import { takeReportedMessages } from '../../test/reportedMessages';
import { useTemporalPolyfill } from '../../test/temporalPolyfill';

const formInputsOf = (html: string) => html.match(/<input[^>]* aria-hidden="true"[^>]*>/g) ?? [];
const nativeTemporal = globalThis.Temporal;

const SERVER_CASES: Record<string, () => VNode> = {
  'an open picker with a range': () => (
    <DateRangePicker.Root
      defaultOpen
      defaultValue={[Temporal.PlainDate.from('2026-11-18'), Temporal.PlainDate.from('2026-11-20')]}
      startName="from"
      endName="to"
    >
      <DateRangePicker.StartField aria-label="Start date">
        <DateField.Input />
      </DateRangePicker.StartField>
      <DateRangePicker.EndField aria-label="End date">
        <DateField.Input />
      </DateRangePicker.EndField>
      <DateRangePicker.Trigger aria-label="Choose dates">Open</DateRangePicker.Trigger>
      <Popover.Portal>
        <DateRangePicker.Positioner>
          <DateRangePicker.Popup aria-label="Choose dates">Popup content</DateRangePicker.Popup>
        </DateRangePicker.Positioner>
      </Popover.Portal>
    </DateRangePicker.Root>
  ),
};

async function renderServerCases() {
  const html: Record<string, string> = {};
  for (const [name, createCase] of Object.entries(SERVER_CASES)) {
    html[name] = await renderToString(createCase());
  }
  return html;
}

describe('<DateRangePicker.Root /> on a server', () => {
  it('has no DOM, and renders the two fields with their names and the trigger, and no popup also for an open root', async () => {
    expect(typeof document).toBe('undefined');
    const html = await renderToString(SERVER_CASES['an open picker with a range']!());
    const [start, end] = formInputsOf(html);
    expect(start).toMatch(/^<input type="date" name="from"[^>]* value="2026-11-18"/);
    expect(end).toMatch(/^<input type="date" name="to"[^>]* value="2026-11-20"/);
    // An end before the first end makes the end field invalid.
    expect(end).toContain('min="2026-11-18"');
    expect(html).toMatch(/<button[^>]* aria-haspopup="dialog"[^>]* aria-expanded="true"[^>]* aria-label="Choose dates"/);
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('Popup content');
  });
});

describe('a Temporal polyfill', () => {
  it('renders the same server HTML as the native Temporal', async () => {
    const nativeHtml = await renderServerCases();
    useTemporalPolyfill();
    expect(Temporal).not.toBe(nativeTemporal);
    expect(await renderServerCases()).toEqual(nativeHtml);
  });
});

describe('the date range picker with no Temporal', () => {
  // A case that throws in `setup` is the last of its file.
  it('loads its entry point, and a root throws when it renders', async () => {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.resetModules();
    const { DateRangePicker: WithoutTemporal } = await import('@vase-ui/vue/date-range-picker');
    await expect(renderToString(<WithoutTemporal.Root />)).rejects.toThrow(
      new Error(
        'Vase UI: <DateRangePicker.Root> needs the global `Temporal`, and this JavaScript engine does not have it. ' +
          'The part cannot make or compare a date without it. ' +
          'Load a Temporal polyfill, such as `temporal-polyfill/global`, before the app mounts.',
      ),
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
