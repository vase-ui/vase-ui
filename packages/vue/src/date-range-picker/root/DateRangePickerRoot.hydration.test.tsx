import { describe, expect, it } from 'vitest';
import { createRenderer, hydrate, renderOnServer, screen } from '#test-utils';
import { formatRangeText } from '../../internals/date-time/calendar/formatText';
import DateRangePickerRootHydration from './DateRangePickerRootHydration.test.vue';

const HYDRATION_FILE = 'src/date-range-picker/root/DateRangePickerRootHydration.test.vue';

describe('<DateRangePicker.Root /> hydration', () => {
  createRenderer();

  // `hydrate` fails the test for a warning, and for a DOM that differs from a client-only render.
  it.each([
    { name: 'dates', props: { value: ['2026-11-14', '2026-11-20'] } },
    { name: 'no range', props: {} },
    { name: 'a range with one end', props: { value: ['2026-11-14', null] } },
    { name: 'dates and times', props: { value: ['2026-11-14T15:04', '2026-11-20T09:30'] } },
    {
      name: 'dates and times in a zone',
      props: { value: ['2026-11-14T15:04[Asia/Tokyo]', '2026-11-20T09:30[Asia/Tokyo]'] },
    },
    {
      name: 'Persian dates',
      props: { value: ['2026-11-14', '2026-11-20'], calendar: 'persian' },
    },
    { name: 'a layout that the browser changes', props: { locale: 'is-IS' } },
    { name: 'a disabled picker', props: { value: ['2026-11-14', '2026-11-20'], disabled: true } },
    { name: 'a label of a Field before the fields', props: { label: 'Trip dates' } },
    {
      name: 'a label of a Field after the fields',
      props: { label: 'Trip dates', labelAfter: true },
    },
  ])('hydrates a picker with $name with no warning', async ({ props }) => {
    const fixtureProps = {
      today: '2026-11-14',
      locale: 'en-US',
      timeZone: 'UTC',
      startName: 'from',
      endName: 'to',
      ...props,
    };
    const serverHtml = await renderOnServer(HYDRATION_FILE, fixtureProps);

    const { container } = await hydrate(DateRangePickerRootHydration, {
      serverHtml,
      props: fixtureProps,
    });

    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(container.querySelector('[role="dialog"]')).toBe(null);
    if ('label' in props) {
      expect(screen.getByRole('group', { name: 'Start date Trip dates' })).toBe(
        screen.getByTestId('start-field'),
      );
      expect(screen.getByRole('group', { name: 'End date Trip dates' })).toBe(
        screen.getByTestId('end-field'),
      );
    }
  });

  it('has the values in the hidden inputs and the range in the trigger name, from the server HTML', async () => {
    const serverHtml = await renderOnServer(HYDRATION_FILE, {
      today: '2026-11-14',
      value: ['2026-11-14', '2026-11-20'],
      locale: 'en-US',
      timeZone: 'UTC',
      startName: 'from',
      endName: 'to',
    });
    const template = document.createElement('template');
    template.innerHTML = serverHtml;

    const [start, end] = template.content.querySelectorAll<HTMLInputElement>('input[aria-hidden]');
    expect(start?.getAttribute('value')).toBe('2026-11-14');
    expect(start?.getAttribute('name')).toBe('from');
    expect(end?.getAttribute('value')).toBe('2026-11-20');
    expect(end?.getAttribute('name')).toBe('to');
    // Node and a browser can space the two days of a range in another way.
    const spaced = (text: string | null | undefined) => text?.replace(/\s+/g, ' ');
    expect(
      spaced(template.content.querySelector('[data-testid="trigger"]')?.getAttribute('aria-label')),
    ).toBe(
      spaced(
        `Change dates, ${formatRangeText(
          Temporal.PlainDate.from('2026-11-14'),
          Temporal.PlainDate.from('2026-11-20'),
          { dateStyle: 'full' },
          'en-US',
        )}`,
      ),
    );
    expect(template.content.querySelector('[role="dialog"]')).toBe(null);
  });
});
