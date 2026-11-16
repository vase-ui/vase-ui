import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { takeReportedMessages } from '../../../test/reportedMessages';
import { formatText } from '../../internals/date-time/calendar/formatText';

const hiddenInputOf = (html: string) =>
  /<input[^>]* aria-hidden="true"[^>]*>/.exec(html)?.[0] ?? '';

describe('<TimePicker.Root /> on a server', () => {
  it('has no DOM, and renders the field, the hidden input and the trigger with the value', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(
      <TimePicker.Root
        defaultValue={Temporal.PlainTime.from('15:04')}
        locale="en-US"
        name="start"
        required
      >
        <TimePicker.Field>
          <TimeField.Input />
        </TimePicker.Field>
        <TimePicker.Trigger>Open</TimePicker.Trigger>
      </TimePicker.Root>,
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('data-type="hour"');
    expect(hiddenInputOf(html)).toMatch(/^<input type="time" name="start"[^>]* value="15:04"/);
    expect(hiddenInputOf(html)).toMatch(/ required[ >]/);
    const text = formatText(
      Temporal.PlainTime.from('15:04'),
      { hour: 'numeric', minute: '2-digit' },
      'en-US',
    );
    expect(html).toMatch(
      new RegExp(`<button[^>]* aria-haspopup="dialog"[^>]* aria-label="Change time, ${text}"`),
    );
    expect(html).toMatch(/<button[^>]* aria-expanded="false"/);
  });

  it('names the trigger for a picker with no value, and for a time in a zone', async () => {
    const empty = await renderToString(
      <TimePicker.Root locale="en-US">
        <TimePicker.Trigger>Open</TimePicker.Trigger>
      </TimePicker.Root>,
    );
    const zoned = Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]');
    const inZone = await renderToString(
      <TimePicker.Root defaultValue={zoned} locale="en-US">
        <TimePicker.Trigger>Open</TimePicker.Trigger>
      </TimePicker.Root>,
    );

    expect(empty).toContain('aria-label="Choose time"');
    expect(inZone).toContain(
      `aria-label="Change time, ${formatText(zoned, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }, 'en-US')}"`,
    );
  });

  it('renders no popup, also for a popup that is open at the mount', async () => {
    const html = await renderToString(
      <TimePicker.Root defaultOpen defaultValue={Temporal.PlainTime.from('15:04')}>
        <TimePicker.Trigger>Open</TimePicker.Trigger>
        <TimePicker.Portal>
          <TimePicker.Positioner>
            <TimePicker.Popup aria-label="Choose time">
              <TimePicker.List />
              <TimePicker.Column unit="hour" />
              <TimePicker.Clock>Clock content</TimePicker.Clock>
            </TimePicker.Popup>
          </TimePicker.Positioner>
        </TimePicker.Portal>
      </TimePicker.Root>,
    );

    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain('Clock content');
  });

  it('renders a list, a column and a clock that are not in a popup, with the value', async () => {
    const html = await renderToString(
      <TimePicker.Root
        defaultValue={Temporal.PlainTime.from('09:00')}
        locale="en-US"
        hourCycle={12}
      >
        <TimePicker.List step={60} />
        <TimePicker.Column unit="minute" step={30} />
        <TimePicker.Clock>
          <span>Clock</span>
        </TimePicker.Clock>
      </TimePicker.Root>,
    );

    const nine = formatText(
      Temporal.PlainTime.from('09:00'),
      { hour: 'numeric', minute: '2-digit' },
      'en-US',
    );
    expect(html).toMatch(
      new RegExp(`<div[^>]* role="option"[^>]* aria-selected="true"[^>]*>${nine}</div>`),
    );
    expect(html.match(/role="option"/g)).toHaveLength(24 + 2);
    expect(html).toContain('role="group"');
  });

  it('gives the hidden input the type of the value', async () => {
    const html = await renderToString(
      <TimePicker.Root
        defaultValue={Temporal.PlainDateTime.from('2026-11-14T15:04')}
        locale="en-US"
        name="start"
      >
        <TimePicker.Field>
          <TimeField.Input />
        </TimePicker.Field>
      </TimePicker.Root>,
    );

    expect(hiddenInputOf(html)).toMatch(/^<input type="datetime-local" name="start"/);
    expect(hiddenInputOf(html)).toContain('value="2026-11-14T15:04"');
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
