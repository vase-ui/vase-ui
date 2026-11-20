import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Popover } from '@vase-ui/vue/popover';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { takeReportedMessages } from '../../test/reportedMessages';
import { useTemporalPolyfill } from '../../test/temporalPolyfill';

const formInputOf = (html: string) => /<input[^>]* aria-hidden="true"[^>]*>/.exec(html)?.[0] ?? '';
const nativeTemporal = globalThis.Temporal;

const SERVER_CASES: Record<string, () => VNode> = {
  'an open picker with a time': () => (
    <TimePicker.Root
      defaultOpen
      defaultValue={Temporal.PlainTime.from('15:04')}
      name="start"
      required
    >
      <TimePicker.Field>
        <TimeField.Input />
      </TimePicker.Field>
      <TimePicker.Trigger aria-label="Choose time">Open</TimePicker.Trigger>
      <Popover.Portal>
        <TimePicker.Positioner>
          <TimePicker.Popup aria-label="Choose a time">
            <TimePicker.List aria-label="Times" />
            <TimePicker.Clock>Clock content</TimePicker.Clock>
          </TimePicker.Popup>
        </TimePicker.Positioner>
      </Popover.Portal>
    </TimePicker.Root>
  ),
  'a list and a column outside a popup': () => (
    <TimePicker.Root defaultValue={Temporal.PlainTime.from('09:00')} hourCycle={12}>
      <TimePicker.List step={60} aria-label="Times" />
      <TimePicker.Column unit="minute" step={30} />
    </TimePicker.Root>
  ),
  'a date and time': () => (
    <TimePicker.Root defaultValue={Temporal.PlainDateTime.from('2026-11-14T15:04')} name="start">
      <TimePicker.Field>
        <TimeField.Input />
      </TimePicker.Field>
    </TimePicker.Root>
  ),
};

async function renderServerCases() {
  const html: Record<string, string> = {};
  for (const [name, createCase] of Object.entries(SERVER_CASES)) {
    html[name] = await renderToString(createCase());
  }
  return html;
}

describe('<TimePicker.Root /> on a server', () => {
  it('has no DOM, and renders the field and the trigger, and no popup also for an open root', async () => {
    expect(typeof document).toBe('undefined');
    const html = await renderToString(SERVER_CASES['an open picker with a time']!());
    expect(formInputOf(html)).toMatch(/^<input type="time" name="start"[^>]* value="15:04"/);
    expect(formInputOf(html)).toMatch(/ required[ >]/);
    expect(html).toMatch(
      /<button[^>]* aria-haspopup="dialog"[^>]* aria-expanded="true"[^>]* aria-label="Choose time"/,
    );
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain('Clock content');
  });

  it('renders a list and a column that are not in a popup, with the value and one tab stop in each', async () => {
    const html = await renderToString(SERVER_CASES['a list and a column outside a popup']!());
    expect(html).toMatch(
      /<button[^>]* role="option" aria-selected="true" tabindex="0" data-allow-mismatch="text"[^>]*>9:00 AM<\/button>/,
    );
    expect(html.match(/role="option"/g)).toHaveLength(24 + 2);
    expect(html.match(/tabindex="0"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="minute"');
  });

  it('gives the form input the type of the value', async () => {
    const html = await renderToString(SERVER_CASES['a date and time']!());
    expect(formInputOf(html)).toMatch(/^<input type="datetime-local" name="start"/);
    expect(formInputOf(html)).toContain('value="2026-11-14T15:04"');
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

describe('the time picker with no Temporal', () => {
  // A case that throws in `setup` is the last of its file.
  it('loads its entry point, and a root throws when it renders', async () => {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.resetModules();
    const { TimePicker: TimePickerWithoutTemporal } = await import('@vase-ui/vue/time-picker');
    await expect(renderToString(<TimePickerWithoutTemporal.Root />)).rejects.toThrow(
      new Error(
        'Vase UI: <TimePicker.Root> needs the global `Temporal`, and this JavaScript engine does not have it. ' +
          'The part cannot make or compare a date without it. ' +
          'Load a Temporal polyfill, such as `temporal-polyfill/global`, before the app mounts.',
      ),
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
