import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import PopupFocusReturn from '../../test/fixtures/PopupFocusReturn.vue';
import PopupOpenedByCode from '../../test/fixtures/PopupOpenedByCode.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('the focus after a popup that code opened closes', () => {
  test.each(['select', 'menu'] as const)(
    'a %s in a popover that a button opens through v-model:open gives the focus back to that button after a pick',
    async (family) => {
      mount(PopupOpenedByCode, { family });
      await waitFor(() => expect(byTestId('opener')).not.toBe(null));
      // A click gives a button no focus in WebKit on macOS, so a key presses the button.
      byTestId('opener')!.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(byTestId('two')?.checkVisibility()).toBe(true));
      await userEvent.click(byTestId('two')!);
      await waitFor(() => expect(byTestId('popup')?.checkVisibility() ?? false).toBe(false));
      expect(document.activeElement).toBe(byTestId('opener'));
      expect(byTestId('popover-popup')).not.toBe(null);
    },
  );
});

describe.each([
  { name: 'a modal dialog', family: 'dialog', hides: true },
  { name: 'an uncontrolled modal dialog', family: 'dialog-uncontrolled', hides: true },
  { name: 'an alert dialog', family: 'alert-dialog', hides: true },
  { name: 'a drawer', family: 'drawer', hides: true },
  { name: 'a modal popover', family: 'popover', modal: true, hides: true },
  { name: 'a popover that is not modal', family: 'popover', hides: false },
  { name: 'a menu', family: 'menu', hides: false },
  { name: 'a combobox whose input is the control', family: 'combobox', hides: false },
] as const)('the return of the focus of $name in the update of its close', (row) => {
  async function closeWith(give: 'target' | 'box' | 'fallback') {
    mount(PopupFocusReturn, { family: row.family, give, modal: 'modal' in row });
    await nextTick();
    await userEvent.click(byTestId('opener')!);
    await waitFor(() => expect(byTestId('decide')).not.toBe(null));
    await userEvent.click(byTestId('decide')!);
    await waitFor(() => expect(byTestId('popup')).toBe(null));
  }

  test('goes to a `finalFocus` element that Vue renders again in that update', async () => {
    await closeWith('target');
    await waitFor(() => expect(document.activeElement).toBe(byTestId('target')));
    expect(byTestId('target')).toHaveTextContent('Target 1');
  });

  test.runIf(row.hides)(
    'goes to the first tab stop of a `finalFocus` element that was inert at the close',
    async () => {
      await closeWith('box');
      await waitFor(() => expect(document.activeElement).toBe(byTestId('box-1')));
    },
  );

  test.runIf(row.hides)(
    'leaves the focus to the element that a `finalFocus` function focuses itself, which was inert at the close',
    async () => {
      await closeWith('fallback');
      await waitFor(() => expect(document.activeElement).toBe(byTestId('fallback')));
    },
  );
});
