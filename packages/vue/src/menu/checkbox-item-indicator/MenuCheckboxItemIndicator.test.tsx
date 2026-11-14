import { beforeEach, describe, expect, it } from 'vitest';
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

describe('<Menu.CheckboxItemIndicator />', () => {
  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(<Menu.CheckboxItemIndicator keepMounted />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>{node}</Menu.CheckboxItem>
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
            <Menu.Root open modal={false}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.CheckboxItem checked={checked.value}>
                      <Menu.CheckboxItemIndicator data-testid="indicator" />
                    </Menu.CheckboxItem>
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
          <Menu.Root open modal={false}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem checked={checked.value}>
                    <Menu.CheckboxItemIndicator
                      class="animation-test-indicator"
                      data-testid="indicator"
                      keepMounted
                      onAnimationend={notifyAnimationFinished}
                    />
                  </Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      );
    });

    const { user } = await render(<Test />);

    expect(screen.getByTestId('indicator')).not.toHaveAttribute('hidden');

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
            <Menu.Root open modal={false}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.CheckboxItem checked={checked.value}>
                      <Menu.CheckboxItemIndicator
                        class="animation-test-indicator"
                        data-testid="indicator"
                      />
                    </Menu.CheckboxItem>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      });

      await render(<Test />);

      expect(screen.getByTestId('indicator')).not.toBe(null);

      await fireEvent.click(screen.getByText('Close'));

      expect(screen.getByTestId('indicator')).toHaveAttribute('data-ending-style');

      await waitFor(() => {
        expect(screen.queryByTestId('indicator')).toBe(null);
      });
    },
  );

  it('gives the state of its item to its attributes', async () => {
    await render(
      <Menu.Root open>
        <Menu.CheckboxItem defaultChecked disabled>
          <Menu.CheckboxItemIndicator data-testid="checked" />
        </Menu.CheckboxItem>
        <Menu.CheckboxItem>
          <Menu.CheckboxItemIndicator keepMounted data-testid="unchecked" />
        </Menu.CheckboxItem>
      </Menu.Root>,
    );

    const checked = screen.getByTestId('checked');
    expect(checked).toHaveAttribute('aria-hidden', 'true');
    expect(checked).toHaveAttribute('data-checked', '');
    expect(checked).toHaveAttribute('data-disabled', '');
    const unchecked = screen.getByTestId('unchecked');
    expect(unchecked).toHaveAttribute('data-unchecked', '');
    expect(unchecked).not.toHaveAttribute('data-disabled');
  });

  it('renders only while its item is checked, unless it is kept mounted', async () => {
    const { user } = await render(
      <Menu.Root open>
        <Menu.CheckboxItem>
          <Menu.CheckboxItemIndicator data-testid="indicator" />
        </Menu.CheckboxItem>
      </Menu.Root>,
    );

    expect(screen.queryByTestId('indicator')).toBe(null);

    await user.click(screen.getByRole('menuitemcheckbox'));

    expect(screen.getByTestId('indicator')).not.toBe(null);
  });

  it('throws when rendered outside Menu.CheckboxItem', async () => {
    await expect(render(<Menu.CheckboxItemIndicator />)).rejects.toThrow(
      'Vase UI: <Menu.CheckboxItemIndicator> must be inside <Menu.CheckboxItem>. Without an item the indicator has no checked state to show. Put the indicator inside <Menu.CheckboxItem>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
