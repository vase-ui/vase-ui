import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { takeReportedMessages } from '../../../test/reportedMessages';
import { formatRangeText } from '../../internals/date-time/calendar/formatText';

const hiddenInputsOf = (html: string) =>
  [...html.matchAll(/<input[^>]* aria-hidden="true"[^>]*>/g)].map((match) => match[0]);

describe('<DateRangePicker.Root /> on a server', () => {
  it('has no DOM, and renders the two fields, the two hidden inputs and the trigger with the range', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(
      <DateRangePicker.Root
        defaultValue={[
          Temporal.PlainDate.from('2026-11-14'),
          Temporal.PlainDate.from('2026-11-20'),
        ]}
        locale="en-US"
        timeZone="UTC"
        startName="from"
        endName="to"
        required
      >
        <DateRangePicker.StartField>
          <DateField.Input />
        </DateRangePicker.StartField>
        <DateRangePicker.EndField>
          <DateField.Input />
        </DateRangePicker.EndField>
        <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
      </DateRangePicker.Root>,
    );

    expect(html.match(/role="group"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Start date"');
    expect(html).toContain('aria-label="End date"');
    const [start, end] = hiddenInputsOf(html);
    expect(start).toMatch(/^<input type="date" name="from"[^>]* value="2026-11-14"/);
    expect(end).toMatch(/^<input type="date" name="to"[^>]* value="2026-11-20"/);
    expect(start).toMatch(/ required[ >]/);
    expect(end).toMatch(/ required[ >]/);
    // The end field is invalid before the first day of the range.
    expect(end).toContain('min="2026-11-14"');
    const fullRange = formatRangeText(
      Temporal.PlainDate.from('2026-11-14'),
      Temporal.PlainDate.from('2026-11-20'),
      { dateStyle: 'full' },
      'en-US',
    );
    expect(html).toMatch(
      new RegExp(
        `<button[^>]* aria-haspopup="dialog"[^>]* aria-label="Change dates, ${fullRange}"`,
      ),
    );
    expect(html).toMatch(/<button[^>]* aria-expanded="false"/);
  });

  it('names the trigger for a picker with no range, and for a range with one end', async () => {
    const empty = await renderToString(
      <DateRangePicker.Root locale="en-US">
        <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
      </DateRangePicker.Root>,
    );
    const one = await renderToString(
      <DateRangePicker.Root
        defaultValue={[Temporal.PlainDate.from('2026-11-14'), null]}
        locale="en-US"
      >
        <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
      </DateRangePicker.Root>,
    );

    expect(empty).toContain('aria-label="Choose dates"');
    expect(one).toContain('aria-label="Choose dates"');
  });

  it('renders no popup, also for a popup that is open at the mount', async () => {
    const html = await renderToString(
      <DateRangePicker.Root
        defaultOpen
        defaultValue={[
          Temporal.PlainDate.from('2026-11-14'),
          Temporal.PlainDate.from('2026-11-20'),
        ]}
      >
        <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
        <DateRangePicker.Portal>
          <DateRangePicker.Positioner>
            <DateRangePicker.Popup aria-label="Choose dates">
              <DateRangePicker.Calendar today={Temporal.PlainDate.from('2026-11-14')}>
                Calendar content
              </DateRangePicker.Calendar>
            </DateRangePicker.Popup>
          </DateRangePicker.Positioner>
        </DateRangePicker.Portal>
      </DateRangePicker.Root>,
    );

    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('Calendar content');
  });

  it('gives each hidden input the type of its end', async () => {
    const html = await renderToString(
      <DateRangePicker.Root
        defaultValue={[
          Temporal.PlainDateTime.from('2026-11-14T09:30'),
          Temporal.PlainDateTime.from('2026-11-20T17:45'),
        ]}
        locale="en-US"
        startName="from"
        endName="to"
      >
        <DateRangePicker.StartField>
          <DateField.Input />
        </DateRangePicker.StartField>
        <DateRangePicker.EndField>
          <DateField.Input />
        </DateRangePicker.EndField>
      </DateRangePicker.Root>,
    );

    const [start, end] = hiddenInputsOf(html);
    expect(start).toMatch(/^<input type="datetime-local" name="from"/);
    expect(start).toContain('value="2026-11-14T09:30"');
    expect(end).toMatch(/^<input type="datetime-local" name="to"/);
    expect(end).toContain('value="2026-11-20T17:45"');
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

    const { DateRangePicker: DateRangePickerWithoutTemporal } =
      await import('@vase-ui/vue/date-range-picker');

    await expect(renderToString(<DateRangePickerWithoutTemporal.Root />)).rejects.toThrow(
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
