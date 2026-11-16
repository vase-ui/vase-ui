import { describe, expect, it } from 'vitest';
import { createRenderer, hydrate, renderOnServer, screen } from '#test-utils';
import { formatText } from '../../internals/date-time/calendar/formatText';
import DatePickerRootHydration from './DatePickerRootHydration.test.vue';

const HYDRATION_FILE = 'src/date-picker/root/DatePickerRootHydration.test.vue';

describe('<DatePicker.Root /> hydration', () => {
  createRenderer();

  // `hydrate` fails the test for a warning, and for a DOM that differs from a client-only render.
  it.each([
    { name: 'a date', props: { value: '2026-11-14' } },
    { name: 'no value', props: {} },
    { name: 'a date and time', props: { value: '2026-11-14T15:04' } },
    { name: 'a date and time in a zone', props: { value: '2026-11-14T15:04[Asia/Tokyo]' } },
    { name: 'a year and month', props: { value: '2026-11', monthGrid: true } },
    { name: 'a Persian date', props: { value: '2026-11-14', calendar: 'persian' } },
    { name: 'a layout that the browser changes', props: { locale: 'is-IS' } },
    { name: 'a disabled picker', props: { value: '2026-11-14', disabled: true } },
  ])('hydrates a picker with $name with no warning', async ({ props }) => {
    const fixtureProps = {
      today: '2026-11-14',
      locale: 'en-US',
      timeZone: 'UTC',
      name: 'when',
      ...props,
    };
    const serverHtml = await renderOnServer(HYDRATION_FILE, fixtureProps);

    const { container } = await hydrate(DatePickerRootHydration, {
      serverHtml,
      props: fixtureProps,
    });

    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(container.querySelector('[role="dialog"]')).toBe(null);
  });

  it('has the value in the hidden input and the name in the trigger, from the server HTML', async () => {
    const serverHtml = await renderOnServer(HYDRATION_FILE, {
      today: '2026-11-14',
      value: '2026-11-14',
      locale: 'en-US',
      timeZone: 'UTC',
      name: 'when',
    });
    const template = document.createElement('template');
    template.innerHTML = serverHtml;

    const hiddenInput = template.content.querySelector<HTMLInputElement>('input[aria-hidden]');
    expect(hiddenInput?.getAttribute('value')).toBe('2026-11-14');
    expect(hiddenInput?.getAttribute('name')).toBe('when');
    expect(
      template.content.querySelector('[data-testid="trigger"]')?.getAttribute('aria-label'),
    ).toBe(
      `Change date, ${formatText(Temporal.PlainDate.from('2026-11-14'), { dateStyle: 'full' }, 'en-US')}`,
    );
    expect(template.content.querySelector('[role="dialog"]')).toBe(null);
  });
});
