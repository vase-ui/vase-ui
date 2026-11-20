import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import CalendarOnServer from '../../test/fixtures/CalendarOnServer.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML has the range, one tab stop and the touch style of each day; the hydration keeps them', async () => {
    const props = { today: '2026-11-18', range: ['2026-11-10', '2026-11-12'] };
    const root = await renderOnServer('CalendarOnServer', props);
    const dates = (selector: string) =>
      [...root.querySelectorAll(`td${selector}`)].map((cell) => cell.getAttribute('data-date'));
    expect(root.querySelector('[role=grid]')).toHaveAttribute('aria-multiselectable', 'true');
    expect(dates('[data-range-start]')).toEqual(['2026-11-10']);
    expect(dates('[data-range-middle]')).toEqual(['2026-11-11']);
    expect(dates('[data-range-end]')).toEqual(['2026-11-12']);
    expect(dates('[aria-selected=true]')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(root.querySelectorAll('[role=grid] [tabindex="0"]')).toHaveLength(1);
    const button = root.querySelector<HTMLElement>('[data-date="2026-11-10"] button')!;
    expect(button).toHaveAttribute('tabindex', '0');
    expect(button.style.touchAction).toBe('none');
    hydrate(CalendarOnServer, props, root);
    await nextTick();
    expect(root.querySelector('[data-date="2026-11-10"] button')).toBe(button);
    expect(button).toHaveAttribute('data-range-start');
  });
});
