import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import type { VaseUIEvent } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  mockRuntimeLocale,
  renderOnServer,
  screen,
  waitFor,
  within,
} from '#test-utils';
import * as Slider from '../index.parts';
import SliderThumbHydration from './SliderThumbHydration.test.vue';

// Gives its root a new function ref in each render. It exposes its element.
const UnstableRefThumb = defineComponent(
  (_props, { attrs, expose, slots }) => {
    const element = shallowRef<HTMLDivElement | null>(null);
    expose({ element });

    return () => (
      <div
        {...attrs}
        ref={(value) => {
          element.value = value as HTMLDivElement | null;
        }}
      >
        {slots.default?.()}
      </div>
    );
  },
  { inheritAttrs: false },
);

describe('<Slider.Thumb />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Thumb />, () => ({
    render: (node) => {
      return render(<Slider.Root>{node}</Slider.Root>);
    },
    refInstanceof: window.HTMLDivElement,
    childrenSelector: 'input[type="range"]',
  }));

  it('adds data-disabled when only the thumb is disabled', async () => {
    await render(
      <Slider.Root defaultValue={50}>
        <Slider.Control>
          <Slider.Thumb disabled data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>,
    );

    expect(screen.getByTestId('thumb')).toHaveAttribute('data-disabled');
  });

  it('sets the thumb index data attribute', async () => {
    await render(
      <Slider.Root defaultValue={50}>
        <Slider.Control>
          <Slider.Thumb data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>,
    );

    expect(screen.getByTestId('thumb')).toHaveAttribute('data-index', '0');
  });

  it('settles when the rendered component recreates its merged ref', async () => {
    await render(
      <Slider.Root defaultValue={50}>
        <Slider.Control>
          <Slider.Thumb as={UnstableRefThumb} />
        </Slider.Control>
      </Slider.Root>,
    );

    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  describe('ARIA attributes', () => {
    it.each([
      { attr: 'aria-label' },
      { attr: 'aria-labelledby' },
      { attr: 'aria-describedby' },
      { attr: 'aria-valuetext' },
    ])('forwards $attr to the input', async ({ attr }) => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb
              {...{
                [attr]: 'test',
              }}
            />
          </Slider.Control>
        </Slider.Root>,
      );
      expect(screen.getByRole('slider')).toHaveAttribute(attr, 'test');
    });

    it('prefers getAriaValueText over a direct aria-valuetext prop', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb
              aria-valuetext="ignored"
              getAriaValueText={(formatted) => `${formatted} percent`}
            />
          </Slider.Control>
        </Slider.Root>,
      );
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '50 percent');
    });

    it('formats aria-valuetext with en-US until hydrated, then with the runtime locale', async () => {
      // Options no other test here formats with; see `mockRuntimeLocale`.
      const format = { maximumFractionDigits: 1 };
      const props = { defaultValue: 1000, max: 2000, format };
      mockRuntimeLocale('de-DE');

      const serverHtml = await renderOnServer(
        'src/slider/thumb/SliderThumbHydration.test.vue',
        props,
      );
      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(
        template.content.querySelector('input[type="range"]')?.getAttribute('aria-valuetext'),
      ).toBe((1000).toLocaleString('en-US', format));

      const { container } = await hydrate(SliderThumbHydration, { serverHtml, props });
      expect(within(container).getByRole('slider')).toHaveAttribute(
        'aria-valuetext',
        (1000).toLocaleString('de-DE', format),
      );
    });
  });

  describe('prop: onKeyDown', () => {
    it('forwards key events that the slider does not handle', async () => {
      const handleKeyDown = vi.fn();
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb onKeydown={handleKeyDown} />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      slider.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(slider, { key: 'Enter' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });

    it.each([{ key: 'ArrowRight' }, { key: 'PageUp' }])(
      'forwards handled $key key events',
      async ({ key }) => {
        const handleKeyDown = vi.fn();
        await render(
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb onKeydown={handleKeyDown} />
            </Slider.Control>
          </Slider.Root>,
        );

        const slider = screen.getByRole('slider');
        slider.focus();
        await flushMicrotasks();
        await fireEvent.keyDown(slider, { key });

        expect(handleKeyDown).toHaveBeenCalledTimes(1);
      },
    );

    it('allows preventing the internal key handling', async () => {
      const handleKeyDown = vi.fn((event: KeyboardEvent) => {
        event.preventDefault();
      });

      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb onKeydown={handleKeyDown} />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      slider.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(slider, { key: 'ArrowRight' });

      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    it('does not commit NaN when more thumbs are rendered than values', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();

      await render(
        <Slider.Root
          defaultValue={[10, 20]}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const extraThumb = screen.getAllByRole('slider')[2];
      extraThumb.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(extraThumb, { key: 'ArrowRight' });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
    });
  });

  // AT (e.g. Android Talkback) may use increase/decrease actions to interact
  // with the slider which works on `input type="range"` via change events, but
  // not pure ARIA implementations using `div role="slider"`. The `input`
  // element(s) must be the only focusable element(s).
  // See:
  // - https://issues.chromium.org/issues/40816094
  // - https://github.com/mui/material-ui/issues/23506
  describe('events', () => {
    describe.skipIf(isJSDOM)('focus and blur', () => {
      it('single thumb', async () => {
        const focusAndBlurSpy = vi.fn((event) => event.target);
        const { user } = await render(
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb onFocusin={focusAndBlurSpy} onFocusout={focusAndBlurSpy} />
            </Slider.Control>
          </Slider.Root>,
        );
        expect(document.body).toHaveFocus();
        const input = screen.getByRole('slider');
        expect(input.tagName).toBe('INPUT');
        expect(input).toHaveAttribute('type', 'range');

        await user.keyboard('[Tab]');
        // We assert above that the tabbable elements of the slider are
        // input[type="range"] because TalkBack doesn't simulate keyboard events for increments
        // or decrements (proof: https://issues.chromium.org/issues/40816094). Instead, it triggers change events on those native slider inputs.
        expect(input).toHaveFocus();
        expect(focusAndBlurSpy.mock.calls.length).toBe(1);
        expect(focusAndBlurSpy.mock.results[0]?.value).toBe(input);

        await user.keyboard('[Tab]');
        expect(document.body).toHaveFocus();
        expect(focusAndBlurSpy.mock.calls.length).toBe(2);
        expect(focusAndBlurSpy.mock.results.at(-1)?.value).toBe(input);
      });

      it('multiple thumbs', async () => {
        const focusSpy = vi.fn((event) => event.target);
        const blurSpy = vi.fn((event) => event.target);
        const { user } = await render(
          <Slider.Root defaultValue={[50, 70]}>
            <Slider.Control>
              <Slider.Thumb onFocusin={focusSpy} onFocusout={blurSpy} />
              <Slider.Thumb onFocusin={focusSpy} onFocusout={blurSpy} />
            </Slider.Control>
          </Slider.Root>,
        );
        expect(document.body).toHaveFocus();
        const [slider1, slider2] = screen.getAllByRole('slider');
        expect(slider1).toHaveProperty('tagName', 'INPUT');
        expect(slider1).toHaveAttribute('type', 'range');
        expect(slider2).toHaveProperty('tagName', 'INPUT');
        expect(slider2).toHaveAttribute('type', 'range');

        await user.keyboard('[Tab]');
        expect(slider1).toHaveFocus();
        expect(focusSpy.mock.calls.length).toBe(1);
        expect(focusSpy.mock.results.at(-1)?.value).toBe(slider1);

        await user.keyboard('[Tab]');
        expect(blurSpy.mock.calls.length).toBe(1);
        expect(blurSpy.mock.results.at(-1)?.value).toBe(slider1);
        expect(slider2).toHaveFocus();
        expect(focusSpy.mock.calls.length).toBe(2);
        expect(focusSpy.mock.results.at(-1)?.value).toBe(slider2);

        await user.keyboard('[Tab]');
        expect(blurSpy.mock.calls.length).toBe(2);
        expect(blurSpy.mock.results.at(-1)?.value).toBe(slider2);
        expect(document.body).toHaveFocus();
      });

      it('forwards focus and blur to the input so `currentTarget` is the input', async () => {
        const focusSpy = vi.fn();
        const blurSpy = vi.fn();
        const { user } = await render(
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb
                onFocusin={(event: FocusEvent) => focusSpy(event.currentTarget)}
                onFocusout={(event: FocusEvent) => blurSpy(event.currentTarget)}
              />
            </Slider.Control>
          </Slider.Root>,
        );

        await user.keyboard('[Tab]');
        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(focusSpy.mock.calls[0][0]).toHaveProperty('tagName', 'INPUT');

        await user.keyboard('[Tab]');
        expect(blurSpy).toHaveBeenCalledTimes(1);
        expect(blurSpy.mock.calls[0][0]).toHaveProperty('tagName', 'INPUT');
      });

      it('does not commit field validation when moving focus between range thumbs', async () => {
        const validateSpy = vi.fn(() => null);
        const { user } = await render(
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Slider.Root defaultValue={[20, 50]}>
              <Slider.Control>
                <Slider.Thumb index={0} />
                <Slider.Thumb index={1} />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        const [thumb0, thumb1] = screen.getAllByRole('slider');

        await user.keyboard('[Tab]');
        expect(thumb0).toHaveFocus();

        validateSpy.mockClear();

        await user.keyboard('[Tab]');
        expect(thumb1).toHaveFocus();
        expect(validateSpy).not.toHaveBeenCalled();

        await user.keyboard('[Tab]');
        expect(thumb1).not.toHaveFocus();
        await waitFor(() => {
          expect(validateSpy).toHaveBeenCalledTimes(1);
        });
      });

      it.skipIf(isJSDOM)(
        'commits field validation when focus moves from a thumb to an arbitrary Control child',
        async () => {
          const validateSpy = vi.fn(() => null);
          const { user } = await render(
            <>
              <Field.Root validationMode="onBlur" validate={validateSpy} data-testid="field">
                <Slider.Root defaultValue={[20, 50]}>
                  <Slider.Control>
                    <Slider.Thumb index={0} />
                    <Slider.Thumb index={1} />
                    <button type="button">Help</button>
                  </Slider.Control>
                </Slider.Root>
              </Field.Root>
              <button type="button">Outside</button>
            </>,
          );

          const [thumb0, thumb1] = screen.getAllByRole('slider');

          await user.keyboard('[Tab]');
          expect(thumb0).toHaveFocus();
          validateSpy.mockClear();

          await user.keyboard('[Tab]');
          expect(thumb1).toHaveFocus();
          expect(validateSpy).not.toHaveBeenCalled();

          await user.keyboard('[Tab]');
          expect(screen.getByRole('button', { name: 'Help' })).toHaveFocus();
          await waitFor(() => {
            expect(validateSpy).toHaveBeenCalledTimes(1);
          });
          expect(screen.getByTestId('field')).toHaveAttribute('data-touched');
          expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');

          await user.keyboard('[Tab]');
          expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
          expect(validateSpy).toHaveBeenCalledTimes(1);
        },
      );
    });

    describe('change', () => {
      it('handles change events', async () => {
        const handleValueChange = vi.fn();
        await render(
          <Slider.Root defaultValue={50} onValueChange={handleValueChange}>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>,
        );

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');
        await fireEvent.change(slider, { target: { value: '51' } });
        expect(handleValueChange.mock.calls.length).toBe(1);
        expect(slider).toHaveAttribute('aria-valuenow', '51');
      });

      it('does not change the value beyond min and max', async () => {
        const handleValueChange = vi.fn();
        await render(
          <Slider.Root defaultValue={50} min={40} max={60} onValueChange={handleValueChange}>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>,
        );

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');

        await fireEvent.change(slider, { target: { value: '30' } });
        expect(slider).toHaveAttribute('aria-valuenow', '40');
        expect(handleValueChange.mock.calls.length).toBe(1);
        await fireEvent.change(slider, { target: { value: '30' } });
        expect(handleValueChange.mock.calls.length).toBe(1);

        await fireEvent.change(slider, { target: { value: '70' } });
        expect(slider).toHaveAttribute('aria-valuenow', '60');
        expect(handleValueChange.mock.calls.length).toBe(2);
        await fireEvent.change(slider, { target: { value: '70' } });
        expect(handleValueChange.mock.calls.length).toBe(2);
      });

      it('handles non-integer values', async () => {
        const handleValueChange = vi.fn();
        await render(
          <Slider.Root
            defaultValue={50}
            min={-100}
            max={100}
            step={0.00000001}
            onValueChange={handleValueChange}
          >
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>,
        );

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');
        expect(slider).toHaveAttribute('step', '1e-8');

        await fireEvent.change(slider, { target: { value: '51.1' } });
        expect(slider).toHaveAttribute('aria-valuenow', '51.1');

        await fireEvent.change(slider, { target: { value: '0.00000005' } });
        expect(slider).toHaveAttribute('aria-valuenow', '5e-8');

        await fireEvent.change(slider, { target: { value: '1e-7' } });
        expect(slider).toHaveAttribute('aria-valuenow', '1e-7');
      });
    });
  });

  describe('prop: tabIndex', () => {
    it('does not apply tabIndex to the thumb element by default', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(screen.getByTestId('thumb')).not.toHaveAttribute('tabindex');
      expect(screen.getByRole('slider')).toHaveProperty('tabIndex', 0);
    });

    it('can be removed from the tab sequence', async () => {
      const { user } = await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb tabindex={-1} />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(screen.getByRole('slider')).toHaveProperty('tabIndex', -1);
      expect(document.body).toHaveFocus();
      await user.keyboard('[Tab]');
      expect(document.body).toHaveFocus();
    });
  });

  describe('prop: children', () => {
    it('renders the nested input as a sibling to children', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb">
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>,
      );

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });

    it('renders the nested input when using the short form render prop', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb
              v-slots={{
                render: ({ props, children: Children }: any) => (
                  <div {...props} data-testid="thumb">
                    <Children>
                      <span data-testid="child" />
                    </Children>
                  </div>
                ),
              }}
            />
          </Slider.Control>
        </Slider.Root>,
      );

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });

    it('renders the nested input when using the long form render prop', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb
              v-slots={{
                render: ({ props, children: Children }: any) => (
                  <div data-testid="thumb" {...props}>
                    <Children>
                      <span data-testid="child" />
                    </Children>
                  </div>
                ),
              }}
            />
          </Slider.Control>
        </Slider.Root>,
      );

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });
  });

  describe('prop: inputRef', () => {
    it('can focus the input element', async () => {
      const thumb = shallowRef<{ inputElement: HTMLInputElement | null } | null>(null);
      const { user } = await render(() => (
        <>
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb
                ref={(component) => {
                  thumb.value = component as { inputElement: HTMLInputElement | null } | null;
                }}
              />
            </Slider.Control>
          </Slider.Root>
          <button
            onClick={() => {
              thumb.value?.inputElement?.focus();
            }}
          >
            Button
          </button>
        </>
      ));

      expect(document.body).toHaveFocus();
      await user.click(screen.getByText('Button'));
      expect(screen.getByRole('slider')).toHaveFocus();
    });
  });

  it('preserves the grab offset when dragging a vertical thumb', async () => {
    const onValueChange = vi.fn();

    await render(
      <Slider.Root defaultValue={50} orientation="vertical" onValueChange={onValueChange}>
        <Slider.Control data-testid="control">
          <Slider.Thumb data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>,
    );

    const control = screen.getByTestId('control');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 10, 100));
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 40, 10, 20));

    await fireEvent.pointerDown(thumb, { button: 0, buttons: 1, clientX: 5, clientY: 60 });
    await fireEvent.pointerMove(document.body, { buttons: 1, clientX: 5, clientY: 80 });

    expect(onValueChange).toHaveBeenLastCalledWith(
      30,
      expect.objectContaining({ activeThumbIndex: 0, reason: 'drag' }),
    );
  });

  describe('stacking order', () => {
    it('relies on DOM order before any thumb is used', async () => {
      await render(
        <Slider.Root defaultValue={[20, 20]}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb-0" />
            <Slider.Thumb data-testid="thumb-1" />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(screen.getByTestId('thumb-0').style.zIndex).toBe('');
      expect(screen.getByTestId('thumb-1').style.zIndex).toBe('');
    });

    it('keeps the most recently active thumb on top after focus moves away', async () => {
      const { user } = await render(
        <Slider.Root defaultValue={[20, 20]}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb-0" />
            <Slider.Thumb data-testid="thumb-1" />
          </Slider.Control>
        </Slider.Root>,
      );

      const [thumb0, thumb1] = [screen.getByTestId('thumb-0'), screen.getByTestId('thumb-1')];

      await user.keyboard('[Tab]');
      expect(screen.getAllByRole('slider')[0]).toHaveFocus();
      expect(thumb0.style.zIndex).toBe('2');

      await user.keyboard('[Tab]');
      expect(screen.getAllByRole('slider')[1]).toHaveFocus();
      expect(thumb1.style.zIndex).toBe('2');

      await user.keyboard('[Tab]');
      expect(document.body).toHaveFocus();
      expect(thumb1.style.zIndex).toBe('1');
      expect(thumb0.style.zIndex).toBe('');
    });
  });

  describe('native input events', () => {
    it('puts the state back in the input when a listener cancels the change', async () => {
      const onValueChange = vi.fn((_value: number, details: { cancel: () => void }) => {
        details.cancel();
      });
      await render(
        <Slider.Root defaultValue={30} onValueChange={onValueChange}>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole<HTMLInputElement>('slider');
      slider.value = '55';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      await flushMicrotasks();

      // The `change` event of the same action does not ask again.
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(slider.value).toBe('30');
      expect(slider).toHaveAttribute('aria-valuenow', '30');
    });

    it('handles a change event that has no input event before it, after a canceled input event', async () => {
      const onValueChange = vi.fn((_value: number, details: { cancel: () => void }) => {
        details.cancel();
      });
      await render(
        <Slider.Root defaultValue={30} onValueChange={onValueChange}>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole<HTMLInputElement>('slider');
      slider.value = '55';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      await flushMicrotasks();
      onValueChange.mockImplementation(() => {});

      // A program that fills a form can send only `change`.
      slider.value = '55';
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(slider).toHaveAttribute('aria-valuenow', '55');
    });
  });

  describe('prop: onKeydown', () => {
    it('stops its own key handling when the listener calls preventVaseUIHandler', async () => {
      const handleKeyDown = vi.fn((event: VaseUIEvent<KeyboardEvent>) => {
        event.preventVaseUIHandler();
      });
      const onValueChange = vi.fn();
      await render(
        <Slider.Root defaultValue={50} onValueChange={onValueChange}>
          <Slider.Control>
            <Slider.Thumb onKeydown={handleKeyDown} />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      slider.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(slider, { key: 'ArrowRight' });

      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });
  });

  describe('KeepAlive', () => {
    it('disconnects the observer of an inset thumb at the deactivation, and observes again at the activation', async () => {
      const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
      const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
      onTestFinished(() => {
        observe.mockRestore();
        disconnect.mockRestore();
      });

      const visible = shallowRef(true);
      const App = defineComponent(() => () => (
        <KeepAlive>
          {visible.value ? (
            <Slider.Root defaultValue={50} thumbAlignment="edge">
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          ) : null}
        </KeepAlive>
      ));

      await render(<App />);

      // The observer watches the control and the thumb.
      expect(observe).toHaveBeenCalledTimes(2);
      expect(disconnect).not.toHaveBeenCalled();

      visible.value = false;
      await nextTick();

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(observe).toHaveBeenCalledTimes(2);

      visible.value = true;
      await nextTick();

      expect(observe).toHaveBeenCalledTimes(4);
      expect(disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('hydration', () => {
    const FIXTURE = 'src/slider/thumb/SliderThumbHydration.test.vue';

    it.each([
      { name: 'a single thumb', props: { defaultValue: 30 } },
      { name: 'a range with no index', props: { defaultValue: [25, 75] } },
      { name: 'a range with an index', props: { defaultValue: [25, 75], explicitIndex: true } },
      {
        name: 'a vertical slider with a name',
        props: { defaultValue: 30, orientation: 'vertical', name: 'volume' },
      },
      { name: 'the alignment edge', props: { defaultValue: 30, alignment: 'edge' } },
      {
        name: 'a range with the alignment edge',
        props: { defaultValue: [25, 75], alignment: 'edge' },
      },
      {
        name: 'the alignment edge-client-only',
        props: { defaultValue: 30, alignment: 'edge-client-only' },
      },
    ])('hydrates $name with no mismatch', async ({ props }) => {
      const serverHtml = await renderOnServer(FIXTURE, props);

      await hydrate(SliderThumbHydration, { serverHtml, props });
    });

    it.each([
      { name: 'a single thumb', defaultValue: 30, positions: ['34%'] },
      { name: 'a range', defaultValue: [25, 75], positions: ['30%', '70%'] },
    ])(
      'places the thumbs of $name with the script, before the app starts',
      async ({ defaultValue, positions }) => {
        const serverHtml = await renderOnServer(FIXTURE, { defaultValue, alignment: 'edge' });
        const container = document.createElement('div');
        document.body.append(container);
        onTestFinished(() => container.remove());
        // `innerHTML` does not run a script. A fragment of a range does.
        container.append(document.createRange().createContextualFragment(serverHtml));

        const thumbs = [...container.querySelectorAll<HTMLElement>('[data-testid="thumb"]')];

        expect(
          thumbs.map((thumb) => [
            thumb.style.visibility,
            thumb.style.getPropertyValue('--position'),
          ]),
        ).toEqual(positions.map((position) => ['', position]));
      },
    );
  });

  describe('accessibility', () => {
    it('has no axe violation when each thumb has a name', async () => {
      const { container } = await render(
        <>
          <Slider.Root defaultValue={30}>
            <Slider.Control>
              <Slider.Thumb aria-label="Volume" />
            </Slider.Control>
          </Slider.Root>
          <Slider.Root defaultValue={[20, 80]}>
            <Slider.Control>
              <Slider.Thumb aria-label="Minimum price" />
              <Slider.Thumb aria-label="Maximum price" />
            </Slider.Control>
          </Slider.Root>
        </>,
      );

      await expectNoAxeViolations(container);
      const [volume, minimum, maximum] = screen.getAllByRole('slider');
      expect(volume).toHaveAccessibleName('Volume');
      expect(minimum).toHaveAccessibleName('Minimum price');
      expect(maximum).toHaveAccessibleName('Maximum price');
    });
  });
});
