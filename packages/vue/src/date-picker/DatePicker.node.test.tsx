import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Calendar } from '@vase-ui/vue/calendar';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Popover } from '@vase-ui/vue/popover';
import { takeReportedMessages } from '../../test/reportedMessages';
import { useTemporalPolyfill } from '../../test/temporalPolyfill';

const formInputOf = (html: string) => /<input[^>]* aria-hidden="true"[^>]*>/.exec(html)?.[0] ?? '';
const nativeTemporal = globalThis.Temporal;

// Each case reads `Temporal` when it runs: the native one first, and then the polyfill.
const SERVER_CASES: Record<string, () => VNode> = {
  'an open picker with a date': () => (
    <DatePicker.Root defaultOpen defaultValue={Temporal.PlainDate.from('2026-11-18')} name="when" required>
      <DatePicker.Field>
        <DateField.Input />
      </DatePicker.Field>
      <DatePicker.Trigger aria-label="Choose date">Open</DatePicker.Trigger>
      <Popover.Portal>
        <DatePicker.Positioner>
          <DatePicker.Popup aria-label="Choose a date">Popup content</DatePicker.Popup>
        </DatePicker.Positioner>
      </Popover.Portal>
    </DatePicker.Root>
  ),
  'a calendar outside a popup': () => (
    <DatePicker.Root defaultValue={Temporal.PlainDate.from('2026-11-18')} locale="de-DE">
      <DatePicker.Calendar>
        <Calendar.Months
          v-slots={{ month: ({ month }: { month: Calendar.Month.Props['month'] }) => <Calendar.Month month={month}><Calendar.Caption /></Calendar.Month> }}
        />
      </DatePicker.Calendar>
    </DatePicker.Root>
  ),
  'a date and time in a zone': () => (
    <DatePicker.Root
      defaultValue={Temporal.ZonedDateTime.from('2026-11-18T15:04[Asia/Tokyo]')}
      name="when"
    >
      <DatePicker.Field>
        <DateField.Input />
      </DatePicker.Field>
    </DatePicker.Root>
  ),
};

async function renderServerCases() {
  const html: Record<string, string> = {};
  for (const [name, createCase] of Object.entries(SERVER_CASES)) {
    html[name] = await renderToString(createCase());
  }
  return html;
}

describe('<DatePicker.Root /> on a server', () => {
  it('has no DOM, reads no clock, and renders the field and the trigger, and no popup also for an open root', async () => {
    expect(typeof document).toBe('undefined');
    const clock = vi.spyOn(Temporal.Now, 'plainDateISO');
    const html = await renderToString(SERVER_CASES['an open picker with a date']!());
    expect(clock).not.toHaveBeenCalled();
    clock.mockRestore();
    expect(html).toContain('role="group"');
    expect(formInputOf(html)).toMatch(/^<input type="date" name="when"[^>]* value="2026-11-18"/);
    expect(formInputOf(html)).toMatch(/ required[ >]/);
    expect(html).toMatch(/<button[^>]* aria-haspopup="dialog"[^>]* aria-expanded="true"[^>]* aria-label="Choose date"/);
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('Popup content');
  });

  it('renders a calendar that is not in a popup, with its page', async () => {
    const html = await renderToString(SERVER_CASES['a calendar outside a popup']!());
    expect(html).toContain('November 2026');
  });

  it('gives the form input the type of the value', async () => {
    const html = await renderToString(SERVER_CASES['a date and time in a zone']!());
    expect(formInputOf(html)).toMatch(/^<input type="text" name="when"/);
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

describe('the date picker with no Temporal', () => {
  // A case that throws in `setup` is the last of its file.
  it('loads its entry point, and a root throws when it renders', async () => {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.resetModules();
    const { DatePicker: DatePickerWithoutTemporal } = await import('@vase-ui/vue/date-picker');
    await expect(renderToString(<DatePickerWithoutTemporal.Root />)).rejects.toThrow(
      new Error(
        'Vase UI: <DatePicker.Root> needs the global `Temporal`, and this JavaScript engine does not have it. ' +
          'The part cannot make or compare a date without it. ' +
          'Load a Temporal polyfill, such as `temporal-polyfill/global`, before the app mounts.',
      ),
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
