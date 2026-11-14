import { describe, expect, it } from 'vitest';
import { h, shallowRef } from 'vue';
import type { Component } from 'vue';
import {
  createRenderer,
  createTransitionRunCounter,
  describeConformance,
  fireEvent,
  isJSDOM,
  nextEvent,
  screen,
  waitFor,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Combobox from '../index.parts';

describe('<Combobox.Clear />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Clear />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render(node) {
      return render(
        <Combobox.Root defaultValue="a">
          <Combobox.Input />
          {node}
        </Combobox.Root>,
      );
    },
  }));

  it('renders in single mode when a value is selected', async () => {
    await render(
      <Combobox.Root defaultValue="a">
        <Combobox.Input />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>,
    );
    expect(screen.getByTestId('clear')).not.toBe(null);
  });

  it('does not render without a value by default', async () => {
    await render(
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>,
    );

    expect(screen.queryByTestId('clear')).toBe(null);
  });

  it('clears after pointer interaction marks keyboard navigation inactive', async () => {
    const { user } = await render(
      <Combobox.Root defaultValue="a">
        <Combobox.Input data-testid="input" />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>,
    );

    await fireEvent.pointerMove(screen.getByTestId('input'));
    await user.click(screen.getByTestId('clear'));

    expect(screen.queryByTestId('clear')).toBe(null);
  });

  it('is disabled when root disabled and does nothing on click', async () => {
    await render(
      <Combobox.Root defaultValue="a" disabled>
        <Combobox.Input data-testid="input" />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>,
    );

    const clear = screen.getByTestId('clear');
    expect(clear).toHaveAttribute('disabled');

    await fireEvent.click(clear);
    expect(screen.getByTestId('clear')).not.toBe(null);
  });

  it('when root is readOnly it does nothing on click', async () => {
    await render(
      <Combobox.Root defaultValue="a" readOnly>
        <Combobox.Input data-testid="input" />
        <Combobox.Clear data-testid="clear" />
      </Combobox.Root>,
    );

    const clear = screen.getByTestId('clear');

    await fireEvent.click(clear);
    expect(screen.getByTestId('clear')).not.toBe(null);
  });

  describe.skipIf(isJSDOM)('animations', () => {
    it('triggers exit animation via data-ending-style before unmount', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      let animationFinished = false;
      const notifyAnimationFinished = () => {
        animationFinished = true;
      };

      const style = `
        .animation-test-indicator {
          transition: opacity 1ms;
        }

        .animation-test-indicator[data-starting-style],
        .animation-test-indicator[data-ending-style] {
          opacity: 0;
        }
      `;

      const { user } = await render(
        <div>
          <style>{style}</style>
          <Combobox.Root defaultValue="a">
            <Combobox.Input data-testid="input" />
            <Combobox.Clear
              class="animation-test-indicator"
              data-testid="clear"
              keepMounted
              onTransitionend={notifyAnimationFinished}
            />
          </Combobox.Root>
        </div>,
      );

      const clear = screen.getByTestId('clear');
      expect(clear).not.toBe(null);

      await user.click(clear);

      await waitFor(() => {
        expect(animationFinished).toBe(true);
      });
    });
  });

  it('shows x in the children component of the #render slot', async () => {
    await render(
      <Combobox.Root defaultValue="a">
        <Combobox.Clear
          data-testid="clear"
          v-slots={{
            render: ({ props, children }: { props: HTMLProps; children: Component }) => (
              <button {...props}>{h(children)}</button>
            ),
          }}
        />
      </Combobox.Root>,
    );

    expect(screen.getByTestId('clear').textContent).toBe('x');
  });

  it('the clear button is in the DOM until its exit animation ends', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    const value = shallowRef<string | null>('a');
    const counter = createTransitionRunCounter(() => value.value !== null);
    const { user } = await render(() => (
      <>
        <style>{`.clear { transition: opacity 100ms; } .clear[data-ending-style] { opacity: 0; }`}</style>
        <Combobox.Root
          value={value.value}
          onValueChange={(next: string | null) => {
            value.value = next;
          }}
        >
          <Combobox.Input />
          <Combobox.Clear
            class="clear"
            data-testid="clear"
            onTransitionrun={counter.onTransitionrun}
          />
        </Combobox.Root>
      </>
    ));
    const clear = screen.getByTestId('clear');

    await nextEvent(clear, 'transitionend', {
      after: 'transitionrun',
      action: () => user.click(clear),
    });
    await waitFor(() => {
      expect(screen.queryByTestId('clear')).toBe(null);
    });

    expect(counter.counts).toEqual({ enter: 0, exit: 1 });
  });
});
