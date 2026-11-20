import { describe, expect, test } from 'vitest';
import PickersOnServer from '../../test/fixtures/PickersOnServer.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

describe('server render and hydration', () => {
  test.each([
    { name: 'a range', props: { value: '2026-11-18 2026-11-20' } },
    { name: 'no value', props: {} },
    {
      name: 'a calendar outside the popup',
      props: { value: '2026-11-18 2026-11-20', inline: true },
    },
  ])('hydrates a picker with $name, with no message and with each element', async ({ props }) => {
    const fixtureProps = { family: 'range', locale: 'en-US', ...props };
    const root = await renderOnServer('PickersOnServer', fixtureProps);
    const elements = [...root.querySelectorAll('*')];
    hydrate(PickersOnServer, fixtureProps, root);
    await settle();
    expect([...root.querySelectorAll('*')].slice(0, elements.length)).toEqual(elements);
    expect(takeReportedMessages()).toEqual([]);
  });

  test('in a Field with its label after the picker, the server HTML names each field with the label', async () => {
    const fixtureProps = { family: 'range', locale: 'en-US', field: true };
    const root = await renderOnServer('PickersOnServer', fixtureProps);
    const label = root.querySelector('label')!;
    const groups = [...root.querySelectorAll('[role="group"]')];
    expect(groups.map((group) => group.getAttribute('aria-labelledby'))).toEqual(
      groups.map((group) => `${group.id} ${label.id}`),
    );
    hydrate(PickersOnServer, fixtureProps, root);
    await settle();
    expect(takeReportedMessages()).toEqual([]);
  });
});
