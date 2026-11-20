import { describe, expect, test } from 'vitest';
import PickersOnServer from '../../test/fixtures/PickersOnServer.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

const optionsOf = (root: Element, id: string) => [
  ...root.querySelectorAll(`[data-testid="${id}"] [role="option"]`),
];

describe('server render and hydration', () => {
  test.each([
    { name: 'a time', props: { value: '15:00' } },
    { name: 'no value', props: {} },
    { name: 'a disabled picker', props: { value: '15:00', disabled: true } },
  ])('hydrates a picker with $name and a list and a column outside the popup, with no message', async ({ props }) => {
    const fixtureProps = { family: 'time', locale: 'en-US', inline: true, ...props };
    const root = await renderOnServer('PickersOnServer', fixtureProps);
    const elements = [...root.querySelectorAll('*')];
    hydrate(PickersOnServer, fixtureProps, root);
    await settle();
    expect([...root.querySelectorAll('*')].slice(0, elements.length)).toEqual(elements);
    expect(takeReportedMessages()).toEqual([]);
  });

  test('the server HTML has the selected item and one tab stop in the list and in the column', async () => {
    const root = await renderOnServer('PickersOnServer', { family: 'time', value: '15:00', inline: true });
    const times = optionsOf(root, 'list');
    expect(times.filter((item) => item.getAttribute('aria-selected') === 'true')).toEqual([times[15]]);
    expect(times.filter((item) => item.getAttribute('tabindex') === '0')).toEqual([times[15]]);
    // The hours of a 12-hour cycle go from 12, so the hour 3 is the fourth item.
    const hours = optionsOf(root, 'hour');
    expect(hours.filter((item) => item.getAttribute('tabindex') === '0')).toEqual([hours[3]]);
  });

  // The server here renders `ar-EG`, and the browser `en-US`, in a 24-hour cycle. The items and the
  // column name have other texts, and the part allows the difference.
  test('a list and a column whose server texts differ take the texts of the browser, with no message', async () => {
    const props = { family: 'time', value: '15:00', inline: true, hourCycle: 24 };
    const root = await renderOnServer('PickersOnServer', { ...props, locale: 'ar-EG' });
    expect(optionsOf(root, 'list')[15]).not.toHaveTextContent('15:00');
    hydrate(PickersOnServer, { ...props, locale: 'en-US' }, root);
    await settle();
    expect(optionsOf(root, 'list')[15]).toHaveTextContent('15:00');
    expect(optionsOf(root, 'hour')[15]).toHaveTextContent('15');
    expect(root.querySelector('[data-testid="hour"]')).toHaveAttribute('aria-label', 'hour');
    expect(takeReportedMessages()).toEqual([]);
  });
});
