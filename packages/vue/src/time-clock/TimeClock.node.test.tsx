import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { TimeClock } from '@vase-ui/vue/time-clock';
import type { TimeClockFaceNumber } from '@vase-ui/vue/time-clock';
import { mockRuntimeDateTimeLocale } from '../../test/mockRuntimeLocale';
import { takeReportedMessages } from '../../test/reportedMessages';
import { useTemporalPolyfill } from '../../test/temporalPolyfill';

// Vue writes a comment around each fragment and slot.
const removeComments = (html: string) => html.replace(/<!--.*?-->/g, '');

const clock = (props: Record<string, unknown> = {}) => (
  <TimeClock.Root defaultValue={Temporal.PlainTime.from('15:30')} {...props}>
    <TimeClock.ViewTrigger view="hour" />
    <TimeClock.DayPeriod value="pm" />
    <TimeClock.Face>
      {{
        default: () => <TimeClock.Hand />,
        number: ({ number }: { number: TimeClockFaceNumber }) =>
          number.value === 3 ? <TimeClock.Number number={number} /> : null,
      }}
    </TimeClock.Face>
  </TimeClock.Root>
);

describe('<TimeClock.Root /> on a server', () => {
  it('renders the variables of the hand and of a number, the texts, and the values of the range input', async () => {
    expect(typeof document).toBe('undefined');
    const html = removeComments(await renderToString(clock()));
    expect(html).toContain('--time-clock-hand-angle:90deg');
    expect(html).toContain('--time-clock-number-angle:90deg');
    expect(html).toMatch(/<span[^>]*>3<\/span>/);
    expect(html).toMatch(/aria-label="hour 03"[^>]*>03<\/button>/);
    expect(html).toMatch(/>PM<\/button>/);
    expect(html).toMatch(/<input type="range" min="1" max="12" step="1" value="3"/);
  });

  it('renders the buttons of another tag in `as` with the role `button` and no `type`', async () => {
    const html = removeComments(
      await renderToString(
        <TimeClock.Root defaultValue={Temporal.PlainTime.from('15:30')}>
          <TimeClock.ViewTrigger as="span" view="hour" />
          <TimeClock.DayPeriod as="span" value="pm" />
        </TimeClock.Root>,
      ),
    );
    expect(html.match(/<span role="button" tabindex="0"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<span[^>]* type=/);
  });

  it('renders for en-US, and not for the locale of the runtime', async () => {
    mockRuntimeDateTimeLocale('de-DE');
    const html = removeComments(await renderToString(clock()));
    expect(html).toContain('>PM</button>');
    expect(html).toContain('max="12"');
  });

  it('renders the same server HTML with a Temporal polyfill', async () => {
    const native = await renderToString(clock({ hourCycle: 24 }));
    useTemporalPolyfill();
    expect(await renderToString(clock({ hourCycle: 24 }))).toBe(native);
  });
});

describe('the clock with no Temporal', () => {
  // A case that throws in `setup` is the last of its file.
  it('loads its entry point, and the root throws when it renders', async () => {
    vi.stubGlobal('Temporal', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    vi.resetModules();
    const { TimeClock: TimeClockWithoutTemporal } = await import('@vase-ui/vue/time-clock');
    await expect(renderToString(<TimeClockWithoutTemporal.Root />)).rejects.toThrow(
      'Vase UI: <TimeClock.Root> needs the global `Temporal`',
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
