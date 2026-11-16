import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { TimeClock } from '@vase-ui/vue/time-clock';
import type { TimeClockFaceNumber } from '@vase-ui/vue/time-clock';
import { mockRuntimeDateTimeLocale } from '../../../test/mockRuntimeLocale';
import { takeReportedMessages } from '../../../test/reportedMessages';

// Vue writes a comment around each fragment and slot.
function removeComments(html: string) {
  return html.replace(/<!--.*?-->/g, '');
}

// Only the numbers with a value in `shown` render, so that the HTML stays short.
function numberSlot(...shown: number[]) {
  return {
    number: ({ number }: { number: TimeClockFaceNumber }) =>
      shown.includes(number.value) ? <TimeClock.Number number={number} /> : null,
  };
}

describe('<TimeClock.Root /> on a server', () => {
  it('renders the variables of the hand and of a number, and the values of the range input', async () => {
    const html = removeComments(
      await renderToString(
        <TimeClock.Root
          locale="en-US"
          hourCycle={12}
          defaultValue={Temporal.PlainTime.from('10:30')}
        >
          <TimeClock.Face v-slots={{ default: () => <TimeClock.Hand />, ...numberSlot(3, 12) }} />
        </TimeClock.Root>,
      ),
    );

    expect(html).toContain(
      '<div data-view="hour" aria-hidden="true" style="--time-clock-hand-angle:300deg;--time-clock-hand-length:1;"></div>',
    );
    expect(html).toContain(
      '<span data-view="hour" aria-hidden="true" data-allow-mismatch="text" style="--time-clock-number-angle:90deg;--time-clock-number-radius:1;">3</span>',
    );
    expect(html).toContain(
      '<span data-view="hour" aria-hidden="true" data-allow-mismatch="text" style="--time-clock-number-angle:0deg;--time-clock-number-radius:1;">12</span>',
    );
    expect(html).toMatch(
      /<input aria-label="hour" aria-valuenow="10" aria-valuetext="10 hours" autocomplete="off" max="12" min="1" step="1" style="[^"]*" type="range" value="10">/,
    );
    expect(html).toContain('style="touch-action:none;"');
  });

  it('renders the inner ring of a 24-hour face', async () => {
    const html = removeComments(
      await renderToString(
        <TimeClock.Root
          locale="en-US"
          hourCycle={24}
          defaultValue={Temporal.PlainTime.from('15:00')}
        >
          <TimeClock.Face v-slots={{ default: () => <TimeClock.Hand />, ...numberSlot(15, 0) }} />
        </TimeClock.Root>,
      ),
    );

    expect(html).toContain('style="--time-clock-hand-angle:90deg;--time-clock-hand-length:0.64;"');
    expect(html).toContain(
      '<span data-view="hour" data-selected data-inner aria-hidden="true" data-allow-mismatch="text" style="--time-clock-number-angle:90deg;--time-clock-number-radius:0.64;">15</span>',
    );
    expect(html).toContain(
      'style="--time-clock-number-angle:0deg;--time-clock-number-radius:0.64;">00</span>',
    );
    expect(html).toContain('max="23" min="0"');
    expect(html).toContain('value="15"');
  });

  it('renders the unit and the number of the minutes view', async () => {
    const html = removeComments(
      await renderToString(
        <TimeClock.Root
          locale="en-US"
          defaultView="minute"
          minuteStep={5}
          defaultValue={Temporal.PlainTime.from('10:35')}
        >
          <TimeClock.ViewTrigger view="minute" />
          <TimeClock.Face v-slots={{ default: () => <TimeClock.Hand />, ...numberSlot(35) }} />
        </TimeClock.Root>,
      ),
    );

    expect(html).toContain('style="--time-clock-hand-angle:210deg;--time-clock-hand-length:1;"');
    expect(html).not.toContain('data-between-numbers');
    expect(html).toContain('aria-label="minute 35"');
    expect(html).toContain('aria-valuetext="35 minutes"');
    expect(html).toContain('max="59" min="0" step="5"');
  });

  it('renders no hand, and placeholders, while the clock has no value', async () => {
    const html = removeComments(
      await renderToString(
        <TimeClock.Root locale="en-US">
          <TimeClock.ViewTrigger view="hour" />
          <TimeClock.Face v-slots={{ default: () => <TimeClock.Hand /> }} />
        </TimeClock.Root>,
      ),
    );

    expect(html).not.toContain('--time-clock-hand');
    expect(html).toContain('aria-label="hour"');
    expect(html).toContain('>--</button>');
    expect(html).toContain('data-empty');
  });

  it('renders the day periods of a 12-hour clock and not of a 24-hour clock', async () => {
    const parts = (hourCycle: 12 | 24) => (
      <TimeClock.Root locale="en-US" hourCycle={hourCycle}>
        <TimeClock.DayPeriod value="am" />
        <TimeClock.DayPeriod value="pm" />
      </TimeClock.Root>
    );

    const twelve = removeComments(await renderToString(parts(12)));
    const twentyFour = removeComments(await renderToString(parts(24)));

    expect(twelve).toContain('>AM</button>');
    expect(twelve).toContain('>PM</button>');
    expect(twentyFour).not.toContain('button');
  });

  it('renders for en-US, and not for the runtime locale', async () => {
    mockRuntimeDateTimeLocale('de-DE');

    const html = removeComments(
      await renderToString(
        <TimeClock.Root defaultValue={Temporal.PlainTime.from('15:00')}>
          <TimeClock.DayPeriod value="pm" />
          <TimeClock.Face />
        </TimeClock.Root>,
      ),
    );

    expect(html).toContain('>PM</button>');
    expect(html).toContain('max="12" min="1"');
  });

  // The case that throws in `setup` is the last of the file.
  it('imports with no Temporal, and throws the message when it renders', async () => {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.resetModules();

    const family = await import('../index');

    await expect(renderToString(<family.TimeClock.Root />)).rejects.toThrow(
      new Error(
        'Vase UI: <TimeClock.Root> needs the global `Temporal`, and this JavaScript engine does not have it. ' +
          'The part cannot make or compare a date without it. ' +
          'Load a Temporal polyfill, such as `temporal-polyfill/global`, before the app mounts.',
      ),
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
