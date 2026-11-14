import { describe, expect, it, vi } from 'vitest';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
} from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import { REASONS } from '../../internals/reasons';
import * as Dialog from '../index.parts';
import type { DialogStore } from '../store/DialogStore';
import DialogTriggerHydration from './DialogTriggerHydration.test.vue';

describe('<Dialog.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render: (node) => {
      return render(
        <Dialog.Root open modal={false}>
          {node}
        </Dialog.Root>,
      );
    },
  }));

  describe('open state', () => {
    it('opens the dialog on a click and closes it on the next click', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Dialog.Root modal={false} onOpenChange={handleOpenChange}>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>,
      );
      const trigger = screen.getByRole('button', { name: 'Open' });

      await fireEvent.click(trigger, { detail: 1 });
      expect(screen.queryByRole('dialog')).not.toBe(null);

      await fireEvent.click(trigger, { detail: 1 });
      expect(screen.queryByRole('dialog')).toBe(null);

      expect(
        handleOpenChange.mock.calls.map(([open, details]) => [
          open,
          details.reason,
          details.trigger,
        ]),
      ).toEqual([
        [true, REASONS.triggerPress, trigger],
        [false, REASONS.triggerPress, trigger],
      ]);
    });

    it('marks only the trigger that opened the dialog, and names the popup in it', async () => {
      let store!: DialogStore<unknown>;
      await render(
        <Dialog.Root modal={false}>
          <DialogStoreProbe onStore={(value) => (store = value)} />
          <Dialog.Trigger>One</Dialog.Trigger>
          <Dialog.Trigger>Two</Dialog.Trigger>
        </Dialog.Root>,
      );
      const one = screen.getByRole('button', { name: 'One' });
      const two = screen.getByRole('button', { name: 'Two' });
      expect(one).toHaveAttribute('aria-haspopup', 'dialog');
      expect(one).toHaveAttribute('aria-expanded', 'false');
      expect(one).not.toHaveAttribute('data-popup-open');

      await fireEvent.click(one, { detail: 1 });

      expect(one).toHaveAttribute('aria-expanded', 'true');
      expect(one).toHaveAttribute('data-popup-open');
      expect(one).toHaveAttribute('aria-controls', store.select('popupId'));
      expect(two).toHaveAttribute('aria-expanded', 'false');
      expect(two).not.toHaveAttribute('data-popup-open');
      expect(two).not.toHaveAttribute('aria-controls');
    });

    it('is the active trigger when the root names its id', async () => {
      await render(
        <Dialog.Root defaultOpen defaultTriggerId="two" modal={false}>
          <Dialog.Trigger id="one">One</Dialog.Trigger>
          <Dialog.Trigger id="two">Two</Dialog.Trigger>
        </Dialog.Root>,
      );

      expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('aria-expanded', 'true');
    });

    it.each([
      { name: 'keyboard', pointerType: undefined, detail: 0, openMethod: 'keyboard' },
      { name: 'touch', pointerType: 'touch', detail: 1, openMethod: 'touch' },
    ])(
      'gives the store the input type that opened the dialog: $name',
      async ({ pointerType, detail, openMethod }) => {
        let store!: DialogStore<unknown>;
        await render(
          <Dialog.Root modal={false}>
            <DialogStoreProbe onStore={(value) => (store = value)} />
            <Dialog.Trigger>Open</Dialog.Trigger>
          </Dialog.Root>,
        );
        const trigger = screen.getByRole('button', { name: 'Open' });

        if (pointerType) {
          await fireEvent.pointerDown(trigger, { pointerType });
        }
        await fireEvent.click(trigger, { detail });

        expect(store.select('open')).toBe(true);
        expect(store.select('openMethod')).toBe(openMethod);
      },
    );

    it('closes the dialog on the Escape key, and stops the key press at the trigger', async () => {
      const handleKeydown = vi.fn();
      await render(
        <div onKeydown={handleKeydown}>
          <Dialog.Root defaultOpen modal={false}>
            <Dialog.Trigger>Open</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup />
            </Dialog.Portal>
          </Dialog.Root>
        </div>,
      );

      await fireEvent.keyDown(screen.getByRole('button', { name: 'Open' }), { key: 'Escape' });

      expect(screen.queryByRole('dialog')).toBe(null);
      expect(handleKeydown).not.toHaveBeenCalled();
    });

    it('marks its element as a click trigger', async () => {
      await render(
        <Dialog.Root modal={false}>
          <Dialog.Trigger>Open</Dialog.Trigger>
        </Dialog.Root>,
      );

      expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute(
        CLICK_TRIGGER_IDENTIFIER,
        '',
      );
    });
  });

  describe('disabled', () => {
    it.each([
      { name: 'native button', props: {}, disabled: '', ariaDisabled: null },
      {
        name: 'custom element',
        props: { as: 'span', nativeButton: false },
        disabled: null,
        ariaDisabled: 'true',
      },
    ])(
      'marks a disabled $name and does not open the dialog',
      async ({ props, disabled, ariaDisabled }) => {
        const handleOpenChange = vi.fn();
        const { user } = await render(
          <Dialog.Root modal={false} onOpenChange={handleOpenChange}>
            <Dialog.Trigger disabled {...props}>
              Open
            </Dialog.Trigger>
          </Dialog.Root>,
        );
        const trigger = screen.getByRole('button', { name: 'Open' });
        expect(trigger.getAttribute('disabled')).toBe(disabled);
        expect(trigger.getAttribute('aria-disabled')).toBe(ariaDisabled);
        expect(trigger).toHaveAttribute('data-disabled');

        await fireEvent.click(trigger, { detail: 1 });
        await user.keyboard('[Tab]');

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(document.activeElement).not.toBe(trigger);
      },
    );
  });

  describe('handle', () => {
    it('opens the dialog of its handle from outside the root, and gives the root its payload', async () => {
      const handle = Dialog.createHandle<number>();
      await render(
        <div>
          <Dialog.Trigger handle={handle} payload={7}>
            Open
          </Dialog.Trigger>
          <Dialog.Root handle={handle} modal={false}>
            {{
              default: ({ payload }: { payload: number | undefined }) => (
                <span data-testid="payload">{String(payload)}</span>
              ),
            }}
          </Dialog.Root>
        </div>,
      );
      const trigger = screen.getByRole('button', { name: 'Open' });

      await fireEvent.click(trigger, { detail: 1 });

      expect(handle.isOpen).toBe(true);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('payload').textContent).toBe('7');
    });
  });

  describe('server render', () => {
    it.each([
      { name: 'a closed dialog', props: {}, one: 'false', two: 'false' },
      // The first trigger that registers claims the dialog after the mount.
      {
        name: 'an open dialog with no trigger id',
        props: { defaultOpen: true },
        one: 'true',
        two: 'false',
      },
      {
        name: 'an open dialog with a trigger id',
        props: { defaultOpen: true, defaultTriggerId: 'two' },
        one: 'false',
        two: 'true',
      },
    ])('hydrates the server HTML of $name', async ({ props, one, two }) => {
      const serverHtml = await renderOnServer(
        'src/dialog/trigger/DialogTriggerHydration.test.vue',
        props,
      );

      const { container } = await hydrate(DialogTriggerHydration, { serverHtml, props });

      expect(container.querySelector('#one')).toHaveAttribute('aria-expanded', one);
      expect(container.querySelector('#two')).toHaveAttribute('aria-expanded', two);
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error without a root or handle', async () => {
    await expect(render(<Dialog.Trigger />)).rejects.toThrow(
      'Vase UI: <Dialog.Trigger> must be inside <Dialog.Root>. Without a root the trigger has no dialog to open. Put the trigger inside <Dialog.Root>, or pass a `handle`.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
