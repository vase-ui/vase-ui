import { describe, expect, it, vi } from 'vitest';
import { createRenderer, describeConformance, fireEvent, screen } from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import { REASONS } from '../../internals/reasons';
import * as Dialog from '../index.parts';
import type { DialogStore } from '../store/DialogStore';

describe('<Dialog.Close />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Close />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render: (node) => {
      return render(
        <Dialog.Root open modal={false}>
          <Dialog.Portal>
            <Dialog.Popup>{node}</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );
    },
  }));

  describe('prop: disabled', () => {
    it('disables the button', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <Dialog.Root onOpenChange={handleOpenChange}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close disabled>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      expect(handleOpenChange.mock.calls.length).toBe(0);

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][0]).toBe(true);

      const closeButton = screen.getByText('Close');
      expect(closeButton).toHaveAttribute('disabled');
      expect(closeButton).toHaveAttribute('data-disabled');
      await user.click(closeButton);

      expect(handleOpenChange.mock.calls.length).toBe(1);
    });

    it('custom element', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <Dialog.Root onOpenChange={handleOpenChange}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close disabled as="span" nativeButton={false}>
                Close
              </Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      expect(handleOpenChange.mock.calls.length).toBe(0);

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][0]).toBe(true);

      const closeButton = screen.getByText('Close');
      expect(closeButton).not.toHaveAttribute('disabled');
      expect(closeButton).toHaveAttribute('data-disabled');
      expect(closeButton).toHaveAttribute('aria-disabled', 'true');
      await user.click(closeButton);

      expect(handleOpenChange.mock.calls.length).toBe(1);
    });
  });

  it('closes the dialog when undefined is passed to the `onClick` prop', async () => {
    const handleOpenChange = vi.fn();

    const { user } = await render(
      <Dialog.Root onOpenChange={handleOpenChange}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Close onClick={undefined}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>,
    );

    expect(handleOpenChange.mock.calls.length).toBe(0);

    const openButton = screen.getByText('Open');
    await user.click(openButton);

    expect(handleOpenChange.mock.calls.length).toBe(1);
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    expect(handleOpenChange.mock.calls.length).toBe(2);
    expect(handleOpenChange.mock.calls[1][0]).toBe(false);
  });

  it('does not close the dialog when the Base UI click handler is prevented', async () => {
    const handleOpenChange = vi.fn();

    const { user } = await render(
      <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Close onClick={(event) => event.preventVaseUIHandler()}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('dialog')).not.toBe(null);
    expect(handleOpenChange.mock.calls.length).toBe(0);
  });

  it('does not request another close when clicked after the dialog has closed', async () => {
    const handleOpenChange = vi.fn();
    const handleClick = vi.fn();

    await render(
      <Dialog.Root open={false} modal={false} onOpenChange={handleOpenChange}>
        <Dialog.Portal keepMounted>
          <Dialog.Popup>
            <Dialog.Close onClick={handleClick}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>,
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));

    expect(handleClick.mock.calls.length).toBe(1);
    expect(handleOpenChange.mock.calls.length).toBe(0);
  });

  it('closes the dialog with the reason close-press and the click event', async () => {
    const handleOpenChange = vi.fn();
    const { user } = await render(
      <Dialog.Root defaultOpen modal={false} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Popup>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
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

  it('makes no close request while the dialog is closed', async () => {
    const handleClick = vi.fn();
    const handleDroppedClose = vi.fn();
    let store!: DialogStore<unknown>;
    await render(() => (
      <Dialog.Root open={false} modal={false}>
        <DialogStoreProbe onStore={(value) => (store = value)} />
        <Dialog.Portal keepMounted>
          <Dialog.Popup>
            <Dialog.Close onClick={handleClick}>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    store.context.events.on('droppedclose', handleDroppedClose);

    await fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleDroppedClose).not.toHaveBeenCalled();
  });
});
