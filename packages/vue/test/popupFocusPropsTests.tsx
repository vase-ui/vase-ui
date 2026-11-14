import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { PropType, ShallowRef, VNode, VNodeChild } from 'vue';
import { isInaccessible, screen, waitFor } from '@testing-library/dom';
import type { InteractionType } from '../src/common/useEnhancedClickHandler';
import type { FocusOption } from '../src/utils/popups/focus/FloatingFocusManager.vue';
import type { createRenderer } from './createRenderer';
import { fireEvent } from './fireEvent';
import { flushMicrotasks } from './flushMicrotasks';
import { waitSingleFrame } from './wait';

/**
 * Value resolution of the `initialFocus` and `finalFocus` popup props: elements, refs, functions
 * and their `true`/`null`/`false`/`undefined` results, and the interaction type passed to functions.
 */
export function popupFocusPropsTests(config: PopupFocusPropsTestsConfig) {
  const {
    render,
    createComponent,
    initialFocus: testInitialFocus = true,
    triggerRole = 'button',
    alwaysMounted = false,
    mouseCloseType = 'mouse',
    outsideElementsInert = false,
  } = config;

  const Test = defineComponent({
    props: {
      popupProps: { type: Object as PropType<PopupFocusProps>, default: () => ({}) },
      withPopupInputs: { type: Boolean, default: false },
    },
    setup(props) {
      const outsideRef = shallowRef<HTMLInputElement | null>(null);
      const insideRef = shallowRef<HTMLInputElement | null>(null);

      const targets: FocusTargets = { outside: outsideRef, inside: insideRef };
      const resolve = (value: PopupFocusPropFactory) =>
        typeof value === 'function' ? value(targets) : value;

      return () => (
        <div>
          <input data-testid="outside-before" />
          {createComponent({
            initialFocus: resolve(props.popupProps.initialFocus),
            finalFocus: resolve(props.popupProps.finalFocus),
            children: props.withPopupInputs ? (
              <>
                <input data-testid="inside-1" />
                <input data-testid="inside-2" ref={insideRef} />
              </>
            ) : null,
          })}
          <input data-testid="outside-target" ref={outsideRef} />
        </div>
      );
    },
  });

  // A combobox trigger is named by its label rather than its content, so find it by role alone.
  const getTrigger = () =>
    triggerRole === 'combobox'
      ? screen.getByRole('combobox')
      : screen.getByRole('button', { name: 'Open' });

  function expectClosed() {
    if (alwaysMounted) {
      expect(isInaccessible(screen.getByText('Close'))).toBe(true);
    } else {
      expect(screen.queryByText('Close')).toBe(null);
    }
  }

  // An inert trigger cannot keep the focus (BUG-4678), so only the inputs of the popup are checked.
  function expectFocusNotMovedFrom(trigger: HTMLElement) {
    if (outsideElementsInert) {
      expect(screen.getByTestId('inside-1')).not.toHaveFocus();
      expect(screen.getByTestId('inside-2')).not.toHaveFocus();
    } else {
      expect(trigger).toHaveFocus();
    }
  }

  async function findClickableClose() {
    const close = await screen.findByText('Close');
    // Positioners ignore pointer events until they have been positioned.
    await waitFor(() => {
      expect(getComputedStyle(close).pointerEvents).not.toBe('none');
    });
    return close;
  }

  async function closeWithPointer(user: Awaited<ReturnType<typeof render>>['user']) {
    await user.click(await findClickableClose());
  }

  if (testInitialFocus) {
    describe('prop: initialFocus', () => {
      it('focuses the first focusable element by default', async () => {
        const { user } = await render(<Test withPopupInputs />);

        await user.click(getTrigger());
        await waitFor(() => {
          expect(screen.getByTestId('inside-1')).toHaveFocus();
        });
      });

      it('focuses the element of a ref', async () => {
        const { user } = await render(
          <Test withPopupInputs popupProps={{ initialFocus: ({ inside }) => inside }} />,
        );

        await user.click(getTrigger());
        await waitFor(() => {
          expect(screen.getByTestId('inside-2')).toHaveFocus();
        });
      });

      it.each([
        {
          name: 'an element',
          returns: ({ inside }: FocusTargets) => inside.value,
          focused: 'inside-2',
        },
        // `true` and `null` keep the default target, so the spy proves the function was consulted.
        { name: 'true', returns: () => true, focused: 'inside-1' },
        { name: 'null', returns: () => null, focused: 'inside-1' },
      ])(
        'focuses the right element when a function returns $name',
        async ({ returns, focused }) => {
          const initialFocusSpy = vi.fn();
          const { user } = await render(
            <Test
              withPopupInputs
              popupProps={{
                initialFocus: (targets) => (openType: InteractionType) => {
                  initialFocusSpy(openType);
                  return returns(targets);
                },
              }}
            />,
          );

          await user.click(getTrigger());
          await waitFor(() => {
            expect(screen.getByTestId(focused)).toHaveFocus();
          });
          expect(initialFocusSpy).toHaveBeenCalledTimes(1);
        },
      );

      it('does not move focus when `false`', async () => {
        const { user } = await render(
          <Test withPopupInputs popupProps={{ initialFocus: false }} />,
        );

        const trigger = getTrigger();
        await user.click(trigger);
        await screen.findByText('Close');
        await waitSingleFrame();
        await flushMicrotasks();

        expectFocusNotMovedFrom(trigger);
      });

      it('passes the interaction type to a function, and does nothing when it returns undefined', async () => {
        const initialFocusSpy = vi.fn();

        const { user } = await render(
          <Test
            withPopupInputs
            popupProps={{
              initialFocus:
                ({ inside }) =>
                (openType: InteractionType) => {
                  initialFocusSpy(openType);
                  return openType === 'keyboard' ? inside.value : undefined;
                },
            }}
          />,
        );

        const trigger = getTrigger();

        // The click of user-event is a `PointerEvent` with no pointer type, and the trigger reads
        // the type of the click. The mouse press is thus dispatched directly.
        trigger.focus();
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        await fireEvent.click(trigger, { detail: 1 });
        await waitFor(() => {
          expect(initialFocusSpy).toHaveBeenLastCalledWith('mouse');
        });
        expectFocusNotMovedFrom(trigger);

        await user.keyboard('[Escape]');
        await waitFor(() => {
          expectClosed();
        });

        trigger.focus();
        await flushMicrotasks();
        await user.keyboard('[Enter]');
        await waitFor(() => {
          expect(screen.getByTestId('inside-2')).toHaveFocus();
        });
        expect(initialFocusSpy).toHaveBeenLastCalledWith('keyboard');

        await user.keyboard('[Escape]');
        await waitFor(() => {
          expectClosed();
        });

        await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        await fireEvent.click(trigger, { detail: 1 });
        await waitFor(() => {
          expect(initialFocusSpy).toHaveBeenLastCalledWith('touch');
        });
        expect(initialFocusSpy).toHaveBeenCalledTimes(3);
      });

      it('is not called again when the popup closes', async () => {
        const initialFocusSpy = vi.fn();

        const { user } = await render(
          <Test
            withPopupInputs
            popupProps={{
              initialFocus:
                ({ inside }) =>
                () => {
                  initialFocusSpy();
                  return inside.value;
                },
            }}
          />,
        );

        await user.click(getTrigger());
        await waitFor(() => {
          expect(screen.getByTestId('inside-2')).toHaveFocus();
        });
        expect(initialFocusSpy).toHaveBeenCalledTimes(1);

        await closeWithPointer(user);
        await waitFor(() => {
          expect(getTrigger()).toHaveFocus();
        });
        expect(initialFocusSpy).toHaveBeenCalledTimes(1);
      });
    });
  }

  describe('prop: finalFocus', () => {
    it('focuses the trigger by default', async () => {
      const { user } = await render(<Test />);

      await user.click(getTrigger());
      await closeWithPointer(user);

      await waitFor(() => {
        expect(getTrigger()).toHaveFocus();
      });
    });

    it('focuses the element of a ref', async () => {
      const { user } = await render(<Test popupProps={{ finalFocus: ({ outside }) => outside }} />);

      await user.click(getTrigger());
      await closeWithPointer(user);

      await waitFor(() => {
        expect(screen.getByTestId('outside-target')).toHaveFocus();
      });
    });

    it.each([
      {
        name: 'an element',
        returns: ({ outside }: FocusTargets) => outside.value,
        getFocused: () => screen.getByTestId('outside-target'),
      },
      // `true` and `null` keep the default target, so the spy proves the function was consulted.
      { name: 'true', returns: () => true, getFocused: getTrigger },
      { name: 'null', returns: () => null, getFocused: getTrigger },
    ])(
      'focuses the right element when a function returns $name',
      async ({ returns, getFocused }) => {
        const finalFocusSpy = vi.fn();
        const { user } = await render(
          <Test
            popupProps={{
              finalFocus: (targets) => (closeType: InteractionType) => {
                finalFocusSpy(closeType);
                return returns(targets);
              },
            }}
          />,
        );

        await user.click(getTrigger());
        await closeWithPointer(user);

        await waitFor(() => {
          expect(getFocused()).toHaveFocus();
        });
        expect(finalFocusSpy).toHaveBeenCalledTimes(1);
      },
    );

    it('does not move focus when `false`', async () => {
      const { user } = await render(<Test popupProps={{ finalFocus: false }} />);

      await user.click(getTrigger());
      await closeWithPointer(user);
      await waitFor(() => {
        expectClosed();
      });
      await waitSingleFrame();
      await flushMicrotasks();

      expect(getTrigger()).not.toHaveFocus();
      if (!alwaysMounted) {
        // The focused close control was removed, so focus falls back to the body.
        expect(document.body).toHaveFocus();
      }
    });

    it('passes the close type to a function', async () => {
      const finalFocusSpy = vi.fn();

      const { user } = await render(
        <Test
          popupProps={{
            finalFocus:
              ({ outside }) =>
              (closeType: InteractionType) => {
                finalFocusSpy(closeType);
                return closeType === 'keyboard' ? outside.value : true;
              },
          }}
        />,
      );

      const trigger = getTrigger();

      await user.click(trigger);
      // user-event's synthetic clicks carry no pointer type, so the mouse press is dispatched
      // directly.
      const close = await findClickableClose();
      await fireEvent.pointerDown(close, { pointerType: 'mouse' });
      await fireEvent.click(close, { detail: 1 });
      await waitFor(() => {
        expectClosed();
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(finalFocusSpy).toHaveBeenNthCalledWith(1, mouseCloseType);

      await user.click(trigger);
      await screen.findByText('Close');
      await waitSingleFrame();
      await flushMicrotasks();
      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.getByTestId('outside-target')).toHaveFocus();
      });
      expect(finalFocusSpy).toHaveBeenNthCalledWith(2, 'keyboard');
      expect(finalFocusSpy).toHaveBeenCalledTimes(2);
    });
  });
}

