import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { computed, defineComponent, provide, shallowRef } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { CheckboxRootContext } from '../root/CheckboxRootContext';
import CheckboxIndicatorHydration from './CheckboxIndicatorHydration.test.vue';

const HYDRATION_FIXTURE = 'src/checkbox/indicator/CheckboxIndicatorHydration.test.vue';

const testContext: CheckboxRootContext = computed(() => ({
  checked: true,
  disabled: false,
  readOnly: false,
  required: false,
  indeterminate: false,
  dirty: false,
  touched: false,
  valid: null,
  filled: false,
  focused: false,
}));

const TestContext = defineComponent((_, { slots }) => {
  provide(CheckboxRootContext, testContext);
  return () => slots.default?.();
});

describe('<Checkbox.Indicator />', () => {
  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(<Checkbox.Indicator />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(<TestContext>{node}</TestContext>);
    },
  }));

  it('should not render indicator by default', async () => {
    await render(
      <Checkbox.Root>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>,
    );
    const indicator = screen.queryByTestId('indicator');
    expect(indicator).toBe(null);
  });

  it('should render indicator when checked', async () => {
    await render(
      <Checkbox.Root checked>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>,
    );
    const indicator = screen.getByTestId('indicator');
    expect(indicator).not.toBe(null);
  });

  describe('prop: keepMounted', () => {
    it('should keep indicator mounted when unchecked', async () => {
      await render(
        <Checkbox.Root>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>,
      );
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.toBe(null);
    });

    it('should keep indicator mounted when checked', async () => {
      await render(
        <Checkbox.Root checked>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>,
      );
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.toBe(null);
    });

    it('should keep indicator mounted when indeterminate', async () => {
      await render(
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>,
      );
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.toBe(null);
    });
  });

  it('should remove the indicator when there is no exit animation defined', async () => {
    const Test = defineComponent(() => {
      const checked = shallowRef(true);
      return () => (
        <div>
          <button
            onClick={() => {
              checked.value = false;
            }}
          >
            Close
          </button>
          <Checkbox.Root checked={checked.value}>
            <Checkbox.Indicator data-testid="indicator" />
          </Checkbox.Root>
        </div>
      );
    });

    const { user } = await render(<Test />);

    expect(screen.getByTestId('indicator')).not.toBe(null);

    const closeButton = screen.getByText('Close');

    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('indicator')).toBe(null);
    });
  });

  it('should remove the indicator when the animation finishes', async () => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    let animationFinished = false;
    const notifyAnimationFinished = () => {
      animationFinished = true;
    };

    const style = `
      @keyframes test-anim {
        to {
          opacity: 0;
        }
      }

      .animation-test-indicator[data-ending-style] {
        animation: test-anim 1ms;
      }
    `;

    const Test = defineComponent(() => {
      const checked = shallowRef(true);
      return () => (
        <div>
          <style>{style}</style>
          <button
            onClick={() => {
              checked.value = false;
            }}
          >
            Close
          </button>
          <Checkbox.Root checked={checked.value}>
            <Checkbox.Indicator
              class="animation-test-indicator"
              data-testid="indicator"
              onAnimationend={notifyAnimationFinished}
              keepMounted
            />
          </Checkbox.Root>
        </div>
      );
    });

    const { user } = await render(<Test />);
    expect(screen.getByTestId('indicator')).not.toBe(null);

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(animationFinished).toBe(true);
    });
  });

  describe.skipIf(isJSDOM)('animations', () => {
    afterEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      let transitionFinished = false;
      const getAnimations = vi.fn((): Animation[] => []);

      function notifyTransitionFinished() {
        transitionFinished = true;
      }

      function handleIndicatorRef(element: HTMLSpanElement | null) {
        if (element) {
          element.getAnimations = getAnimations;
        }
      }

      const style = `
        .animation-test-indicator {
          transition: opacity 1ms;
        }

        .animation-test-indicator[data-starting-style],
        .animation-test-indicator[data-ending-style] {
          opacity: 0;
        }
      `;

      const Test = defineComponent(() => {
        const checked = shallowRef(false);

        function handleCheck() {
          checked.value = true;
        }

        return () => (
          <div>
            <style>{style}</style>
            <button onClick={handleCheck}>Check</button>
            <Checkbox.Root checked={checked.value}>
              <Checkbox.Indicator
                class="animation-test-indicator"
                data-testid="indicator"
                onTransitionend={notifyTransitionFinished}
                v-slots={{
                  render: ({ props }: { props: Record<string, any> }) => (
                    <span
                      {...props}
                      ref={(element: any) => {
                        props.ref(element);
                        handleIndicatorRef(element);
                      }}
                    />
                  ),
                }}
              />
            </Checkbox.Root>
          </div>
        );
      });

      const { user } = await render(<Test />);
      expect(screen.queryByTestId('indicator')).toBe(null);

      await user.click(screen.getByText('Check'));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('indicator')).not.toBe(null);
      expect(getAnimations).not.toHaveBeenCalled();
    });

    it('applies data-ending-style before unmount', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-indicator[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      const Test = defineComponent(() => {
        const checked = shallowRef(true);

        function handleUncheck() {
          checked.value = false;
        }

        return () => (
          <div>
            <style>{style}</style>
            <button onClick={handleUncheck}>Uncheck</button>
            <Checkbox.Root checked={checked.value}>
              <Checkbox.Indicator class="animation-test-indicator" data-testid="indicator" />
            </Checkbox.Root>
          </div>
        );
      });

      await render(<Test />);
      expect(screen.getByTestId('indicator')).not.toBe(null);

      // `user.click` can yield a frame, which is long enough for the 1ms animation to finish.
      await fireEvent.click(screen.getByText('Uncheck'));

      expect(screen.getByTestId('indicator')).toHaveAttribute('data-ending-style');

      await waitFor(() => {
        expect(screen.queryByTestId('indicator')).toBe(null);
      });
    });

    it('removes all indicators in a single commit when multiple checkboxes are unchecked', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-indicator[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      const Test = defineComponent(() => {
        const checked = shallowRef(true);

        function handleUncheck() {
          checked.value = false;
        }

        return () => (
          <div>
            <style>{style}</style>
            <button onClick={handleUncheck}>Uncheck</button>
            {Array.from({ length: 10 }, (_, index) => (
              <Checkbox.Root checked={checked.value} key={index}>
                <Checkbox.Indicator
                  class="animation-test-indicator"
                  data-testid={`indicator-${index}`}
                />
              </Checkbox.Root>
            ))}
          </div>
        );
      });

      const { container, user } = await render(<Test />);

      // One Vue flush changes the DOM in one task, so it calls the observer one time.
      const indicatorCounts: number[] = [];
      const observer = new MutationObserver(() => {
        indicatorCounts.push(container.querySelectorAll('[data-testid^="indicator-"]').length);
      });
      observer.observe(container, { childList: true, subtree: true });
      onTestFinished(() => observer.disconnect());

      await user.click(screen.getByText('Uncheck'));

      await waitFor(() => {
        expect(screen.queryByTestId('indicator-0')).toBe(null);
      });
      expect(screen.queryByTestId('indicator-9')).toBe(null);

      expect(indicatorCounts).toContain(0);
      expect(indicatorCounts.every((count) => count === 0 || count === 10)).toBe(true);
    });
  });

  describe('state', () => {
    it('follows a change of `indeterminate`', async () => {
      const { setProps } = await render(
        <Checkbox.Root defaultChecked>
          <Checkbox.Indicator data-testid="indicator" />
        </Checkbox.Root>,
      );
      const indicator = screen.getByTestId('indicator');
      expect(indicator).toHaveAttribute('data-checked', '');

      await setProps({ indeterminate: true });

      expect(screen.getByTestId('indicator')).toBe(indicator);
      expect(indicator).toHaveAttribute('data-indeterminate', '');
      expect(indicator).not.toHaveAttribute('data-checked');

      await setProps({ indeterminate: false });

      expect(indicator).toHaveAttribute('data-checked', '');
      expect(indicator).not.toHaveAttribute('data-indeterminate');
    });
  });

  describe('server-side rendering', () => {
    it.each([
      { name: 'a checkbox that is on', props: { defaultChecked: true } },
      { name: 'an indeterminate checkbox', props: { indeterminate: true } },
      { name: 'a checkbox that is off', props: {} },
      { name: 'a kept indicator that is off', props: { keepMounted: true } },
    ])('hydrates $name with no mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      await hydrate(CheckboxIndicatorHydration, { serverHtml, props });
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
  it('throws a descriptive error when rendered outside <Checkbox.Root>', async () => {
    await expect(render(<Checkbox.Indicator />)).rejects.toThrow(
      'Vase UI: A part of Checkbox must be inside <Checkbox.Root>. Without a root the part has no state to show. Put the part inside <Checkbox.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
