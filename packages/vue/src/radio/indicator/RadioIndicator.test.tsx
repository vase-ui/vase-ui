import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
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
import RadioIndicatorHydration from './RadioIndicatorHydration.test.vue';

const HYDRATION_FIXTURE = 'src/radio/indicator/RadioIndicatorHydration.test.vue';

function readDataAttributes(element: Element) {
  return element
    .getAttributeNames()
    .filter((name) => name.startsWith('data-') && name !== 'data-testid')
    .sort();
}

describe('<Radio.Indicator />', () => {
  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(<Radio.Indicator />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(<Radio.Root value="">{node}</Radio.Root>);
    },
  }));

  it('should remove the indicator when there is no exit animation defined', async () => {
    const Test = defineComponent(() => {
      const value = shallowRef('a');

      return () => (
        <div>
          <button
            onClick={() => {
              value.value = 'b';
            }}
          >
            Close
          </button>
          <RadioGroup value={value.value}>
            <Radio.Root value="a">
              <Radio.Indicator class="animation-test-indicator" data-testid="indicator-a" />
            </Radio.Root>
            <Radio.Root value="a">
              <Radio.Indicator class="animation-test-indicator" />
            </Radio.Root>
          </RadioGroup>
        </div>
      );
    });

    const { user } = await render(<Test />);

    expect(screen.getByTestId('indicator-a')).not.toBe(null);

    const closeButton = screen.getByText('Close');

    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('indicator-a')).toBe(null);
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
      const value = shallowRef('a');

      return () => (
        <div>
          <style>{style}</style>
          <button
            onClick={() => {
              value.value = 'b';
            }}
          >
            Close
          </button>
          <RadioGroup value={value.value}>
            <Radio.Root value="a">
              <Radio.Indicator
                class="animation-test-indicator"
                keepMounted
                onAnimationend={notifyAnimationFinished}
                data-testid="indicator-a"
              />
            </Radio.Root>
            <Radio.Root value="a">
              <Radio.Indicator class="animation-test-indicator" keepMounted />
            </Radio.Root>
          </RadioGroup>
        </div>
      );
    });

    const { user } = await render(<Test />);

    expect(screen.getByTestId('indicator-a')).not.toBe(null);

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
      function notifyTransitionFinished() {
        transitionFinished = true;
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
        const value = shallowRef('b');

        function handleSelectA() {
          value.value = 'a';
        }

        return () => (
          <div>
            <style>{style}</style>
            <button onClick={handleSelectA}>Select a</button>
            <RadioGroup value={value.value}>
              <Radio.Root value="a">
                <Radio.Indicator
                  class="animation-test-indicator"
                  data-testid="indicator-a"
                  onTransitionend={notifyTransitionFinished}
                />
              </Radio.Root>
              <Radio.Root value="b">
                <Radio.Indicator class="animation-test-indicator" data-testid="indicator-b" />
              </Radio.Root>
            </RadioGroup>
          </div>
        );
      });

      const { user } = await render(<Test />);
      expect(screen.queryByTestId('indicator-a')).toBe(null);

      await user.click(screen.getByText('Select a'));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('indicator-a')).not.toBe(null);
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
        const value = shallowRef('a');

        function handleSelectB() {
          value.value = 'b';
        }

        return () => (
          <div>
            <style>{style}</style>
            <button onClick={handleSelectB}>Select b</button>
            <RadioGroup value={value.value}>
              <Radio.Root value="a">
                <Radio.Indicator class="animation-test-indicator" data-testid="indicator-a" />
              </Radio.Root>
              <Radio.Root value="b">
                <Radio.Indicator class="animation-test-indicator" data-testid="indicator-b" />
              </Radio.Root>
            </RadioGroup>
          </div>
        );
      });

      await render(<Test />);
      const indicatorA = screen.getByTestId('indicator-a');
      expect(indicatorA).not.toBe(null);

      // The attribute lasts only while the animation runs, so an observer records it.
      let hadEndingStyle = false;
      const observer = new MutationObserver(() => {
        hadEndingStyle ||= indicatorA.hasAttribute('data-ending-style');
      });
      observer.observe(indicatorA, { attributes: true, attributeFilter: ['data-ending-style'] });
      onTestFinished(() => observer.disconnect());

      await fireEvent.click(screen.getByText('Select b'));

      await waitFor(() => {
        expect(screen.queryByTestId('indicator-a')).toBe(null);
      });
      expect(hadEndingStyle).toBe(true);
    });
  });

  describe('state', () => {
    it('has the data attributes of the radio', async () => {
      await render(
        <Field.Root invalid>
          <RadioGroup defaultValue="a">
            <Radio.Root value="a" disabled readOnly required>
              <Radio.Indicator data-testid="checked" />
            </Radio.Root>
            <Radio.Root value="b">
              <Radio.Indicator data-testid="unchecked" keepMounted />
            </Radio.Root>
          </RadioGroup>
        </Field.Root>,
      );

      expect(readDataAttributes(screen.getByTestId('checked'))).toEqual([
        'data-checked',
        'data-disabled',
        'data-filled',
        'data-invalid',
        'data-readonly',
        'data-required',
      ]);
      expect(readDataAttributes(screen.getByTestId('unchecked'))).toEqual([
        'data-filled',
        'data-invalid',
        'data-unchecked',
      ]);
    });
  });

  describe('server-side rendering', () => {
    it.each([
      { name: 'a checked radio', props: { defaultValue: 'b' } },
      { name: 'no checked radio', props: {} },
      { name: 'a kept indicator', props: { defaultValue: 'b', keepMounted: true } },
    ])('hydrates $name with no mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      await hydrate(RadioIndicatorHydration, { serverHtml, props });
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
  it('throws a descriptive error when rendered outside <Radio.Root>', async () => {
    await expect(render(<Radio.Indicator />)).rejects.toThrow(
      'Vase UI: A part of Radio must be inside <Radio.Root>. Without a root the part has no state to show. Put the part inside <Radio.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
