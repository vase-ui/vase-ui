import { expect, vi, describe, it } from 'vitest';
import { computed, defineComponent, provide, shallowRef } from 'vue';
import type { PropType } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { Switch } from '@vase-ui/vue/switch';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import { createRenderer, describeConformance, isJSDOM, screen, waitFor } from '#test-utils';
import { NOOP } from '../../internals/noop';
import * as Select from '../../select/index.parts';
import { ToolbarRootContext } from '../root/ToolbarRootContext';
import { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';

const testCompositeContext: CompositeRootContext = {
  highlightedIndex: computed(() => 0),
  onHighlightedIndexChange: NOOP,
  highlightItemOnHover: computed(() => false),
  relayKeyboardEvent: NOOP,
  takeInitialTabStop: () => false,
  id: 'test',
  hasUnmountedTabStop: computed(() => false),
};

const testToolbarContext: ToolbarRootContext = {
  disabled: computed(() => false),
  orientation: computed(() => 'horizontal' as const),
};

const TestContexts = defineComponent((_, { slots }) => {
  provide(ToolbarRootContext, testToolbarContext);
  provide(CompositeRootContext, testCompositeContext);
  return () => slots.default?.();
});

const NATIVE_BUTTON_MESSAGE =
  'Vase UI: A component that acts as a button expected a native <button> because ' +
  'the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics, ' +
  'which can impact forms and accessibility. Use a real <button> with the `as` prop or the `#render` slot, or ' +
  'set `nativeButton` to `false`.';

const NON_NATIVE_BUTTON_MESSAGE =
  'Vase UI: A component that acts as a button expected a non-<button> because ' +
  'the `nativeButton` prop is false. Rendering a <button> keeps native behavior while Vase UI ' +
  'applies non-native attributes and handlers, which can add unintended extra attributes ' +
  '(such as `role` or `aria-disabled`). Use a non-<button> with the `as` prop or the `#render` slot, or ' +
  'set `nativeButton` to `true`.';

describe('<Toolbar.Button />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Button />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render: (node) => render(<TestContexts>{node}</TestContexts>),
  }));

  describe('prop: nativeButton', () => {
    it('custom element: dispatches real clicks from Space keyboard activation', async () => {
      const handleClick = vi.fn();
      const handleRenderClick = vi.fn();
      const handleCaptureClick = vi.fn();
      const handleAncestorClick = vi.fn();

      const { user } = await render(
        <div onClick={handleAncestorClick}>
          <Toolbar.Root>
            <Toolbar.Button
              nativeButton={false}
              onClick={handleClick}
              v-slots={{
                render: ({ props }: { props: Record<string, unknown> }) => (
                  <span
                    {...props}
                    onClick={handleRenderClick}
                    {...{ onClickCapture: handleCaptureClick }}
                  >
                    Save
                  </span>
                ),
              }}
            />
          </Toolbar.Root>
        </div>,
      );

      const button = screen.getByRole('button', { name: 'Save' });

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard('[Space]');

      expect(handleCaptureClick).toHaveBeenCalledTimes(1);
      expect(handleRenderClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleAncestorClick).toHaveBeenCalledTimes(1);
    });

    it('custom element: dispatches real clicks from Enter keyboard activation', async () => {
      const handleClick = vi.fn();
      const handleRenderClick = vi.fn();
      const handleCaptureClick = vi.fn();
      const handleAncestorClick = vi.fn();

      const { user } = await render(
        <div onClick={handleAncestorClick}>
          <Toolbar.Root>
            <Toolbar.Button
              nativeButton={false}
              onClick={handleClick}
              v-slots={{
                render: ({ props }: { props: Record<string, unknown> }) => (
                  <span
                    {...props}
                    onClick={handleRenderClick}
                    {...{ onClickCapture: handleCaptureClick }}
                  >
                    Save
                  </span>
                ),
              }}
            />
          </Toolbar.Root>
        </div>,
      );

      const button = screen.getByRole('button', { name: 'Save' });

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(handleCaptureClick).toHaveBeenCalledTimes(1);
      expect(handleRenderClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleAncestorClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('prop: disabled', () => {
    it('disables the button', async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn().mockName('handleMouseDown');
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button
            disabled
            onClick={handleClick}
            onMousedown={handleMouseDown}
            onPointerdown={handlePointerDown}
            onKeydown={handleKeyDown}
          />
        </Toolbar.Root>,
      );

      const button = screen.getByRole('button');

      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');

      await user.click(button);
      await user.keyboard(`[Space]`);
      await user.keyboard(`[Enter]`);
      expect(handleClick).toHaveBeenCalledTimes(0);
      expect(handleMouseDown).toHaveBeenCalledTimes(0);
      expect(handlePointerDown).toHaveBeenCalledTimes(0);
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
    });

    it('uses the disabled attribute when focusableWhenDisabled is false', async () => {
      await render(
        <Toolbar.Root>
          <Toolbar.Button disabled focusableWhenDisabled={false} />
        </Toolbar.Root>,
      );

      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).not.toHaveAttribute('aria-disabled');
    });

    it.skipIf(isJSDOM)('allows hover handlers while blocking activation', async () => {
      const handleClick = vi.fn();
      const handleMouseMove = vi.fn();

      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button disabled onClick={handleClick} onMousemove={handleMouseMove} />
        </Toolbar.Root>,
      );

      const button = screen.getByRole('button');

      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');

      await user.hover(button);

      expect(handleMouseMove).toHaveBeenCalled();

      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(0);
    });
  });

  describe('rendering other Base UI components', () => {
    describe('Switch', () => {
      it('renders a switch', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await render(
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" as={Switch.Root} />
          </Toolbar.Root>,
        );

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(NATIVE_BUTTON_MESSAGE));
        expect(screen.getByTestId('button')).toBe(screen.getByRole('switch'));
      });

      it('handles interactions', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const handleCheckedChange = vi.fn();
        const handleClick = vi.fn();
        const { user } = await render(
          <Toolbar.Root>
            <Toolbar.Button
              onClick={handleClick}
              v-slots={{
                render: ({ props }: { props: Record<string, unknown> }) => (
                  <Switch.Root
                    {...props}
                    defaultChecked={false}
                    onCheckedChange={handleCheckedChange}
                  />
                ),
              }}
            />
          </Toolbar.Root>,
        );

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(NATIVE_BUTTON_MESSAGE));

        const switchElement = screen.getByRole('switch');
        expect(switchElement).toHaveAttribute('data-unchecked');

        await user.keyboard('[Tab]');
        expect(switchElement).toHaveAttribute('tabindex', '0');

        await user.click(switchElement);
        expect(handleCheckedChange).toHaveBeenCalledTimes(1);
        expect(handleClick).toHaveBeenCalledTimes(1);
        expect(switchElement).toHaveAttribute('data-checked');

        await user.keyboard('[Enter]');
        expect(handleCheckedChange).toHaveBeenCalledTimes(2);
        expect(handleClick).toHaveBeenCalledTimes(2);
        expect(switchElement).toHaveAttribute('data-unchecked');

        await user.keyboard('[Space]');
        expect(handleCheckedChange).toHaveBeenCalledTimes(3);
        expect(handleClick).toHaveBeenCalledTimes(3);
        expect(switchElement).toHaveAttribute('data-checked');
      });

      it('disabled state', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const handleCheckedChange = vi.fn();
        const handleClick = vi.fn();
        const { user } = await render(
          <Toolbar.Root>
            <Toolbar.Button
              disabled
              onClick={handleClick}
              v-slots={{
                render: ({ props }: { props: Record<string, unknown> }) => (
                  <Switch.Root {...props} onCheckedChange={handleCheckedChange} />
                ),
              }}
            />
          </Toolbar.Root>,
        );

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(NATIVE_BUTTON_MESSAGE));

        const switchElement = screen.getByRole('switch');

        expect(switchElement).not.toHaveAttribute('disabled');
        expect(switchElement).toHaveAttribute('data-disabled');
        expect(switchElement).toHaveAttribute('aria-disabled', 'true');

        await user.keyboard('[Tab]');
        expect(switchElement).toHaveAttribute('tabindex', '0');

        await user.keyboard('[Enter]');
        expect(handleCheckedChange).toHaveBeenCalledTimes(0);
        expect(handleClick).toHaveBeenCalledTimes(0);

        await user.keyboard('[Space]');
        expect(handleCheckedChange).toHaveBeenCalledTimes(0);
        expect(handleClick).toHaveBeenCalledTimes(0);

        await user.click(switchElement);
        expect(handleCheckedChange).toHaveBeenCalledTimes(0);
        expect(handleClick).toHaveBeenCalledTimes(0);
      });
    });

    describe('Select', () => {
      it('renders a select trigger', async () => {
        await render(
          <Toolbar.Root>
            <Select.Root defaultValue="a">
              <Toolbar.Button
                data-testid="button"
                v-slots={{
                  render: ({ props }: { props: Record<string, unknown> }) => (
                    <Select.Trigger {...props} />
                  ),
                }}
              />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Toolbar.Root>,
        );

        const trigger = screen.getByTestId('button');
        expect(trigger).toBe(screen.getByRole('combobox'));
        expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      });

      it('handles interactions', async () => {
        const handleValueChange = vi.fn();
        const { user } = await render(
          <Toolbar.Root>
            <Select.Root defaultValue="a" onValueChange={handleValueChange}>
              <Toolbar.Button
                data-testid="button"
                v-slots={{
                  render: ({ props }: { props: Record<string, unknown> }) => (
                    <Select.Trigger {...props} />
                  ),
                }}
              />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup data-testid="popup">
                    <Select.Item value="a" data-testid="item-a">
                      a
                    </Select.Item>
                    <Select.Item value="b" data-testid="item-b">
                      b
                    </Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Toolbar.Root>,
        );

        expect(screen.queryByRole('listbox')).toBe(null);

        const trigger = screen.getByTestId('button');
        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();

        await user.keyboard('[ArrowDown]');
        expect(screen.queryByRole('listbox')).toBe(screen.getByTestId('popup'));
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'a' })).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'b' })).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });

        expect(handleValueChange).toHaveBeenCalledTimes(1);
        expect(handleValueChange).toHaveBeenCalledWith('b', expect.anything());
      });

      it('disabled state', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const onValueChange = vi.fn();
        const onOpenChange = vi.fn();
        const { user } = await render(
          <Toolbar.Root>
            <Select.Root defaultValue="a" onValueChange={onValueChange} onOpenChange={onOpenChange}>
              <Toolbar.Button
                disabled
                v-slots={{
                  render: ({ props }: { props: Record<string, unknown> }) => (
                    <Select.Trigger {...props} nativeButton={false} />
                  ),
                }}
              />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a" />
                    <Select.Item value="b" />
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Toolbar.Root>,
        );

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(NON_NATIVE_BUTTON_MESSAGE));

        expect(screen.queryByRole('listbox')).toBe(null);

        const trigger = screen.getByRole('combobox');
        expect(trigger).not.toHaveAttribute('disabled');
        expect(trigger).toHaveAttribute('data-disabled');
        expect(trigger).toHaveAttribute('aria-disabled', 'true');

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();

        expect(onOpenChange).toHaveBeenCalledTimes(0);
        expect(onValueChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[ArrowUp]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');

        expect(onOpenChange).toHaveBeenCalledTimes(0);
        expect(onValueChange).toHaveBeenCalledTimes(0);
      });
    });

    describe('Toggle and ToggleGroup', () => {
      it('renders toggle and toggle group', async () => {
        await render(
          <Toolbar.Root>
            <Toolbar.Button as={Toggle} value="apple" />
            <ToggleGroup>
              <Toolbar.Button as={Toggle} value="one" />
              <Toolbar.Button as={Toggle} value="two" />
            </ToggleGroup>
          </Toolbar.Root>,
        );

        expect(screen.getAllByRole('button').length).toBe(3);
        screen.getAllByRole('button').forEach((button) => {
          expect(button).toHaveAttribute('aria-pressed');
        });
      });

      it('handles interactions', async () => {
        const onPressedChange = vi.fn();
        const renderToggle = ({ props }: { props: Record<string, unknown> }) => (
          <Toggle {...props} onPressedChange={onPressedChange} />
        );
        const { user } = await render(
          <Toolbar.Root>
            <Toolbar.Button value="apple" v-slots={{ render: renderToggle }} />
            <ToggleGroup>
              <Toolbar.Button value="one" v-slots={{ render: renderToggle }} />
              <Toolbar.Button value="two" v-slots={{ render: renderToggle }} />
            </ToggleGroup>
          </Toolbar.Root>,
        );

        const [button1, button2, button3] = screen.getAllByRole('button');

        [button1, button2, button3].forEach((button) => {
          expect(button).toHaveAttribute('aria-pressed', 'false');
        });
        expect(onPressedChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(button1).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(onPressedChange).toHaveBeenCalledTimes(1);
        expect(button1).toHaveAttribute('aria-pressed', 'true');

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(button2).toHaveFocus();
        });

        await user.keyboard('[Space]');
        expect(onPressedChange).toHaveBeenCalledTimes(2);
        expect(button2).toHaveAttribute('aria-pressed', 'true');

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(button3).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(onPressedChange).toHaveBeenCalledTimes(3);
        expect(button3).toHaveAttribute('aria-pressed', 'true');
      });

      it('disabled state', async () => {
        const onPressedChange = vi.fn();
        const renderToggle = ({ props }: { props: Record<string, unknown> }) => (
          <Toggle {...props} onPressedChange={onPressedChange} />
        );
        const { user } = await render(
          <Toolbar.Root>
            <Toolbar.Button disabled value="apple" v-slots={{ render: renderToggle }} />
            <ToggleGroup>
              <Toolbar.Button disabled value="one" v-slots={{ render: renderToggle }} />
              <Toolbar.Button disabled value="two" v-slots={{ render: renderToggle }} />
            </ToggleGroup>
          </Toolbar.Root>,
        );
        const [button1, button2, button3] = screen.getAllByRole('button');

        [button1, button2, button3].forEach((button) => {
          expect(button).toHaveAttribute('aria-pressed', 'false');
          expect(button).not.toHaveAttribute('disabled');
          expect(button).toHaveAttribute('data-disabled');
          expect(button).toHaveAttribute('aria-disabled', 'true');
        });
        expect(onPressedChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(button1).toHaveFocus();
        });
        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        expect(onPressedChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(button2).toHaveFocus();
        });
        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        expect(onPressedChange).toHaveBeenCalledTimes(0);

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(button3).toHaveFocus();
        });
        await user.keyboard('[Enter]');
        await user.keyboard('[Space]');
        expect(onPressedChange).toHaveBeenCalledTimes(0);
      });

      it('navigates and selects direct ToggleGroup > Toggle children', async () => {
        const onValueChange = vi.fn();
        const { user } = await render(
          <Toolbar.Root>
            <ToggleGroup defaultValue={['one']} onValueChange={onValueChange}>
              <Toggle value="one" data-testid="one" />
              <Toggle value="two" data-testid="two" />
              <Toggle value="three" data-testid="three" />
            </ToggleGroup>
          </Toolbar.Root>,
        );

        const one = screen.getByTestId('one');
        const two = screen.getByTestId('two');
        const three = screen.getByTestId('three');

        expect(one).toHaveAttribute('aria-pressed', 'true');

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        // toggles past the first must be reachable
        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(two).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(three).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(onValueChange).toHaveBeenCalledTimes(1);
        // exclusive selection replaces the previous value
        expect(onValueChange.mock.calls[0][0]).toEqual(['three']);
        expect(one).toHaveAttribute('aria-pressed', 'false');
        expect(three).toHaveAttribute('aria-pressed', 'true');
      });

      it.skipIf(isJSDOM)('skips disabled direct ToggleGroup > Toggle children', async () => {
        const { user } = await render(
          <Toolbar.Root>
            <ToggleGroup>
              <Toggle value="one" data-testid="one" />
              <Toggle value="two" data-testid="two" disabled />
              <Toggle value="three" data-testid="three" />
            </ToggleGroup>
          </Toolbar.Root>,
        );

        const one = screen.getByTestId('one');
        const two = screen.getByTestId('two');
        const three = screen.getByTestId('three');

        expect(two).toBeDisabled();

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(three).toHaveFocus();
        });
        expect(two).not.toHaveAttribute('tabindex', '0');
      });

      it('supports multiple selection for direct ToggleGroup > Toggle children', async () => {
        const onValueChange = vi.fn();
        const { user } = await render(
          <Toolbar.Root>
            <ToggleGroup multiple defaultValue={['one']} onValueChange={onValueChange}>
              <Toggle value="one" data-testid="one" />
              <Toggle value="two" data-testid="two" />
            </ToggleGroup>
          </Toolbar.Root>,
        );

        const one = screen.getByTestId('one');
        const two = screen.getByTestId('two');

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(two).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(onValueChange.mock.calls[0][0]).toEqual(['one', 'two']);
        expect(one).toHaveAttribute('aria-pressed', 'true');
        expect(two).toHaveAttribute('aria-pressed', 'true');
      });

      it('supports a controlled ToggleGroup value', async () => {
        const App = defineComponent(() => {
          const value = shallowRef<string[]>([]);
          return () => (
            <Toolbar.Root>
              <ToggleGroup
                value={value.value}
                onValueChange={(next) => {
                  value.value = next;
                }}
              >
                <Toggle value="one" data-testid="one" />
                <Toggle value="two" data-testid="two" />
              </ToggleGroup>
            </Toolbar.Root>
          );
        });

        const { user } = await render(<App />);
        const one = screen.getByTestId('one');

        expect(one).toHaveAttribute('aria-pressed', 'false');

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        await user.keyboard('[Enter]');
        expect(one).toHaveAttribute('aria-pressed', 'true');
      });

      it('disables direct ToggleGroup children when Toolbar.Group is disabled', async () => {
        const { user } = await render(
          <Toolbar.Root>
            <Toolbar.Button data-testid="before" />
            <Toolbar.Group disabled>
              <ToggleGroup>
                <Toggle value="one" data-testid="one" />
                <Toggle value="two" data-testid="two" />
              </ToggleGroup>
            </Toolbar.Group>
            <Toolbar.Button data-testid="after" />
          </Toolbar.Root>,
        );

        const before = screen.getByTestId('before');
        const one = screen.getByTestId('one');
        const two = screen.getByTestId('two');
        const after = screen.getByTestId('after');

        [one, two].forEach((toggle) => {
          expect(toggle).toBeDisabled();
          expect(toggle).toHaveAttribute('data-disabled');
        });

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(before).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(after).toHaveFocus();
        });
        expect(one).not.toHaveAttribute('tabindex', '0');
        expect(two).not.toHaveAttribute('tabindex', '0');
      });

      it.skipIf(isJSDOM)('skips a direct Toggle that becomes disabled at runtime', async () => {
        const App = defineComponent(
          (props: { twoDisabled?: boolean }) => () => (
            <Toolbar.Root>
              <ToggleGroup>
                <Toggle value="one" data-testid="one" />
                <Toggle value="two" data-testid="two" disabled={props.twoDisabled} />
                <Toggle value="three" data-testid="three" />
              </ToggleGroup>
            </Toolbar.Root>
          ),
          { props: ['twoDisabled'] },
        );

        const { user, setProps } = await render(<App />);

        const one = screen.getByTestId('one');
        const three = screen.getByTestId('three');

        await user.keyboard('[Tab]');
        await waitFor(() => {
          expect(one).toHaveFocus();
        });

        await setProps({ twoDisabled: true });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(three).toHaveFocus();
        });
      });
    });
  });

  describe('state attributes', () => {
    it('has the orientation of the toolbar and the focusable mark', async () => {
      await render(
        <Toolbar.Root orientation="vertical">
          <Toolbar.Button data-testid="focusable" />
          <Toolbar.Button data-testid="not-focusable" focusableWhenDisabled={false} />
        </Toolbar.Root>,
      );

      const focusable = screen.getByTestId('focusable');
      expect(focusable).toHaveAttribute('data-orientation', 'vertical');
      expect(focusable).toHaveAttribute('data-focusable');
      expect(screen.getByTestId('not-focusable')).not.toHaveAttribute('data-focusable');
    });
  });

  describe('another element or component', () => {
    const Target = defineComponent({
      props: { disabled: { type: Boolean as PropType<boolean | undefined>, default: undefined } },
      setup(props) {
        return () => (
          <button type="button" data-testid="target" data-disabled-prop={String(props.disabled)} />
        );
      },
    });

    it.each([
      {
        name: 'true to a component while the button is disabled',
        disabled: true,
        expected: 'true',
      },
      {
        name: 'nothing to a component while the button is enabled',
        disabled: false,
        expected: 'undefined',
      },
    ])('gives disabled as $name', async ({ disabled, expected }) => {
      await render(
        <Toolbar.Root>
          <Toolbar.Button as={Target} disabled={disabled} />
        </Toolbar.Root>,
      );

      expect(screen.getByTestId('target')).toHaveAttribute('data-disabled-prop', expected);
    });

    it.each([
      { name: 'the as prop', slot: false },
      { name: 'the render slot', slot: true },
    ])(
      'writes the disabled attribute on an element of $name only while disabled',
      async ({ slot }) => {
        const App = defineComponent(
          (props: { disabled: boolean }) => () =>
            slot ? (
              <Toolbar.Root>
                <Toolbar.Button
                  nativeButton={false}
                  disabled={props.disabled}
                  v-slots={{
                    render: ({ props: elementProps }: { props: Record<string, unknown> }) => (
                      <span {...elementProps} data-testid="item" />
                    ),
                  }}
                />
              </Toolbar.Root>
            ) : (
              <Toolbar.Root>
                <Toolbar.Button
                  as="span"
                  nativeButton={false}
                  disabled={props.disabled}
                  data-testid="item"
                />
              </Toolbar.Root>
            ),
          { props: ['disabled'] },
        );
        const { setProps } = await render(<App disabled={false} />);
        const item = screen.getByTestId('item');
        expect(item).not.toHaveAttribute('disabled');
        expect(item).toHaveAttribute('tabindex', '0');

        await setProps({ disabled: true });

        expect(item).toHaveAttribute('disabled', '');
        expect(item).toHaveAttribute('aria-disabled', 'true');
      },
    );
  });
});
