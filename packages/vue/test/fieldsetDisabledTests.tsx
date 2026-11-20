import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { shallowRef } from 'vue';
import type { VNode, VNodeChild } from 'vue';
import type { createRenderer } from './createRenderer';
import { flushMicrotasks } from './flushMicrotasks';
import { enterWithMouse, moveMouse } from './pointer';
import { screen } from './queries';

export interface FieldsetButtonTestProps {
  as?: 'button' | 'span';
  nativeButton?: boolean;
  disabled?: boolean;
  'data-testid': string;
  onClick?: () => void;
}

export interface FieldsetDisabledTestsConfig {
  /** Render function returned from `createRenderer`. */
  render: ReturnType<typeof createRenderer>['render'];
  /** Returns the part with these props and slots. */
  part: (
    props: FieldsetButtonTestProps,
    slots: { default: (props: { state: { disabled: boolean } }) => VNodeChild },
  ) => VNode;
  /**
   * Returns the providers of the part around `children`. The suite puts each fieldset in
   * `children`, so the providers are outside the fieldset.
   */
  root: (children: VNode) => VNode;
  /**
   * Set it for a trigger that opens its popup 100 ms after a hover. The suite then also asserts
   * that a disabled fieldset stops that open.
   */
  hover?: boolean;
}

/** The shared suite of a native button part in a disabled fieldset (`VUE-112`). */
export function fieldsetDisabledTests(config: FieldsetDisabledTestsConfig) {
  const { render, part, root, hover } = config;

  function target(props: Partial<FieldsetButtonTestProps> = {}) {
    return part(
      { 'data-testid': 'target', ...props },
      { default: ({ state }) => (state.disabled ? 'Disabled' : 'Enabled') },
    );
  }

  function expectDisabled(element: HTMLElement, disabled: boolean) {
    expect(element.hasAttribute('data-disabled')).toBe(disabled);
    expect(element.textContent).toBe(disabled ? 'Disabled' : 'Enabled');
    if (disabled) {
      expect(
        element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true',
      ).toBe(true);
    }
  }

  describe('VUE-112: a disabled fieldset', () => {
    it('follows the fieldset around the part with its root outside', async () => {
      const disabled = shallowRef(false);
      await render(() => root(<fieldset disabled={disabled.value}>{target()}</fieldset>));
      const button = screen.getByTestId('target');
      expectDisabled(button, false);

      disabled.value = true;
      await flushMicrotasks();
      expect(button.matches(':disabled')).toBe(true);
      expectDisabled(button, true);

      disabled.value = false;
      await flushMicrotasks();
      expectDisabled(button, false);
      expect(button.matches(':disabled')).toBe(false);
    });

    it('keeps the first legend exception through a nested fieldset and a new legend', async () => {
      await render(() =>
        root(
          <fieldset disabled data-testid="fieldset">
            <legend>
              <fieldset>{target()}</fieldset>
            </legend>
          </fieldset>,
        ),
      );
      const button = screen.getByTestId('target');
      expectDisabled(button, false);
      const legend = document.createElement('legend');
      screen.getByTestId('fieldset').prepend(legend);
      await flushMicrotasks();
      expectDisabled(button, true);

      legend.remove();
      await flushMicrotasks();
      expectDisabled(button, false);
    });

    it('keeps the explicit disabled prop after the fieldset becomes enabled', async () => {
      const disabled = shallowRef(true);
      const ownDisabled = shallowRef(false);
      await render(() =>
        root(
          <fieldset disabled={disabled.value}>{target({ disabled: ownDisabled.value })}</fieldset>,
        ),
      );
      const button = screen.getByTestId('target');
      expectDisabled(button, true);

      ownDisabled.value = true;
      disabled.value = false;
      await flushMicrotasks();
      expectDisabled(button, true);

      ownDisabled.value = false;
      await flushMicrotasks();
      expectDisabled(button, false);
    });

    it('leaves a replacement non-native element enabled', async () => {
      const native = shallowRef(true);
      const click = vi.fn();
      await render(() =>
        root(
          <fieldset disabled>
            {target({
              as: native.value ? 'button' : 'span',
              nativeButton: native.value,
              onClick: click,
            })}
          </fieldset>,
        ),
      );
      const button = screen.getByTestId('target');
      expectDisabled(button, true);

      native.value = false;
      await flushMicrotasks();
      const custom = screen.getByTestId('target');
      expect(custom.tagName).toBe('SPAN');
      expectDisabled(custom, false);
      await userEvent.click(custom);
      expect(click).toHaveBeenCalledOnce();
    });

    if (hover) {
      function mockTimers() {
        vi.useFakeTimers();
        onTestFinished(() => {
          vi.useRealTimers();
        });
      }

      async function tick() {
        vi.advanceTimersByTime(1000);
        await flushMicrotasks();
      }

      it('blocks hover only for the trigger in the disabled fieldset', async () => {
        mockTimers();
        await render(() =>
          root(
            <>
              <fieldset disabled>{target()}</fieldset>
              {target({ 'data-testid': 'enabled' })}
            </>,
          ),
        );
        const button = screen.getByTestId('target');
        expectDisabled(button, true);
        await userEvent.hover(button);
        await tick();
        expect(button).not.toHaveAttribute('data-popup-open');

        const enabled = screen.getByTestId('enabled');
        await userEvent.hover(enabled);
        await tick();
        expect(enabled).toHaveAttribute('data-popup-open');
        expect(button).not.toHaveAttribute('data-popup-open');
      });

      it('cancels a hover open when the fieldset becomes disabled', async () => {
        mockTimers();
        const disabled = shallowRef(false);
        await render(() => root(<fieldset disabled={disabled.value}>{target()}</fieldset>));
        const button = screen.getByTestId('target');
        await enterWithMouse(button);
        expect(button).not.toHaveAttribute('data-popup-open');

        disabled.value = true;
        await flushMicrotasks();
        expectDisabled(button, true);
        await tick();
        expect(button).not.toHaveAttribute('data-popup-open');

        await moveMouse(button, document.body);
        disabled.value = false;
        await flushMicrotasks();
        await enterWithMouse(button);
        await tick();
        expect(button).toHaveAttribute('data-popup-open');
      });
    }
  });
}
