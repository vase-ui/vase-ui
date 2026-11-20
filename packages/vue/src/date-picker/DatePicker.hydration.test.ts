import { describe, expect, test } from 'vitest';
import PickersOnServer from '../../test/fixtures/PickersOnServer.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

describe('server render and hydration', () => {
  test.each([
    { name: 'a date', props: { value: '2026-11-18' } },
    { name: 'no value', props: {} },
    { name: 'a date and time in a zone', props: { value: '2026-11-18T15:04[Asia/Tokyo]' } },
    { name: 'a disabled picker', props: { value: '2026-11-18', disabled: true } },
    { name: 'a calendar outside the popup', props: { value: '2026-11-18', inline: true } },
  ])('hydrates a picker with $name, with no message and with each element', async ({ props }) => {
    const fixtureProps = { family: 'date', locale: 'en-US', ...props };
    const root = await renderOnServer('PickersOnServer', fixtureProps);
    const elements = [...root.querySelectorAll('*')];
    hydrate(PickersOnServer, fixtureProps, root);
    await settle();
    expect([...root.querySelectorAll('*')].slice(0, elements.length)).toEqual(elements);
    expect(root.querySelector('[role="dialog"]')).toBe(null);
    expect(takeReportedMessages()).toEqual([]);
  });

  test('the server HTML has the value in the form input, the selected day and its tab stop, and no popup', async () => {
    const root = await renderOnServer('PickersOnServer', {
      family: 'date',
      value: '2026-11-18',
      inline: true,
      open: true,
    });
    expect(root.querySelector('input[aria-hidden]')).toHaveAttribute('value', '2026-11-18');
    const selected = root.querySelector('[data-date="2026-11-18"]')!;
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected.querySelector('button')).toHaveAttribute('tabindex', '0');
    expect(root.querySelector('[role="dialog"]')).toBe(null);
  });

  test('an open root with a disabled Portal has its popup in the server HTML, and hydrates it with no message', async () => {
    const props = { family: 'date', value: '2026-11-18', open: true, portalDisabled: true };
    const root = await renderOnServer('PickersOnServer', props);
    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('[data-date="2026-11-18"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    hydrate(PickersOnServer, props, root);
    await settle();
    expect(root.querySelector('[role="dialog"]')).toBe(dialog);
    expect(takeReportedMessages()).toEqual([]);
  });
});
