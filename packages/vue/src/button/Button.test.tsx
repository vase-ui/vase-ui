import { expect, vi, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Button, ButtonDataAttributes } from '@vase-ui/vue/button';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';

describe('<Button />', () => {
  const { render } = createRenderer();

  describeConformance(<Button />, () => ({
    render,
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
  }));

  describe('prop: nativeButton', () => {
    it('custom link element: Space activates the link without scrolling the page', async () => {
      const handleClick = vi.fn();

      const { user } = await render(
        <Button
          nativeButton={false}
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => (
              <a {...props} href="#target">
                Go
              </a>
            ),
          }}
          onClick={handleClick}
        />,
      );

      const link = screen.getByRole('button', { name: 'Go' });
      expect(link.tagName).toBe('A');

      await user.keyboard('[Tab]');
      expect(link).toHaveFocus();

      // `fireEvent` returns `false` when a listener calls `preventDefault()`. The page then does
      // not scroll.
      expect(await fireEvent.keyDown(link, { key: ' ' })).toBe(false);
      await fireEvent.keyUp(link, { key: ' ' });

      expect(handleClick).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(window.location.hash).toBe('#target');
      });
    });

    it('custom element: applies button semantics and dispatches real clicks from keyboard activation', async () => {
      const handleClick = vi.fn();
      const handleRenderClick = vi.fn();
      const handleCaptureClick = vi.fn();
      const handleAncestorClick = vi.fn();

      const { user } = await render(
        <div onClick={handleAncestorClick}>
          <Button
            nativeButton={false}
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => (
                // Vue JSX types have no `onClickCapture` attribute. A spread gives the listener.
                <span
                  {...props}
                  {...{ onClickCapture: handleCaptureClick }}
                  onClick={handleRenderClick}
                >
                  Save
                </span>
              ),
            }}
            onClick={handleClick}
          />
        </div>,
      );

      const button = screen.getByRole('button', { name: 'Save' });

      expect(button.tagName).toBe('SPAN');
      expect(button).toHaveAttribute('role', 'button');
      expect(button).toHaveAttribute('tabindex', '0');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard('[Enter]');
      await user.keyboard('[Space]');

      expect(handleCaptureClick).toHaveBeenCalledTimes(2);
      expect(handleRenderClick).toHaveBeenCalledTimes(2);
      expect(handleClick).toHaveBeenCalledTimes(2);
      expect(handleAncestorClick).toHaveBeenCalledTimes(2);
    });

    it('custom element: keyboard activation clicks carry modifier key state', async () => {
      const handleClick = vi.fn();

      const { user } = await render(
        <Button nativeButton={false} as="span" onClick={handleClick}>
          Save
        </Button>,
      );

      const button = screen.getByRole('button', { name: 'Save' });

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard('{Shift>}[Enter]{/Shift}');

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick.mock.calls[0][0].shiftKey).toBe(true);
    });

    it('errors when the element of a wrapper component is not a button', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // The wrapper gives its inner element after its render.
      const Wrapper = defineComponent({
        inheritAttrs: false,
        setup(_, { attrs, expose }) {
          const inner = shallowRef<Element | null>(null);
          expose({ element: inner });
          return () => (
            <div>
              <span {...attrs} ref={inner} />
            </div>
          );
        },
      });

      await render(<Button as={Wrapper} />);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Vase UI: A component that acts as a button expected a native <button> because the `nativeButton` prop is true.',
        ),
      );
    });
  });

  describe('prop: disabled', () => {
    it('native button: uses the disabled attribute and is not focusable', async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const { user } = await render(
        <Button
          disabled
          onClick={handleClick}
          onMousedown={handleMouseDown}
          onPointerdown={handlePointerDown}
          onKeydown={handleKeyDown}
        />,
      );

      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute(ButtonDataAttributes.disabled);
      expect(button).not.toHaveAttribute('aria-disabled');

      await user.keyboard('[Tab]');
      expect(button).not.toHaveFocus();

      await user.click(button);
      await user.keyboard('[Space]');
      await user.keyboard('[Enter]');

      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleMouseDown.mock.calls.length).toBe(0);
      expect(handlePointerDown.mock.calls.length).toBe(0);
      expect(handleKeyDown.mock.calls.length).toBe(0);
    });

    it('custom element: applies aria-disabled and is not focusable', async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const { user } = await render(
        <Button
          disabled
          nativeButton={false}
          as="span"
          onClick={handleClick}
          onMousedown={handleMouseDown}
          onPointerdown={handlePointerDown}
          onKeydown={handleKeyDown}
        />,
      );

      const button = screen.getByRole('button');

      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute(ButtonDataAttributes.disabled);
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('tabindex', '-1');

      await user.keyboard('[Tab]');
      expect(button).not.toHaveFocus();

      await user.click(button);
      await user.keyboard('[Space]');
      await user.keyboard('[Enter]');

      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleMouseDown.mock.calls.length).toBe(0);
      expect(handlePointerDown.mock.calls.length).toBe(0);
      expect(handleKeyDown.mock.calls.length).toBe(0);
    });

    it('follows a change of the disabled prop', async () => {
      const { container, setProps } = await render(<Button />);

      const element = container.firstElementChild as HTMLElement;
      expect(element).not.toHaveAttribute('disabled');
      expect(element).not.toHaveAttribute('data-disabled');

      await setProps({ disabled: true });

      expect(element).toHaveAttribute('disabled');
      expect(element).toHaveAttribute('data-disabled');
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    it('native button: prevents interactions but remains focusable', async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const { user } = await render(
        <Button
          disabled
          focusableWhenDisabled
          onClick={handleClick}
          onMousedown={handleMouseDown}
          onPointerdown={handlePointerDown}
          onKeydown={handleKeyDown}
        />,
      );

      const button = screen.getByRole('button');

      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute(ButtonDataAttributes.disabled);
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('tabindex', '0');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(button);
      await user.keyboard('[Space]');
      await user.keyboard('[Enter]');

      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleMouseDown.mock.calls.length).toBe(0);
      expect(handlePointerDown.mock.calls.length).toBe(0);
      expect(handleKeyDown.mock.calls.length).toBe(0);
    });

    it.skipIf(isJSDOM)(
      'native button: allows hover handlers while blocking activation',
      async () => {
        const handleClick = vi.fn();
        const handleMouseMove = vi.fn();

        const { user } = await render(
          <Button
            disabled
            focusableWhenDisabled
            onClick={handleClick}
            onMousemove={handleMouseMove}
          />,
        );

        const button = screen.getByRole('button');

        expect(button).not.toHaveAttribute('disabled');
        expect(button).toHaveAttribute(ButtonDataAttributes.disabled);
        expect(button).toHaveAttribute('aria-disabled', 'true');

        await user.hover(button);

        expect(handleMouseMove).toHaveBeenCalled();

        await user.click(button);

        expect(handleClick).toHaveBeenCalledTimes(0);
      },
    );

    it('keeps focus and suppresses interactions after becoming disabled', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(() => {
        const disabled = shallowRef(false);

        return () => (
          <Button
            disabled={disabled.value}
            focusableWhenDisabled
            onClick={(event) => {
              handleClick(event);
              disabled.value = true;
            }}
          >
            Save
          </Button>
        );
      });

      const { user } = await render(<TestButton />);

      const button = screen.getByRole('button', { name: 'Save' });

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-disabled', 'true');

      await user.click(button);
      await user.keyboard('[Enter]');
      await user.keyboard('[Space]');

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(button).toHaveFocus();
    });

    it('custom element: prevents interactions but remains focusable', async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn();
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      const { user } = await render(
        <Button
          disabled
          focusableWhenDisabled
          nativeButton={false}
          as="span"
          onClick={handleClick}
          onMousedown={handleMouseDown}
          onPointerdown={handlePointerDown}
          onKeydown={handleKeyDown}
        />,
      );

      const button = screen.getByRole('button');

      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute(ButtonDataAttributes.disabled);
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('tabindex', '0');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.click(button);
      await user.keyboard('[Space]');
      await user.keyboard('[Enter]');

      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleMouseDown.mock.calls.length).toBe(0);
      expect(handlePointerDown.mock.calls.length).toBe(0);
      expect(handleKeyDown.mock.calls.length).toBe(0);
    });
  });

  const states = [
    { name: 'a native button', props: {} },
    { name: 'a disabled native button', props: { disabled: true } },
    {
      name: 'a disabled native button that stays focusable',
      props: { disabled: true, focusableWhenDisabled: true },
    },
    {
      name: 'a disabled element that is not a button',
      props: { as: 'span', nativeButton: false, disabled: true },
    },
  ];

  describe('accessibility', () => {
    it.each(states)('has no axe violation as $name', async ({ props }) => {
      await render(<Button {...props}>Submit</Button>);

      await expectNoAxeViolations(screen.getByRole('button'));
    });
  });

  describe('hydration', () => {
    it.each(states)('hydrates $name without a mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer('src/button/Button.vue', props);

      await hydrate(Button, { serverHtml, props });
    });
  });
});
