import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  isJSDOM,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';

describe('<Menu.RadioItemIndicator />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.RadioItemIndicator keepMounted />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup>
                  <Menu.RadioItem value="">{node}</Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
    },
  }));

  it.skipIf(isJSDOM)(
    'should remove the indicator when there is no exit animation defined',
    async () => {
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
            <Menu.Root open modal={false}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.RadioGroup value={value.value}>
                      <Menu.RadioItem value="a">
                        <Menu.RadioItemIndicator data-testid="indicator" />
                      </Menu.RadioItem>
                      <Menu.RadioItem value="b">
                        <Menu.RadioItemIndicator keepMounted />
                      </Menu.RadioItem>
                    </Menu.RadioGroup>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      });

      await render(<Test />);

      expect(screen.queryByTestId('indicator')).not.toBe(null);

      await fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('indicator')).toBe(null);
      });
    },
  );

  it.skipIf(isJSDOM)('should remove the indicator when the animation finishes', async () => {
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
          <Menu.Root open modal={false}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.RadioGroup value={value.value}>
                    <Menu.RadioItem value="a">
                      <Menu.RadioItemIndicator
                        class="animation-test-indicator"
                        data-testid="indicator"
                        keepMounted
                        onAnimationend={notifyAnimationFinished}
                      />
                    </Menu.RadioItem>
                    <Menu.RadioItem value="b">
                      <Menu.RadioItemIndicator keepMounted />
                    </Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
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

  it.skipIf(isJSDOM)(
    'keeps the indicator mounted to play its exit animation when unchecked without keepMounted',
    async () => {
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

        return () => (
          <div>
            <style>{style}</style>
            <button
              onClick={() => {
                value.value = 'b';
              }}
            >
              Select b
            </button>
            <Menu.Root open modal={false}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.RadioGroup value={value.value}>
                      <Menu.RadioItem value="a">
                        <Menu.RadioItemIndicator
                          class="animation-test-indicator"
                          data-testid="indicator"
                        />
                      </Menu.RadioItem>
                      <Menu.RadioItem value="b">
                        <Menu.RadioItemIndicator />
                      </Menu.RadioItem>
                    </Menu.RadioGroup>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      });

      await render(<Test />);

      expect(screen.getByTestId('indicator')).not.toBe(null);

      await fireEvent.click(screen.getByText('Select b'));

      expect(screen.getByTestId('indicator')).toHaveAttribute('data-ending-style');

      await waitFor(() => {
        expect(screen.queryByTestId('indicator')).toBe(null);
      });
    },
  );

  it('gives the state of its item to its attributes', async () => {
    await render(
      <Menu.Root open>
        <Menu.RadioGroup defaultValue="a" disabled>
          <Menu.RadioItem value="a">
            <Menu.RadioItemIndicator data-testid="checked" />
          </Menu.RadioItem>
          <Menu.RadioItem value="b">
            <Menu.RadioItemIndicator keepMounted data-testid="unchecked" />
          </Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.Root>,
    );

    const checked = screen.getByTestId('checked');
    expect(checked).toHaveAttribute('aria-hidden', 'true');
    expect(checked).toHaveAttribute('data-checked', '');
    expect(checked).toHaveAttribute('data-disabled', '');
    expect(screen.getByTestId('unchecked')).toHaveAttribute('data-unchecked', '');
  });

  it('renders only while its item is selected, unless it is kept mounted', async () => {
    const { user } = await render(
      <Menu.Root open>
        <Menu.RadioGroup>
          <Menu.RadioItem value="a">
            <Menu.RadioItemIndicator data-testid="indicator" />
          </Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.Root>,
    );

    expect(screen.queryByTestId('indicator')).toBe(null);

    await user.click(screen.getByRole('menuitemradio'));

    expect(screen.getByTestId('indicator')).not.toBe(null);
  });

  it('throws when rendered outside Menu.RadioItem', async () => {
    await expect(render(<Menu.RadioItemIndicator />)).rejects.toThrow(
      'Vase UI: <Menu.RadioItemIndicator> must be inside <Menu.RadioItem>. Without an item the indicator has no selected state to show. Put the indicator inside <Menu.RadioItem>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
