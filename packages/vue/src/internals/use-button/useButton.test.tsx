import { expect, vi, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, isJSDOM, screen } from '#test-utils';
import CompositeRoot from '../../../test/fixtures/CompositeRootPart.vue';
import type { HTMLProps, VaseUIEvent, WithVaseUIEvent } from '../types';
import { useRenderElement } from '../useRenderElement';
import { useButton } from './useButton';
import type { UseButtonParameters } from './useButton';

function useTestButton(
  parameters: UseButtonParameters = {},
  props?: () => Record<string, unknown>,
) {
  return useRenderElement(
    'span',
    {},
    {
      button: (element) => useButton(element, parameters),
      props: (attrs) => [props?.(), attrs],
    },
  );
}

type ElementTestProps = WithVaseUIEvent<HTMLAttributes>;

type ButtonTestProps = Omit<WithVaseUIEvent<ButtonHTMLAttributes>, 'disabled'> & {
  disabled?: boolean | undefined;
};

describe('useButton', () => {
  const { render } = createRenderer();
  const focusElement = async (element: HTMLElement) => {
    element.focus();
    await flushMicrotasks();
  };

  it('blocks input when disabled before the next render', async () => {
    const disabled = shallowRef(false);
    const focusableWhenDisabled = shallowRef(false);
    const handler = vi.fn();
    const Button = defineComponent(() => {
      const { elementProps } = useTestButton(
        { disabled, focusableWhenDisabled, native: false },
        () => ({
          onClick: handler,
          onMousedown: handler,
          onPointerdown: handler,
          onKeydown: handler,
          onKeyup: handler,
        }),
      );
      return () => <span {...elementProps()} />;
    });
    await render(<Button />);
    const button = screen.getByRole('button');
    const keydown = (key: string) =>
      button.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));

    disabled.value = true;
    button.click();
    button.dispatchEvent(new MouseEvent('mousedown'));
    expect(button.dispatchEvent(new PointerEvent('pointerdown', { cancelable: true }))).toBe(false);
    expect(keydown('a')).toBe(true);
    focusableWhenDisabled.value = true;
    expect(keydown('a')).toBe(false);
    expect(keydown('Tab')).toBe(true);
    button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    expect(handler).not.toHaveBeenCalled();

    disabled.value = false;
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('uses the current composite mode for Space before the next render', async () => {
    const composite = shallowRef(false);
    const onClick = vi.fn();
    const Button = defineComponent(() => {
      const { elementProps } = useTestButton({ composite, native: false }, () => ({ onClick }));
      return () => <span {...elementProps()} />;
    });
    await render(<Button />);
    const button = screen.getByRole('button');

    composite.value = true;
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
    button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  describe('non-native button', () => {
    describe('keyboard interactions', () => {
      it.each([{ key: 'Enter' }, { key: 'Space' }])(
        'can be activated with $key key',
        async ({ key }) => {
          const clickSpy = vi.fn();

          const Button = defineComponent(
            (_props: ElementTestProps) => {
              const { elementProps } = useTestButton({
                native: false,
              });

              return () => <span {...elementProps()} />;
            },
            { inheritAttrs: false },
          );

          const { user } = await render(<Button onClick={clickSpy} />);

          const button = screen.getByRole('button');

          await user.keyboard('[Tab]');
          expect(button).toHaveFocus();

          await user.keyboard(`[${key}]`);
          expect(clickSpy).toHaveBeenCalledTimes(1);
        },
      );

      it('does not set a type prop', async () => {
        let buttonProps: HTMLProps | undefined;

        const Button = defineComponent(() => {
          const { elementProps } = useTestButton({ native: false });

          return () => {
            buttonProps = elementProps();
            return <span {...buttonProps} />;
          };
        });

        await render(<Button />);
        expect(buttonProps).not.toHaveProperty('type');
      });

      it.skipIf(isJSDOM)(
        'can be activated with Enter when the keyboard event originates inside a shadow root',
        async () => {
          const clickSpy = vi.fn();

          const Button = defineComponent(
            (_props: ElementTestProps) => {
              const { elementProps, setRef } = useTestButton({
                native: false,
              });

              function handleRef(node: HTMLSpanElement | null) {
                setRef(node);

                if (!node || node.shadowRoot) {
                  return;
                }

                const shadowRoot = node.attachShadow({ mode: 'open' });
                const inner = document.createElement('span');
                inner.tabIndex = 0;
                shadowRoot.appendChild(inner);
              }

              return () => (
                <span
                  {...elementProps()}
                  ref={(element) => handleRef(element as HTMLSpanElement | null)}
                />
              );
            },
            { inheritAttrs: false },
          );

          await render(<Button onClick={clickSpy} />);

          const host = screen.getByRole('button');
          const inner = host.shadowRoot?.querySelector('span');

          expect(inner).toBeTruthy();

          if (!inner) {
            return;
          }

          await focusElement(inner);

          inner.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true,
              composed: true,
            }),
          );
          await flushMicrotasks();

          expect(clickSpy).toHaveBeenCalledTimes(1);
        },
      );
    });
  });

  describe('param: focusableWhenDisabled', () => {
    it('allows disabled buttons to be focused', async () => {
      const TestButton = defineComponent(
        (props: ButtonTestProps) => {
          const { elementProps } = useTestButton({
            disabled: () => props.disabled,
            focusableWhenDisabled: true,
          });

          return () => <button {...elementProps()} />;
        },
        { props: ['disabled'], inheritAttrs: false },
      );
      await render(<TestButton disabled />);
      const button = screen.getByRole('button');
      await focusElement(button);
      expect(button).toHaveFocus();
    });

    it('force overrides disabled attribute when put in a composite', async () => {
      const TestButton = defineComponent(
        (props: { buttonKey?: string | undefined }) => {
          const { elementProps, setRef } = useTestButton(
            {
              disabled: true,
              focusableWhenDisabled: true,
            },
            () => ({ disabled: true }),
          );

          return () => <button key={props.buttonKey} {...elementProps()} ref={setRef} />;
        },
        { props: ['buttonKey'] },
      );

      const { rerender } = await render(
        <CompositeRoot>
          <TestButton />
        </CompositeRoot>,
      );

      async function verify() {
        const button = screen.getByRole('button');
        await focusElement(button);
        expect(button).toHaveFocus();
      }

      await verify();

      // Ensure it works after ref change
      await rerender(
        <CompositeRoot>
          <TestButton buttonKey="rerender" />
        </CompositeRoot>,
      );
      await verify();
    });

    it('prevents interactions except focus and blur', async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();

      const TestButton = defineComponent(
        (props: ElementTestProps & { disabled?: boolean | undefined }) => {
          const { elementProps } = useTestButton({
            disabled: () => props.disabled,
            focusableWhenDisabled: true,
            native: false,
          });

          return () => <span {...elementProps()} />;
        },
        { props: ['disabled'], inheritAttrs: false },
      );

      const { user } = await render(
        <TestButton
          disabled
          onClick={handleClick}
          onKeydown={handleKeyDown}
          onKeyup={handleKeyUp}
          onFocusin={handleFocus}
          onFocusout={handleBlur}
        />,
      );

      const button = screen.getByRole('button');
      expect(document.activeElement).not.toBe(button);

      expect(handleFocus).toHaveBeenCalledTimes(0);
      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();
      expect(handleFocus).toHaveBeenCalledTimes(1);

      await user.keyboard('[Enter]');
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
      expect(handleClick).toHaveBeenCalledTimes(0);

      await user.keyboard('[Space]');
      expect(handleKeyUp).toHaveBeenCalledTimes(0);
      expect(handleClick).toHaveBeenCalledTimes(0);

      await user.click(button);
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
      expect(handleKeyUp).toHaveBeenCalledTimes(0);
      expect(handleClick).toHaveBeenCalledTimes(0);

      expect(handleBlur).toHaveBeenCalledTimes(0);
      await user.keyboard('[Tab]');
      expect(handleBlur).toHaveBeenCalledTimes(1);
      expect(document.activeElement).not.toBe(button);
    });

    it('removes the disabled property of a disabled composite button', async () => {
      const TestButton = defineComponent(() => {
        const { elementProps, setRef } = useTestButton(
          {
            disabled: true,
            focusableWhenDisabled: true,
            composite: true,
          },
          () => ({ disabled: true }),
        );

        return () => <button {...elementProps()} ref={setRef} />;
      });

      await render(<TestButton />);

      const button = screen.getByRole('button');
      expect(button).toHaveProperty('disabled', false);
      await focusElement(button);
      expect(button).toHaveFocus();
    });

    it('removes the disabled property when a composite button becomes disabled', async () => {
      const TestButton = defineComponent(
        (props: { disabled?: boolean | undefined }) => {
          const { elementProps, setRef } = useTestButton(
            {
              disabled: () => props.disabled,
              focusableWhenDisabled: true,
              composite: true,
            },
            () => ({ disabled: props.disabled }),
          );

          return () => <button {...elementProps()} ref={setRef} />;
        },
        { props: ['disabled'] },
      );

      const { setProps } = await render(<TestButton disabled={false} />);

      const button = screen.getByRole('button');
      expect(button).toHaveProperty('disabled', false);

      await setProps({ disabled: true });

      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveProperty('disabled', false);
    });
  });

  describe('param: tabIndex', () => {
    it('returns tabIndex in getButtonProps when host component is BUTTON', async () => {
      const TestButton = defineComponent(() => {
        const { elementProps } = useTestButton();

        return () => {
          expect(elementProps().tabindex).toBe(0);

          return <button {...elementProps()} />;
        };
      });

      await render(<TestButton />);
      expect(screen.getByRole('button')).toHaveProperty('tabIndex', 0);
    });

    it('returns tabIndex in getButtonProps when host component is not BUTTON', async () => {
      const TestButton = defineComponent(() => {
        const { elementProps } = useTestButton({ native: false });

        return () => {
          expect(elementProps().tabindex).toBe(0);

          return <span {...elementProps()} />;
        };
      });

      await render(<TestButton />);
      expect(screen.getByRole('button')).toHaveProperty('tabIndex', 0);
    });

    it('returns tabIndex in getButtonProps if it is explicitly provided', async () => {
      const customTabIndex = 3;
      const TestButton = defineComponent(() => {
        const { elementProps } = useTestButton({ tabIndex: customTabIndex });

        return () => <button {...elementProps()} />;
      });

      await render(<TestButton />);
      expect(screen.getByRole('button')).toHaveProperty('tabIndex', customTabIndex);
    });
  });

  describe('arbitrary props', () => {
    it('are passed to the host component', async () => {
      const buttonTestId = 'button-test-id';
      const TestButton = defineComponent(() => {
        const { elementProps } = useTestButton({}, () => ({ 'data-testid': buttonTestId }));

        return () => <button {...elementProps()} />;
      });

      await render(<TestButton />);
      expect(screen.getByRole('button')).toHaveAttribute('data-testid', buttonTestId);
    });
  });

  describe('event handlers', () => {
    it('key: Space fires keyup then click on non-composite buttons', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <TestButton onKeydown={handleKeyDown} onKeyup={handleKeyUp} onClick={handleClick} />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(0);

      await fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Space fires keydown then click on composite buttons', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false, composite: true });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <TestButton
          tabindex={0}
          onKeydown={handleKeyDown}
          onKeyup={handleKeyUp}
          onClick={handleClick}
        />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      await fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Space fires keydown then click on composite links', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: WithVaseUIEvent<AnchorHTMLAttributes>) => {
          const { elementProps } = useTestButton({ native: false, composite: true });

          return () => <a href="#test" {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(<TestButton onClick={handleClick} />);

      const link = screen.getByRole('button');

      await focusElement(link);
      expect(link).toHaveFocus();

      await fireEvent.keyDown(link, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);

      await fireEvent.keyUp(link, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not click composite links when Space is prevented for text navigation', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: WithVaseUIEvent<AnchorHTMLAttributes>) => {
          const { elementProps } = useTestButton({ native: false, composite: true }, () => ({
            role: 'menuitem',
          }));

          return () => <a href="#test" {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <TestButton onKeydown={(event) => event.preventDefault()} onClick={handleClick} />,
      );

      const link = screen.getByRole('menuitem');

      await focusElement(link);
      expect(link).toHaveFocus();

      await fireEvent.keyDown(link, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it('does not click composite gridcells when Space is prevented', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false, composite: true }, () => ({
            role: 'gridcell',
            tabindex: 0,
          }));

          return () => <div {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <TestButton onKeydown={(event) => event.preventDefault()} onClick={handleClick} />,
      );

      const gridcell = screen.getByRole('gridcell');

      await focusElement(gridcell);
      expect(gridcell).toHaveFocus();

      await fireEvent.keyDown(gridcell, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it('clicks composite switches when Space is prevented', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false, composite: true }, () => ({
            role: 'switch',
            tabindex: 0,
          }));

          return () => <div {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <TestButton onKeydown={(event) => event.preventDefault()} onClick={handleClick} />,
      );

      const switchElement = screen.getByRole('switch');

      await focusElement(switchElement);
      expect(switchElement).toHaveFocus();

      await fireEvent.keyDown(switchElement, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Space fires keydown then click on native composite buttons', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ButtonTestProps) => {
          const { elementProps } = useTestButton({ composite: true });

          return () => <button {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <TestButton onKeydown={handleKeyDown} onKeyup={handleKeyUp} onClick={handleClick} />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      await fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not fire duplicate clicks for Space on native composite buttons', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ButtonTestProps) => {
          const { elementProps } = useTestButton({ composite: true });

          return () => <button {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      const { user } = await render(<TestButton onClick={handleClick} />);

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await user.keyboard('[Space]');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('fires a single click for nested non-native composite buttons', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const outer = useTestButton({ native: false, composite: true });
          const inner = useRenderElement(
            'span',
            {},
            {
              button: (element) => useButton(element, { native: false, composite: true }),
              props: () => outer.elementProps(),
            },
          );

          return () => <span {...inner.elementProps()} />;
        },
        { inheritAttrs: false },
      );

      const { user } = await render(<TestButton tabindex={0} onClick={handleClick} />);

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await user.keyboard('[Space]');
      expect(handleClick).toHaveBeenCalledTimes(1);

      await user.keyboard('[Enter]');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('key: Space preserves native submit semantics on composite buttons', async () => {
      const handleSubmit = vi.fn((event: Event) => {
        event.preventDefault();
      });

      const TestButton = defineComponent(() => {
        const { elementProps } = useTestButton({ composite: true }, () => ({ type: 'submit' }));

        return () => (
          <form onSubmit={handleSubmit}>
            <button {...elementProps()}>Submit</button>
          </form>
        );
      });

      await render(<TestButton />);

      const button = screen.getByRole('button', { name: 'Submit' });

      await focusElement(button);
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: ' ' });
      expect(handleSubmit).toHaveBeenCalledTimes(1);

      await fireEvent.keyUp(button, { key: ' ' });
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('key: Space preserves native reset semantics on composite buttons', async () => {
      const handleReset = vi.fn((event: Event) => {
        event.preventDefault();
      });

      const TestButton = defineComponent(() => {
        const { elementProps } = useTestButton({ composite: true }, () => ({ type: 'reset' }));

        return () => (
          <form onReset={handleReset}>
            <button {...elementProps()}>Reset</button>
          </form>
        );
      });

      await render(<TestButton />);

      const button = screen.getByRole('button', { name: 'Reset' });

      await focusElement(button);
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: ' ' });
      expect(handleReset).toHaveBeenCalledTimes(1);

      await fireEvent.keyUp(button, { key: ' ' });
      expect(handleReset).toHaveBeenCalledTimes(1);
    });

    it('does not click composite buttons when keydown calls preventVaseUIHandler', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false, composite: true });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <TestButton
          tabindex={0}
          onKeydown={(event) => event.preventVaseUIHandler()}
          onClick={handleClick}
        />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it('does not click non-composite buttons when keydown/keyup calls preventVaseUIHandler', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      const preventVaseUIHandler = (event: VaseUIEvent<Event>) => event.preventVaseUIHandler();

      await render(
        <TestButton
          tabindex={0}
          onKeydown={preventVaseUIHandler}
          onKeyup={preventVaseUIHandler}
          onClick={handleClick}
        />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      // Enter activates on keydown; the consumer prevents it.
      await fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(0);

      // Space activates on keyup; the consumer prevents it.
      await fireEvent.keyDown(button, { key: ' ' });
      await fireEvent.keyUp(button, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it('key: Enter does not click non-native buttons when keydown calls preventDefault', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      const { user } = await render(
        <TestButton
          tabindex={0}
          onKeydown={(event) => event.preventDefault()}
          onClick={handleClick}
        />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      // Match native buttons: preventing the keydown's default cancels Enter activation.
      await user.keyboard('[Enter]');
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it('key: Space does not click non-native buttons when keyup calls preventDefault', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      const { user } = await render(
        <TestButton
          tabindex={0}
          onKeyup={(event) => event.preventDefault()}
          onClick={handleClick}
        />,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      // Match native buttons: preventing the keyup's default cancels Space activation.
      await user.keyboard('[Space]');
      expect(handleClick).toHaveBeenCalledTimes(0);
    });

    it('key: Space fires keydown then click when in composite root context', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <CompositeRoot>
          <TestButton
            tabindex={0}
            onKeydown={handleKeyDown}
            onKeyup={handleKeyUp}
            onClick={handleClick}
          />
        </CompositeRoot>,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      await fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Space fires keydown then click on native buttons in composite root context', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ButtonTestProps) => {
          const { elementProps } = useTestButton();

          return () => <button {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <CompositeRoot>
          <TestButton onKeydown={handleKeyDown} onKeyup={handleKeyUp} onClick={handleClick} />
        </CompositeRoot>,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);

      await fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('`composite=false` keeps keyup activation inside composite root context', async () => {
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false, composite: false });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(
        <CompositeRoot>
          <TestButton onKeydown={handleKeyDown} onKeyup={handleKeyUp} onClick={handleClick} />
        </CompositeRoot>,
      );

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: ' ' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(0);

      await fireEvent.keyUp(button, { key: ' ' });
      expect(handleKeyUp).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('key: Enter fires keydown then click on non-native buttons', async () => {
      const handleKeyDown = vi.fn();
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(<TestButton onKeydown={handleKeyDown} onClick={handleClick} />);

      const button = screen.getByRole('button');

      await focusElement(button);
      expect(button).toHaveFocus();

      expect(handleKeyDown).toHaveBeenCalledTimes(0);
      await fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('gives the modifier keys of the key event to the click', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(
        (_props: ElementTestProps) => {
          const { elementProps } = useTestButton({ native: false });

          return () => <span {...elementProps()} />;
        },
        { inheritAttrs: false },
      );

      await render(<TestButton onClick={handleClick} />);

      await fireEvent.keyDown(screen.getByRole('button'), {
        key: 'Enter',
        shiftKey: true,
        ctrlKey: true,
        altKey: true,
        metaKey: true,
      });

      expect(handleClick).toHaveBeenCalledTimes(1);
      const click: PointerEvent = handleClick.mock.calls[0][0];
      expect([click.shiftKey, click.ctrlKey, click.altKey, click.metaKey]).toEqual([
        true,
        true,
        true,
        true,
      ]);
      expect(click.detail).toBe(0);
      expect(click.pointerType).toBe('');
    });

    it('calls each function of an external handler array', async () => {
      const first = vi.fn();
      const second = vi.fn();

      const TestButton = defineComponent(() => {
        const { elementProps } = useTestButton({}, () => ({ onClick: [first, second] }));

        return () => <button {...elementProps()} />;
      });

      await render(<TestButton />);

      await fireEvent.click(screen.getByRole('button'));

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('activates when an external handler is `false`', async () => {
      const handleClick = vi.fn();

      const TestButton = defineComponent(() => {
        const { elementProps } = useTestButton({ native: false }, () => ({
          onKeydown: false,
          onClick: handleClick,
        }));

        return () => <span {...elementProps()} />;
      });

      await render(<TestButton />);

      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('dev warnings', () => {
    it('errors if nativeButton=true but ref is not a button', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});
      const TestButton = defineComponent(() => {
        const { elementProps, setRef } = useTestButton({ native: true });

        return () => <span {...elementProps()} ref={setRef} />;
      });
      await render(<TestButton />);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Vase UI: A component that acts as a button expected a native <button> because ' +
            'the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics, ' +
            'which can impact forms and accessibility. Use a real <button> with the `as` prop or the ' +
            '`#render` slot, or set `nativeButton` to `false`.',
        ),
      );
    });

    it('errors if nativeButton=false but ref is a button', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});
      const TestButton = defineComponent(() => {
        const { elementProps, setRef } = useTestButton({ native: false });

        return () => <button {...elementProps()} ref={setRef} />;
      });
      await render(<TestButton />);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Vase UI: A component that acts as a button expected a non-<button> because ' +
            'the `nativeButton` prop is false. Rendering a <button> keeps native behavior while Vase UI ' +
            'applies non-native attributes and handlers, which can add unintended extra attributes ' +
            '(such as `role` or `aria-disabled`). Use a non-<button> with the `as` prop or the ' +
            '`#render` slot, or set `nativeButton` to `true`.',
        ),
      );
    });

    it('errors when `native` changes and the element does not match', async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});
      const TestButton = defineComponent(
        (props: { native?: boolean | undefined }) => {
          const { elementProps, setRef } = useTestButton({ native: () => props.native });

          return () => <button {...elementProps()} ref={setRef} />;
        },
        { props: ['native'] },
      );

      const { setProps } = await render(<TestButton native />);
      expect(errorSpy).not.toHaveBeenCalled();

      await setProps({ native: false });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Vase UI: A component that acts as a button expected a non-<button> because ' +
            'the `nativeButton` prop is false.',
        ),
      );
    });
  });
});
