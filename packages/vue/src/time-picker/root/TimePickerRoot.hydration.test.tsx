import { describe, expect, it } from 'vitest';
import { createRenderer, hydrate, renderOnServer, screen } from '#test-utils';
import { formatText } from '../../internals/date-time/calendar/formatText';
import TimePickerRootHydration from './TimePickerRootHydration.test.vue';

const HYDRATION_FILE = 'src/time-picker/root/TimePickerRootHydration.test.vue';

describe('<TimePicker.Root /> hydration', () => {
  createRenderer();

  // `hydrate` fails the test for a warning, and for a DOM that differs from a client-only render.
  it.each([
    { name: 'a time', props: { value: '15:04' } },
    { name: 'no value', props: {} },
    { name: 'a date and time', props: { value: '2026-11-14T15:04' } },
    { name: 'a date and time in a zone', props: { value: '2026-11-14T15:04[Asia/Tokyo]' } },
    { name: 'a 24-hour cycle', props: { value: '15:04', hourCycle: 24 } },
    { name: 'limits', props: { value: '15:04', minTime: '09:00' } },
    {
      name: 'a layout that Node and Chromium format in another way',
      props: { locale: 'is-IS', parts: false },
    },
    { name: 'a disabled picker', props: { value: '15:04', disabled: true } },
    { name: 'a read-only picker', props: { value: '15:04', readOnly: true } },
  ])('hydrates a picker with $name with no warning', async ({ props }) => {
    const fixtureProps = { locale: 'en-US', name: 'start', ...props };
    const serverHtml = await renderOnServer(HYDRATION_FILE, fixtureProps);

    const { container } = await hydrate(TimePickerRootHydration, {
      serverHtml,
      props: fixtureProps,
    });

    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(container.querySelector('[role="dialog"]')).toBe(null);
  });

  it('has the value in the hidden input and the name in the trigger, from the server HTML', async () => {
    const serverHtml = await renderOnServer(HYDRATION_FILE, {
      value: '15:04',
      locale: 'en-US',
      name: 'start',
    });
    const template = document.createElement('template');
    template.innerHTML = serverHtml;

    const hiddenInput = template.content.querySelector<HTMLInputElement>('input[aria-hidden]');
    expect(hiddenInput?.getAttribute('value')).toBe('15:04');
    expect(hiddenInput?.getAttribute('name')).toBe('start');
    expect(
      template.content.querySelector('[data-testid="trigger"]')?.getAttribute('aria-label'),
    ).toBe(
      `Change time, ${formatText(Temporal.PlainTime.from('15:04'), { timeStyle: 'short' }, 'en-US')}`,
    );
    expect(template.content.querySelector('[role="dialog"]')).toBe(null);
  });

  it('has the selected time and one tab stop in the list, from the server HTML', async () => {
    const serverHtml = await renderOnServer(HYDRATION_FILE, {
      value: '15:00',
      locale: 'en-US',
    });
    const template = document.createElement('template');
    template.innerHTML = serverHtml;

    const options = [...template.content.querySelectorAll('[data-testid="list"] [role="option"]')];
    expect(options).toHaveLength(24);
    expect(
      options.filter((option) => option.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(1);
    expect(options.filter((option) => option.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(options[15]?.getAttribute('aria-selected')).toBe('true');
    expect(options[15]?.getAttribute('tabindex')).toBe('0');
  });
});
