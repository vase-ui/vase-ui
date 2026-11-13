import { expect, vi, describe, it } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import type { PropType } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { createRenderer, describeConformance, isJSDOM, screen } from '#test-utils';
import { NOOP } from '../../internals/noop';
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
