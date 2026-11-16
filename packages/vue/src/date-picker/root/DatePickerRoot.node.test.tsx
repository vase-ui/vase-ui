import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { takeReportedMessages } from '../../../test/reportedMessages';
import { formatText } from '../../internals/date-time/calendar/formatText';

const hiddenInputOf = (html: string) =>
  /<input[^>]* aria-hidden="true"[^>]*>/.exec(html)?.[0] ?? '';

describe('<DatePicker.Root /> on a server', () => {
  it('has no DOM, and renders the field, the hidden input and the trigger with the value', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(
      <DatePicker.Root
        defaultValue={Temporal.PlainDate.from('2026-11-14')}
        locale="en-US"
        timeZone="UTC"
        name="when"
        required
      >
        <DatePicker.Field>
          <DateField.Input />
        </DatePicker.Field>
        <DatePicker.Trigger>Open</DatePicker.Trigger>
      </DatePicker.Root>,
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-valuetext="November"');
    expect(hiddenInputOf(html)).toMatch(/^<input type="date" name="when"[^>]* value="2026-11-14"/);
    expect(hiddenInputOf(html)).toMatch(/ required[ >]/);
    const fullDate = formatText(
      Temporal.PlainDate.from('2026-11-14'),
      { dateStyle: 'full' },
      'en-US',
    );
    expect(html).toMatch(
      new RegExp(`<button[^>]* aria-haspopup="dialog"[^>]* aria-label="Change date, ${fullDate}"`),
    );
    expect(html).toMatch(/<button[^>]* aria-expanded="false"/);
  });

  it('names the trigger for a picker with no value, and for a year and month', async () => {
    const empty = await renderToString(
      <DatePicker.Root locale="en-US">
        <DatePicker.Trigger>Open</DatePicker.Trigger>
      </DatePicker.Root>,
    );
    const month = await renderToString(
      <DatePicker.Root defaultValue={Temporal.PlainYearMonth.from('2026-11')} locale="en-US">
        <DatePicker.Trigger>Open</DatePicker.Trigger>
      </DatePicker.Root>,
    );

    expect(empty).toContain('aria-label="Choose date"');
    expect(month).toContain(
      `aria-label="Change date, ${formatText(Temporal.PlainYearMonth.from('2026-11'), { month: 'long', year: 'numeric' }, 'en-US')}"`,
    );
  });

  it('renders no popup, also for a popup that is open at the mount', async () => {
    const html = await renderToString(
      <DatePicker.Root defaultOpen defaultValue={Temporal.PlainDate.from('2026-11-14')}>
        <DatePicker.Trigger>Open</DatePicker.Trigger>
        <DatePicker.Portal>
          <DatePicker.Positioner>
            <DatePicker.Popup aria-label="Choose date">
              <DatePicker.Calendar today={Temporal.PlainDate.from('2026-11-14')}>
                Calendar content
              </DatePicker.Calendar>
            </DatePicker.Popup>
          </DatePicker.Positioner>
        </DatePicker.Portal>
      </DatePicker.Root>,
    );

    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('Calendar content');
  });

  it('gives the hidden input the type of the value', async () => {
    const html = await renderToString(
      <DatePicker.Root
        defaultValue={Temporal.PlainDateTime.from('2026-11-14T15:04')}
        locale="en-US"
        name="when"
      >
        <DatePicker.Field>
          <DateField.Input />
        </DatePicker.Field>
      </DatePicker.Root>,
    );

    expect(hiddenInputOf(html)).toMatch(/^<input type="datetime-local" name="when"/);
    expect(hiddenInputOf(html)).toContain('value="2026-11-14T15:04"');
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
