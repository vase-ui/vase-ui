import { describe, expect, it, vi } from 'vitest';
import { createRenderer, describeConformance, fireEvent, screen } from '#test-utils';
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import { REASONS } from '../../internals/reasons';
import * as Dialog from '../index.parts';
import type { DialogStore } from '../store/DialogStore';

describe('<Dialog.Close />', () => {
  const { render } = createRenderer();

  describe('with a test popup', () => {
    describeConformance(<Dialog.Close />, () => ({
      refInstanceof: window.HTMLButtonElement,
      testRenderPropWith: 'button',
      button: true,
      render: (node) => {
        return render(
          <Dialog.Root open modal={false}>
            <DialogPopupPart>{node}</DialogPopupPart>
          </Dialog.Root>,
        );
      },
    }));
  });

  it('closes the dialog with the reason close-press and the click event', async () => {
    const handleOpenChange = vi.fn();
    const { user } = await render(
      <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
        <DialogPopupPart>
          <Dialog.Close>Close</Dialog.Close>
        </DialogPopupPart>
      </Dialog.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBe(null);
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    const [open, details] = handleOpenChange.mock.calls[0];
    expect(open).toBe(false);
    expect(details.reason).toBe(REASONS.closePress);
    expect(details.event.type).toBe('click');
  });

  describe('prop: disabled', () => {
    it.each([
      { name: 'native button', props: {}, disabled: '', ariaDisabled: null },
      {
        name: 'custom element',
        props: { as: 'span', nativeButton: false },
        disabled: null,
        ariaDisabled: 'true',
      },
    ])(
      'marks a disabled $name and does not close the dialog',
      async ({ props, disabled, ariaDisabled }) => {
        const handleOpenChange = vi.fn();
        const { user } = await render(
          <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
            <DialogPopupPart>
              <Dialog.Close disabled {...(props as object)}>
                Close
              </Dialog.Close>
            </DialogPopupPart>
          </Dialog.Root>,
        );
        const closeButton = screen.getByText('Close');

        expect(closeButton).toHaveAttribute('data-disabled');
        expect(closeButton.getAttribute('disabled')).toBe(disabled);
        expect(closeButton.getAttribute('aria-disabled')).toBe(ariaDisabled);

        await user.click(closeButton);

        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange).not.toHaveBeenCalled();
      },
    );
  });

  it('does not close the dialog when the consumer prevents the Vase UI handler', async () => {
    const handleOpenChange = vi.fn();
    const { user } = await render(
      <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
        <DialogPopupPart>
          <Dialog.Close onClick={(event) => event.preventVaseUIHandler()}>Close</Dialog.Close>
        </DialogPopupPart>
      </Dialog.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBe(null);
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('makes no close request while the dialog is closed', async () => {
    const handleClick = vi.fn();
    const handleDroppedClose = vi.fn();
    let store!: DialogStore<unknown>;
    await render(() => (
      <Dialog.Root open={false} modal={false}>
        <DialogStoreProbe onStore={(value) => (store = value)} />
        <DialogPopupPart keepMounted>
          <Dialog.Close onClick={handleClick}>Close</Dialog.Close>
        </DialogPopupPart>
      </Dialog.Root>
    ));
    store.context.events.on('droppedclose', handleDroppedClose);

    await fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleDroppedClose).not.toHaveBeenCalled();
  });
});
