import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
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