interface FocusTargets {
  /**
   * An input rendered after the popup, outside of it.
   */
  outside: ShallowRef<HTMLInputElement | null>;
  /**
   * The second of two inputs rendered inside the popup.
   */
  inside: ShallowRef<HTMLInputElement | null>;
}

/**
 * A plain value, or a factory that builds the prop value from the test's focus targets.
 */
type PopupFocusPropFactory = boolean | undefined | ((targets: FocusTargets) => FocusOption);

interface PopupFocusProps {
  initialFocus?: PopupFocusPropFactory;
  finalFocus?: PopupFocusPropFactory;
}

export interface PopupFocusPropsTestsConfig {
  /**
   * Render function returned from `createRenderer`.
   */
  render: ReturnType<typeof createRenderer>['render'];
  /**
   * Returns the popup tree. It must render a trigger labeled "Open", spread `initialFocus` and
   * `finalFocus` on the popup, and render `children` followed by a control labeled "Close" that
   * closes the popup when clicked.
   */
  createComponent: (props: {
    initialFocus: FocusOption | undefined;
    finalFocus: FocusOption | undefined;
    children: VNodeChild;
  }) => VNode;
  /**
   * Whether the popup accepts `initialFocus`.
   * @default true
   */
  initialFocus?: boolean;
  /**
   * The role of the trigger. A `button` trigger must be labeled "Open"; there must be only one
   * `combobox`.
   * @default 'button'
   */
  triggerRole?: 'button' | 'combobox';
  /**
   * Whether the popup stays mounted (inaccessible) after it closes.
   * @default false
   */
  alwaysMounted?: boolean;
  /**
   * The close type passed to a `finalFocus` function when the "Close" control is clicked with a
   * mouse. Only set it to document a popup whose close control doesn't report the pointer type.
   * @default 'mouse'
   */
  mouseCloseType?: InteractionType;
  /**
   * Whether the open popup sets `inert` on the elements outside it (BUG-4678). The trigger then
   * cannot keep the focus.
   * @default false
   */
  outsideElementsInert?: boolean;
}
