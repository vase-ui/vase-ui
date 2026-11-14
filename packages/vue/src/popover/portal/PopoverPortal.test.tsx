import { describe, expect, it } from 'vitest';
import { h, shallowRef } from 'vue';
import type { Component } from 'vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import * as Popover from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  waitFor,
  waitForPositioned,
} from '#test-utils';

describe('<Popover.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(<Popover.Root open>{node}</Popover.Root>);
      await flushMicrotasks();
      return result;
    },
  }));

  it('keeps a closed popup in the document with keepMounted', async () => {
    await render(
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal keepMounted>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    expect(screen.getByText('Content')).toHaveAttribute('data-closed');
    expect(screen.getByTestId('positioner')).toHaveAttribute('hidden');
  });

  it('gives the positioner the prop, so a closed popup does not keep its last position', async () => {
    const open = shallowRef(true);
    await render(() => (
      <Popover.Root open={open.value}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal keepMounted>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const positioner = await screen.findByTestId('positioner');
    await waitForPositioned(positioner);

    open.value = false;
    await waitFor(() => {
      expect(positioner).toHaveAttribute('hidden');
    });

    expect(positioner.style.opacity).toBe('0');
  });

  it('renders the popup in the children component of the #render slot', async () => {
    await render(
      <Popover.Root open modal>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal
          v-slots={{
            render: ({
              props,
              children,
            }: {
              props: Record<string, unknown>;
              children: Component;
            }) => (
              <section {...props} data-testid="portal">
                {h(children, null, () => (
                  <Popover.Positioner data-testid="positioner">
                    <Popover.Popup>Content</Popover.Popup>
                  </Popover.Positioner>
                ))}
              </section>
            ),
          }}
        />
      </Popover.Root>,
    );
    await flushMicrotasks();

    const portal = screen.getByTestId('portal');
    expect(portal.localName).toBe('section');
    expect(portal.parentElement).toBe(document.body);
    expect(portal.contains(screen.getByRole('dialog'))).toBe(true);
    // The backdrop of the modal popover shows that `children` is the component of this part.
    expect(screen.getByTestId('positioner').previousElementSibling).toHaveAttribute(
      'role',
      'presentation',
    );
  });

  describe('the internal backdrop of a modal popover', () => {
    function renderPopover(modal: boolean | 'trap-focus') {
      const handle = Popover.createHandle<unknown>();
      return {
        handle,
        result: render(
          <Popover.Root
            handle={handle}
            modal={modal}
            onOpenChange={(open: boolean, details: Popover.Root.ChangeEventDetails) => {
              if (!open) {
                details.preventUnmountOnClose();
              }
            }}
          >
            <Popover.Trigger>Open</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner data-testid="positioner">
                <Popover.Popup>Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>,
        ),
      };
    }

    it('renders the backdrop before the positioner, with a hole for the trigger', async () => {
      const { result } = renderPopover(true);
      const { user } = await result;

      await user.click(screen.getByRole('button', { name: 'Open' }));
      await flushMicrotasks();

      const backdrop = screen.getByTestId('positioner').previousElementSibling as HTMLElement;
      expect(backdrop).toHaveAttribute('role', 'presentation');
      expect(backdrop).not.toHaveAttribute('inert');
      expect(backdrop.style.clipPath).toMatch(/^polygon\(/);
    });

    it('makes the backdrop inert while the popover closes', async () => {
      const { handle, result } = renderPopover(true);
      await result;
      handle.open(screen.getByRole('button', { name: 'Open' }).id);
      await flushMicrotasks();

      handle.close();
      await flushMicrotasks();

      const positioner = screen.getByTestId('positioner');
      expect(screen.getByText('Content')).toHaveAttribute('data-closed');
      expect(positioner.previousElementSibling).toHaveAttribute('inert');
    });

    it.each<{
      name: string;
      modal: boolean | 'trap-focus';
      reason: typeof REASONS.triggerPress | typeof REASONS.triggerHover;
    }>([
      { name: 'modal false', modal: false, reason: REASONS.triggerPress },
      { name: 'trap-focus', modal: 'trap-focus', reason: REASONS.triggerPress },
      { name: 'a hover open', modal: true, reason: REASONS.triggerHover },
    ])('renders no backdrop for $name', async ({ modal, reason }) => {
      const { handle, result } = renderPopover(modal);
      await result;
      const trigger = screen.getByRole('button', { name: 'Open' });

      handle.store.setOpen(
        true,
        createChangeEventDetails(reason, new MouseEvent('mousedown'), trigger),
      );
      await flushMicrotasks();

      expect(screen.getByText('Content')).toHaveAttribute('data-open');
      expect(screen.getByTestId('positioner').previousElementSibling).toBe(null);
    });
  });
});
