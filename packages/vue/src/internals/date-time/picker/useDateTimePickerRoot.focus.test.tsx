import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from '@vase-ui/vue/date-picker';
import {
  createHeldBranch,
  createRenderer,
  screen,
  waitFor,
  waitForLaterMillisecond,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import PickerFocusTargetButton from './PickerFocusTargetButton.test.vue';
import PickerFocusTargetsFixture from './PickerFocusTargetsFixture.test.vue';

describe('usePickerFocusTarget', () => {
  const { render } = createRenderer();

  // The click comes in a later millisecond than the mount, so that Vue runs each listener.
  async function open(user: VaseUIRenderResult['user']) {
    await waitForLaterMillisecond(async () => {
      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).not.toBe(null);
      });
    });
  }

  it('gives the focus to the first target in the document, and not to the one that mounted last', async () => {
    const { user } = await render(<PickerFocusTargetsFixture />);

    await open(user);

    await waitFor(() => {
      expect(screen.getByTestId('first')).toHaveFocus();
    });
  });

  it('sorts a target that mounts later by its place in the document', async () => {
    const { user, setProps } = await render(<PickerFocusTargetsFixture hasFirst={false} />);
    await setProps({ hasFirst: true });

    await open(user);

    await waitFor(() => {
      expect(screen.getByTestId('first')).toHaveFocus();
    });
  });

  it('stops asking a target when its part unmounts', async () => {
    const ask = vi.fn();
    const { user, setProps } = await render(<PickerFocusTargetsFixture ask={ask} />);
    await open(user);
    await waitFor(() => {
      expect(screen.getByTestId('first')).toHaveFocus();
    });
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.getByTestId('trigger')).toHaveFocus();
    });
    await setProps({ hasFirst: false });
    ask.mockClear();

    await open(user);

    await waitFor(() => {
      expect(screen.getByTestId('second')).toHaveFocus();
    });
    expect(ask).not.toHaveBeenCalled();
  });

  it('takes the first element that a target gives, and skips a target that gives none', async () => {
    const { user } = await render(<PickerFocusTargetsFixture firstGives={false} />);

    await open(user);

    await waitFor(() => {
      expect(screen.getByTestId('second')).toHaveFocus();
    });
  });

  // The part stays registered while `KeepAlive` holds it, and its element is out of the document.
  it('skips a target whose part KeepAlive holds', async () => {
    const { HeldBranch, hide } = createHeldBranch(
      () => <PickerFocusTargetButton data-testid="held">Held</PickerFocusTargetButton>,
      { mounted: true },
    );
    const { user } = await render(
      <DatePicker.Root>
        <DatePicker.Trigger data-testid="trigger">Open</DatePicker.Trigger>
        <DatePicker.Portal keepMounted>
          <DatePicker.Positioner>
            <DatePicker.Popup aria-label="Choose date">
              <button type="button" data-testid="plain">
                Plain
              </button>
              <HeldBranch />
            </DatePicker.Popup>
          </DatePicker.Positioner>
        </DatePicker.Portal>
      </DatePicker.Root>,
    );
    await hide();

    await open(user);

    await waitFor(() => {
      expect(screen.getByTestId('plain')).toHaveFocus();
    });
  });
});
