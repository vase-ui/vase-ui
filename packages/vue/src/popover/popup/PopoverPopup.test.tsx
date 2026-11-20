import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import type { VNodeChild } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { REASONS } from '../../internals/reasons';
import * as Popover from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  nextAnimationsRead,
  nextEvent,
  POPUP_EXIT_CSS,
  popupFocusPropsTests,
  screen,
  takeReportedMessages,
  waitFor,
  isVaporApp,
  isVaporParts,
} from '#test-utils';
import { isVueMinor } from '../../../test/vaporParts/isVueMinor';
import { createSlotHost } from '../../../test/fixtures/slotHost';
import PopoverPopupReplace from './PopoverPopupReplace.test.vue';

type ElementSlot = { props: Record<string, unknown>; elementRef: (target: unknown) => void };

describe('<Popover.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>{node}</Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('should render the children', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    expect(screen.getByText('Content')).not.toBe(null);
  });

  popupFocusPropsTests({
    render,
    createComponent: ({ children, ...focusProps }) => (
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup {...focusProps}>
              {children}
              <Popover.Close>Close</Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
  });

  it('VUE-138: keeps the popover open when focus moves from its trigger into the popup slot', async () => {
    const field = document.createElement('input');
    const root = createSlotHost(field);
    await render(
      <>
        <Popover.Root defaultOpen defaultTriggerId="trigger" modal={false}>
          <Popover.Trigger id="trigger">Toggle</Popover.Trigger>
          <Popover.Portal to={root}>
            <Popover.Positioner>
              <Popover.Popup initialFocus={false}>{h('slot')}</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <button>Outside</button>
      </>,
    );
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    trigger.focus();
    field.focus();
    await flushMicrotasks();
    expect(field).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    trigger.focus();
    screen.getByRole('button', { name: 'Outside' }).focus();
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  });

  it('focuses the popup when the active element becomes display:none', async () => {
    const TestComponent = defineComponent(() => {
      const hidden = shallowRef(false);
      return () => (
        <Popover.Root open>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">
                <button
                  data-testid="hide-button"
                  style={{ display: hidden.value ? 'none' : undefined }}
                  onClick={() => (hidden.value = true)}
                >
                  Hide
                </button>
                <input />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      );
    });

    const { user } = await render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('hide-button')).toHaveFocus();
    });

    await user.click(screen.getByTestId('hide-button'));

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
  });

  describe('openOnHover: delay + click', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns focus to the trigger if opened by click before the hover delay completes', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={300}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <Popover.Close>Close</Popover.Close>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByText('Open');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      vi.advanceTimersByTime(100);
      await flushMicrotasks();

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByText('Close')).not.toBe(null);

      vi.advanceTimersByTime(1000);
      await flushMicrotasks();

      await fireEvent.click(screen.getByText('Close'));
      await flushMicrotasks();

      expect(trigger).toHaveFocus();
    });
  });

  describe('inside a toolbar', () => {
    const ToolbarPopover = defineComponent((_props, { slots }) => {
      return (): VNodeChild => (
        <Toolbar.Root>
          <Toolbar.Button>First</Toolbar.Button>
          <Popover.Root>
            <Toolbar.Button
              v-slots={{
                element: ({ props, elementRef }: ElementSlot) => (
                  <Popover.Trigger {...props} ref={elementRef}>
                    Open
                  </Popover.Trigger>
                ),
              }}
            />
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>{slots.default?.()}</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <Toolbar.Button>Last</Toolbar.Button>
        </Toolbar.Root>
      );
    });

    it('does not relay composite keys from the popup to the toolbar', async () => {
      const { user } = await render(
        <ToolbarPopover>
          <button type="button">Inside</button>
        </ToolbarPopover>,
      );

      // The toolbar itself still navigates with the same key, so a passing assertion below can't
      // come from an inert toolbar.
      await user.keyboard('[Tab]');
      expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
      await user.keyboard('[ArrowRight]');
      const trigger = screen.getByRole('button', { name: 'Open' });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('[Enter]');
      const insideButton = screen.getByRole('button', { name: 'Inside' });
      await waitFor(() => {
        expect(insideButton).toHaveFocus();
      });

      await user.keyboard('[ArrowRight]');
      await flushMicrotasks();

      expect(insideButton).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Last' })).not.toHaveFocus();
    });

    // The toolbar acts only on a key of its items, so an arrow key moves the caret in the popup.
    it('keeps composite keys working inside the popup content', async () => {
      const { user } = await render(
        <ToolbarPopover>
          <input value="ab" />
        </ToolbarPopover>,
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      input.setSelectionRange(0, 0);
      await flushMicrotasks();

      await user.keyboard('[ArrowRight]');

      expect(input.selectionStart).toBe(1);
      expect(screen.getByRole('button', { name: 'Last' })).not.toHaveFocus();
    });
  });

  it('has the attributes of a dialog that the trigger controls', async () => {
    await render(
      <Popover.Root defaultOpen defaultTriggerId="trigger">
        <Popover.Trigger id="trigger">Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="popup">Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('role', 'dialog');
    expect(popup).toHaveAttribute('tabindex', '-1');
    expect(popup).toHaveAttribute('data-vase-ui-focusable');
    expect(popup).toHaveAttribute('data-open');
    expect(popup).toHaveAttribute('data-side', 'bottom');
    expect(popup).toHaveAttribute('data-align', 'center');
    expect(popup.id).not.toBe('');
    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'aria-controls',
      popup.id,
    );
  });

  it.each<{ name: string; modal: boolean | 'trap-focus'; expected: boolean }>([
    { name: 'modal', modal: true, expected: true },
    { name: 'trap-focus', modal: 'trap-focus', expected: true },
    { name: 'not modal', modal: false, expected: false },
  ])(
    'writes focusManagerModal while the popup has a close part: $name',
    async ({ modal, expected }) => {
      const handle = Popover.createHandle<unknown>();
      const hasClose = shallowRef(true);
      await render(() => (
        <Popover.Root defaultOpen modal={modal} handle={handle}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                {hasClose.value ? <Popover.Close>Close</Popover.Close> : null}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));
      await flushMicrotasks();
      expect(handle.store.state.focusManagerModal).toBe(expected);

      hasClose.value = false;
      await flushMicrotasks();

      expect(handle.store.state.focusManagerModal).toBe(false);
    },
  );

  // The compiled template of the fixture mounts the new popup before it unmounts the old popup. A
  // render function in TSX reuses the popup component, so it does not show this order.
  it('writes focusManagerModal for a new popup that replaces the old popup', async () => {
    const handle = Popover.createHandle<unknown>();
    const swapped = shallowRef(false);
    await render(() => (
      <Popover.Root defaultOpen modal handle={handle}>
        <Popover.Portal>
          <Popover.Positioner>
            <PopoverPopupReplace swapped={swapped.value} />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    await screen.findByTestId('old');
    await flushMicrotasks();
    expect(handle.store.state.focusManagerModal).toBe(true);

    swapped.value = true;
    await flushMicrotasks();

    expect(screen.queryByTestId('old')).toBe(null);
    expect(handle.store.state.focusManagerModal).toBe(false);
  });

  it('keeps the focus in a popup that a portal puts in the toolbar', async () => {
    const container = shallowRef<HTMLElement | null>(null);
    const { user } = await render(() => (
      <Toolbar.Root>
        <Toolbar.Button>First</Toolbar.Button>
        <Popover.Root defaultOpen>
          <Toolbar.Button
            v-slots={{
              element: ({ props, elementRef }: ElementSlot) => (
                <Popover.Trigger {...props} ref={elementRef}>
                  Open
                </Popover.Trigger>
              ),
            }}
          />
          <Popover.Portal to={container.value}>
            <Popover.Positioner>
              <Popover.Popup>
                <button type="button">Inside</button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <Toolbar.Button>Last</Toolbar.Button>
        <div ref={(element) => (container.value = element as HTMLElement | null)} />
      </Toolbar.Root>
    ));
    await flushMicrotasks();
    const insideButton = screen.getByRole('button', { name: 'Inside' });
    expect(screen.getByRole('toolbar').contains(insideButton)).toBe(true);

    insideButton.focus();
    await user.keyboard('[ArrowRight]');
    await flushMicrotasks();

    expect(insideButton).toHaveFocus();
  });

  it('has no transition while it starts', async () => {
    // The start lasts one frame, so an observer records the popup when the portal adds it.
    const starts: { isStarting: boolean; transition: string }[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          const popup = (node as Element).querySelector?.<HTMLElement>('[data-testid="popup"]');
          if (popup) {
            starts.push({
              isStarting: popup.hasAttribute('data-starting-style'),
              transition: popup.style.transition,
            });
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });
    onTestFinished(() => observer.disconnect());

    const open = shallowRef(false);
    await render(() => (
      <Popover.Root open={open.value}>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="popup">Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    open.value = true;
    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('data-open');
    });
    await waitFor(() => {
      expect(popup.style.transition).toBe('');
    });

    expect(starts).toEqual([{ isStarting: true, transition: 'none' }]);
  });

  it('keeps the element of a new popup that replaces the old popup, so a close completes', async () => {
    const swapped = shallowRef(false);
    const { user } = await render(() => (
      <Popover.Root defaultOpen>
        <Popover.Portal>
          <Popover.Positioner>
            <PopoverPopupReplace swapped={swapped.value} />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    await screen.findByTestId('old');

    swapped.value = true;
    await flushMicrotasks();
    expect(screen.queryByTestId('old')).toBe(null);

    await user.keyboard('[Escape]');
    expect(screen.queryByTestId('new')).toBe(null);
  });

  it('focuses the popup itself and not its field after a touch open', async () => {
    await render(
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="popup">
              <input data-testid="input" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    await fireEvent.click(trigger, { detail: 1 });

    // The focus on a field would open the virtual keyboard.
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
    expect(screen.getByTestId('input')).not.toHaveFocus();
  });

  it('moves the focus from the popup to the trigger with Shift+Tab, past an element between them', async () => {
    const { user } = await render(
      <Popover.Root>
        <Popover.Trigger>Open</Popover.Trigger>
        <button type="button">Between</button>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <input data-testid="input" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });

    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByTestId('input')).toHaveFocus();
    });

    await user.tab({ shift: true });

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('data-popup-open');
  });

  describe('hover', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('closes after the `closeDelay` of its trigger when the pointer leaves it', async () => {
      const onOpenChange = vi.fn();
      await render(
        <Popover.Root onOpenChange={onOpenChange}>
          <Popover.Trigger openOnHover delay={0} closeDelay={100}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner data-testid="positioner">
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
      const trigger = screen.getByRole('button', { name: 'Open' });
      await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      await fireEvent.mouseEnter(trigger);
      await flushMicrotasks();
      const positioner = screen.getByTestId('positioner');

      await fireEvent.mouseEnter(positioner);
      await fireEvent.mouseLeave(positioner);
      vi.advanceTimersByTime(99);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('data-popup-open');

      vi.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: REASONS.triggerHover }),
      );
    });
  });

  it('BUG-5519: returns the focus to the trigger when a dialog in a popover that a hover opened closes during the exit of the popover', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const onOpenChange = vi.fn();
    const onOpenChangeComplete = vi.fn();
    await render(() => (
      <div>
        <style>{POPUP_EXIT_CSS}</style>
        <Popover.Root onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
          <Popover.Trigger openOnHover delay={0} closeDelay={0}>
            Open popover
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner data-testid="positioner">
              <Popover.Popup class="popup" data-testid="popover-popup">
                <Dialog.Root>
                  <Dialog.Trigger>Open dialog</Dialog.Trigger>
                  <Dialog.Portal>
                    <Dialog.Popup data-testid="dialog-popup">
                      <Dialog.Close>Close dialog</Dialog.Close>
                    </Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    ));
    const trigger = screen.getByRole('button', { name: 'Open popover' });
    await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    await fireEvent.mouseEnter(trigger);
    const popoverPopup = await screen.findByTestId('popover-popup');
    expect(onOpenChange).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ reason: REASONS.triggerHover }),
    );
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });
    const positioner = screen.getByTestId('positioner');
    await fireEvent.mouseEnter(positioner);

    await nextEvent(document, 'focusin', {
      action: () => fireEvent.click(screen.getByRole('button', { name: 'Open dialog' })),
    });
    const dialogPopup = screen.getByTestId('dialog-popup');
    expect(dialogPopup.contains(document.activeElement)).toBe(true);

    const animations = await nextAnimationsRead(popoverPopup, {
      action: () => fireEvent.mouseLeave(positioner),
    });
    const finished = animations.map((animation) => animation.finished);
    expect(onOpenChange).toHaveBeenLastCalledWith(
      false,
      expect.objectContaining({ reason: REASONS.triggerHover }),
    );
    expect(popoverPopup).toBeInTheDocument();
    expect(popoverPopup).toHaveAttribute('data-ending-style');
    expect(dialogPopup.contains(document.activeElement)).toBe(true);

    await fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    await waitFor(() => {
      expect(dialogPopup).not.toBeInTheDocument();
    });

    expect(screen.queryByTestId('dialog-popup')).toBe(null);
    expect(popoverPopup).toBeInTheDocument();
    expect(trigger).toHaveFocus();

    for (const animation of animations) {
      animation.finish();
    }
    await Promise.all(finished);
    await flushMicrotasks();

    expect(screen.queryByTestId('popover-popup')).toBe(null);
    expect(trigger).toHaveFocus();
  });

  it('throws a descriptive error when rendered outside <Popover.Positioner>', async () => {
    await expect(
      render(
        <Popover.Root open>
          <Popover.Portal>
            <Popover.Popup />
          </Popover.Portal>
        </Popover.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A popup, an arrow or a viewport of Popover must be inside <Popover.Positioner>.',
    );
    // The portal renders its content in an update after the mount, so Vue also warns about it.
    expect(takeReportedMessages()).toHaveLength(2);
  });

  // In Vue 3.5.12, a `setup` that throws leaves the current instance set, and a later case of the
  // file can then get a warning about a slot. The case that renders no slot thus comes last.
  // On Vue 3.6.0-rc.15, a Vapor app takes the instance left by the earlier setup error as
  // its root's parent. The virtual DOM part then finds the earlier root.
  it(
    'throws a descriptive error when rendered outside <Popover.Root>',
    { fails: isVaporApp && !isVaporParts && !isVueMinor },
    async () => {
      await expect(render(<Popover.Popup />)).rejects.toThrow(
        'Vase UI: A part of Popover must be inside <Popover.Root>.',
      );
      expect(takeReportedMessages()).toHaveLength(1);
    },
  );
});
