import { describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  defineComponent,
  h,
  KeepAlive,
  nextTick,
  onMounted,
  onUpdated,
  shallowRef,
  useAttrs,
} from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Slider } from '@vase-ui/vue/slider';
import type { VaseUIEvent } from '@vase-ui/vue/types';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  flushMicrotasks,
  hydrate,
  hydrateAfter,
  isJSDOM,
  mockPageBeforeLoad,
  mockRuntimeLocale,
  recordInputEvents,
  removedPartHydrationTests,
  renderOnServer,
  screen,
  setAttributeInHtml,
  waitFor,
  waitSingleFrame,
  within,
} from '#test-utils';
import { platform } from '../../common/platform';
import { createTouches, getHorizontalSliderRect } from '../../../test/sliderTestUtils';
import SliderInputPortal from '../../../test/fixtures/SliderInputPortal.vue';
import FormRestoreRender from '../../../test/FormRestoreRender.test.vue';
import SliderRootHydration from '../root/SliderRootHydration.test.vue';
import SliderThumbHydration from './SliderThumbHydration.test.vue';

const isWebKit = platform.engine.webkit;

const FIXTURE = 'src/slider/thumb/SliderThumbHydration.test.vue';

// HTML moves the value of a range input to its step at a change of `step`. WebKit keeps the value.
const stepMovesRangeValue = (() => {
  const input = document.createElement('input');
  input.type = 'range';
  input.value = '33';
  input.step = '10';
  return input.value === '30';
})();

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

    it.each([
      { name: 'an empty value', label: '' },
      { name: 'white space', label: '\n\t ' },
    ])('VUE-106: keeps the name of the label for a getAriaLabel of $name', async ({ label }) => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Label>Volume</Slider.Label>
          <Slider.Control>
            <Slider.Thumb getAriaLabel={() => label} />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      expect(slider).not.toHaveAttribute('aria-label');
      await waitFor(() => {
        expect(slider).toHaveAccessibleName('Volume');
      });
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

    it('VUE-134: writes the aria-valuetext of the browser when the server HTML has another text', async () => {
      const props = {
        defaultValue: 1000,
        max: 2000,
        locale: 'de-DE',
        format: { maximumFractionDigits: 1 },
      };
      const serverHtml = setAttributeInHtml(
        await renderOnServer(FIXTURE, props),
        'input[type="range"]',
        'aria-valuetext',
        'other',
      );

      const { container } = await hydrate(SliderThumbHydration, { serverHtml, props });

      expect(within(container).getByRole('slider')).toHaveAttribute(
        'aria-valuetext',
        props.defaultValue.toLocaleString(props.locale, props.format),
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

      it('does not emit extra blur and focus events when restoring focus-visible', async () => {
        const focusSpy = vi.fn((event) => event.target);
        const blurSpy = vi.fn((event) => event.target);

        await render(
          <Slider.Root defaultValue={40}>
            <Slider.Control data-testid="control">
              <Slider.Thumb onFocusin={focusSpy} onFocusout={blurSpy} />
            </Slider.Control>
          </Slider.Root>,
        );

        const sliderControl = screen.getByTestId('control');
        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(
          getHorizontalSliderRect,
        );

        const slider = screen.getByRole('slider');

        await fireEvent.pointerDown(sliderControl, {
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          buttons: 1,
          clientX: 40,
          clientY: 0,
        });

        await waitFor(() => {
          expect(slider).toHaveFocus();
        });
        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(focusSpy.mock.results[0]?.value).toBe(slider);
        expect(blurSpy).not.toHaveBeenCalled();

        await fireEvent.keyDown(slider, { key: 'ArrowRight' });

        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(blurSpy).not.toHaveBeenCalled();
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
          <Field.Root validationMode="blur" validate={validateSpy}>
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

      it('VUE-87: validates on leaving the slider after focus moves to a teleported thumb input', async () => {
        const target = document.createElement('div');
        document.body.appendChild(target);
        onTestFinished(() => target.remove());
        const validate = vi.fn(() => null);
        await render(
          <Field.Root validationMode="blur" validate={validate}>
            <Slider.Root defaultValue={[20, 50]}>
              <Slider.Control>
                <Slider.Thumb aria-label="Minimum" />
                <SliderInputPortal target={target} />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        screen.getByRole('slider', { name: 'Minimum' }).focus();
        await flushMicrotasks();
        validate.mockClear();
        within(target).getByRole('slider').focus();
        await flushMicrotasks();
        expect(validate).not.toHaveBeenCalled();

        within(target).getByRole('button', { name: 'After input' }).focus();
        await flushMicrotasks();
        expect(validate).toHaveBeenCalledExactlyOnceWith([20, 50], expect.anything());
      });

      it.skipIf(isJSDOM)(
        'commits field validation when focus moves from a thumb to an arbitrary Control child',
        async () => {
          const validateSpy = vi.fn(() => null);
          const { user } = await render(
            <>
              <Field.Root validationMode="blur" validate={validateSpy} data-testid="field">
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
        await fireEvent.input(slider, { target: { value: '51' } });
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

        await fireEvent.input(slider, { target: { value: '30' } });
        expect(slider).toHaveAttribute('aria-valuenow', '40');
        expect(handleValueChange.mock.calls.length).toBe(1);
        await fireEvent.input(slider, { target: { value: '30' } });
        expect(handleValueChange.mock.calls.length).toBe(1);

        await fireEvent.input(slider, { target: { value: '70' } });
        expect(slider).toHaveAttribute('aria-valuenow', '60');
        expect(handleValueChange.mock.calls.length).toBe(2);
        await fireEvent.input(slider, { target: { value: '70' } });
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

        await fireEvent.input(slider, { target: { value: '51.1' } });
        expect(slider).toHaveAttribute('aria-valuenow', '51.1');

        await fireEvent.input(slider, { target: { value: '0.00000005' } });
        expect(slider).toHaveAttribute('aria-valuenow', '5e-8');

        await fireEvent.input(slider, { target: { value: '1e-7' } });
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

  describe('prop: thumbAlignment', () => {
    async function waitForFrames() {
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      await flushMicrotasks();
    }

    it.skipIf(isJSDOM)(
      'recomputes inset positions when the slider becomes visible (strict: $strict)',
      async () => {
        const visible = shallowRef(false);

        const { user } = await render(() => (
          <>
            <button
              type="button"
              onClick={() => {
                visible.value = true;
              }}
            >
              show
            </button>
            <div style={{ display: visible.value ? 'block' : 'none' }}>
              <Slider.Root defaultValue={30} thumbAlignment="edge" style={{ width: '100px' }}>
                <Slider.Control
                  data-testid="control"
                  style={{ position: 'relative', width: '100%', height: '10px' }}
                >
                  <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                    <Slider.Indicator data-testid="indicator" />
                    <Slider.Thumb data-testid="thumb" style={{ width: '10px', height: '10px' }} />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </div>
          </>
        ));

        const thumb = screen.getByTestId('thumb');
        const indicator = screen.getByTestId('indicator');
        // Read the thumb and indicator together so each poll checks one consistent snapshot.
        const getInsetStyles = () => ({
          thumbVisibility: thumb.style.visibility,
          thumbPosition: thumb.style.getPropertyValue('--position'),
          indicatorVisibility: indicator.style.visibility,
          indicatorStartPosition: indicator.style.getPropertyValue('--start-position'),
        });

        await waitFor(() => {
          expect(getInsetStyles()).toEqual({
            thumbVisibility: 'hidden',
            thumbPosition: '0%',
            indicatorVisibility: 'hidden',
            indicatorStartPosition: '0%',
          });
        });

        await user.click(screen.getByRole('button', { name: 'show' }));

        await waitFor(() => {
          expect(getInsetStyles()).toEqual({
            thumbVisibility: '',
            thumbPosition: '32%',
            indicatorVisibility: '',
            indicatorStartPosition: '32%',
          });
        });
      },
    );

    it.skipIf(isJSDOM)(
      'recomputes range inset positions when the slider becomes visible (strict: $strict)',
      async () => {
        const visible = shallowRef(false);

        const { user } = await render(() => (
          <>
            <button
              type="button"
              onClick={() => {
                visible.value = true;
              }}
            >
              show
            </button>
            <div style={{ display: visible.value ? 'block' : 'none' }}>
              <Slider.Root defaultValue={[30, 70]} thumbAlignment="edge" style={{ width: '100px' }}>
                <Slider.Control
                  data-testid="control"
                  style={{ position: 'relative', width: '100%', height: '10px' }}
                >
                  <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                    <Slider.Indicator data-testid="indicator" />
                    <Slider.Thumb
                      data-testid="start-thumb"
                      style={{ width: '10px', height: '10px' }}
                    />
                    <Slider.Thumb
                      data-testid="end-thumb"
                      style={{ width: '10px', height: '10px' }}
                    />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </div>
          </>
        ));

        const startThumb = screen.getByTestId('start-thumb');
        const endThumb = screen.getByTestId('end-thumb');
        const indicator = screen.getByTestId('indicator');
        // Read the thumbs and indicator together so each poll checks one consistent snapshot.
        const getInsetStyles = () => ({
          startThumbVisibility: startThumb.style.visibility,
          startThumbPosition: startThumb.style.getPropertyValue('--position'),
          endThumbVisibility: endThumb.style.visibility,
          endThumbPosition: endThumb.style.getPropertyValue('--position'),
          indicatorVisibility: indicator.style.visibility,
          indicatorStartPosition: indicator.style.getPropertyValue('--start-position'),
          indicatorRelativeSize: indicator.style.getPropertyValue('--relative-size'),
        });

        await waitFor(() => {
          expect(getInsetStyles()).toEqual({
            startThumbVisibility: 'hidden',
            startThumbPosition: '0%',
            endThumbVisibility: 'hidden',
            endThumbPosition: '0%',
            indicatorVisibility: 'hidden',
            indicatorStartPosition: '0%',
            indicatorRelativeSize: '0%',
          });
        });

        await user.click(screen.getByRole('button', { name: 'show' }));

        await waitFor(() => {
          expect(getInsetStyles()).toEqual({
            startThumbVisibility: '',
            startThumbPosition: '32%',
            endThumbVisibility: '',
            endThumbPosition: '68%',
            indicatorVisibility: '',
            indicatorStartPosition: '32%',
            indicatorRelativeSize: '36%',
          });
        });
      },
    );

    it.skipIf(isJSDOM)('recomputes inset positions when the control resizes', async () => {
      const App = defineComponent(
        (props: { width: number }) => () => (
          <Slider.Root defaultValue={0} thumbAlignment="edge" style={{ width: `${props.width}px` }}>
            <Slider.Control
              data-testid="control"
              style={{ position: 'relative', width: '100%', height: '10px' }}
            >
              <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                <Slider.Thumb data-testid="thumb" style={{ width: '40px', height: '10px' }} />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
        ),
        { props: ['width'] },
      );

      const { setProps } = await render(<App width={200} />);

      const control = screen.getByTestId('control');
      const thumb = screen.getByTestId('thumb');
      const getThumbStartGap = () =>
        thumb.getBoundingClientRect().left - control.getBoundingClientRect().left;

      await waitFor(() => {
        expect(getThumbStartGap()).toBeCloseTo(0);
      });

      await setProps({ width: 600 });

      expect(control.getBoundingClientRect().width).toBe(600);
      await waitFor(() => {
        expect(getThumbStartGap()).toBeCloseTo(0);
      });
    });

    it('VUE-148: measures the new axis when the control and thumb keep their size', async () => {
      const orientation = shallowRef<'horizontal' | 'vertical'>('horizontal');
      const App = defineComponent(() => () => (
        <Slider.Root defaultValue={0} thumbAlignment="edge" orientation={orientation.value}>
          <Slider.Control style={{ position: 'relative', width: '200px', height: '100px' }}>
            <Slider.Thumb data-testid="thumb" style={{ width: '40px', height: '10px' }} />
            <Slider.Indicator data-testid="indicator" />
          </Slider.Control>
        </Slider.Root>
      ));
      await render(<App />);
      const thumb = screen.getByTestId('thumb');
      const indicator = screen.getByTestId('indicator');
      await waitForFrames();
      expect(thumb.style.getPropertyValue('--position')).toBe('10%');

      orientation.value = 'vertical';
      await nextTick();

      expect(thumb.style.getPropertyValue('--position')).toBe('5%');
      expect(indicator.style.getPropertyValue('--start-position')).toBe('5%');
      expect(screen.getByRole('slider')).toHaveAttribute('aria-orientation', 'vertical');
    });

    it.skipIf(isJSDOM)('recomputes inset positions when the value changes', async () => {
      await render(
        <Slider.Root defaultValue={0} thumbAlignment="edge" style={{ width: '200px' }}>
          <Slider.Control
            data-testid="control"
            style={{ position: 'relative', width: '100%', height: '10px' }}
          >
            <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
              <Slider.Thumb data-testid="thumb" style={{ width: '40px', height: '10px' }} />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      const control = screen.getByTestId('control');
      const thumb = screen.getByTestId('thumb');
      const getThumbStartGap = () =>
        thumb.getBoundingClientRect().left - control.getBoundingClientRect().left;
      const getThumbEndGap = () =>
        control.getBoundingClientRect().right - thumb.getBoundingClientRect().right;

      await waitFor(() => {
        expect(getThumbStartGap()).toBeCloseTo(0);
      });
      // Let the ResizeObserver deliver its initial callback, so it can't recompute after the key press.
      await waitForFrames();

      const slider = screen.getByRole('slider');
      slider.focus();
      await flushMicrotasks();
      await fireEvent.keyDown(slider, { key: 'End' });

      expect(slider).toHaveAttribute('aria-valuenow', '100');
      await waitFor(() => {
        expect(getThumbEndGap()).toBeCloseTo(0);
      });
    });

    it.skipIf(isJSDOM)('hides the thumb when min and max become equal', async () => {
      const App = defineComponent(
        (props: { max: number }) => () => (
          <Slider.Root
            modelValue={0}
            min={0}
            max={props.max}
            thumbAlignment="edge"
            style={{ width: '200px' }}
          >
            <Slider.Control style={{ position: 'relative', width: '100%', height: '10px' }}>
              <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                <Slider.Thumb data-testid="thumb" style={{ width: '40px', height: '10px' }} />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
        ),
        { props: ['max'] },
      );

      const { setProps } = await render(<App max={100} />);
      const thumb = screen.getByTestId('thumb');

      await waitFor(() => {
        expect(thumb.style.visibility).toBe('');
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => warnSpy.mockRestore());

      await setProps({ max: 0 });

      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        'Vase UI: Slider `max` must be greater than `min`. With `max` at or below `min`, the slider has no range of values to choose from. Set `max` above `min`.',
      );

      await waitFor(() => {
        expect(thumb.style.visibility).toBe('hidden');
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it.skipIf(isJSDOM).each([
      { name: 'with a resize', nextWidth: 600 },
      { name: 'without a resize', nextWidth: 200 },
    ])(
      'moves the indicator end to a thumb that becomes the last thumb ($name)',
      async ({ nextWidth }) => {
        const App = defineComponent(
          (props: { value: number[]; width: number }) => () => (
            <Slider.Root
              modelValue={props.value}
              thumbAlignment="edge"
              style={{ width: `${props.width}px` }}
            >
              <Slider.Control
                data-testid="control"
                style={{ position: 'relative', width: '100%', height: '10px' }}
              >
                <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                  <Slider.Indicator data-testid="indicator" />
                  {props.value.map((_, index) => (
                    <Slider.Thumb
                      key={index}
                      index={index}
                      data-testid={`thumb-${index}`}
                      style={{ width: '40px', height: '10px' }}
                    />
                  ))}
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          ),
          { props: ['value', 'width'] },
        );

        const { setProps } = await render(<App value={[20, 50, 80]} width={200} />);

        const control = screen.getByTestId('control');
        const indicator = screen.getByTestId('indicator');
        const getIndicatorEnd = () =>
          indicator.getBoundingClientRect().right - control.getBoundingClientRect().left;
        const getThumbCenter = (thumb: HTMLElement) => {
          const rect = thumb.getBoundingClientRect();
          return rect.left + rect.width / 2 - control.getBoundingClientRect().left;
        };

        await waitFor(() => {
          expect(getIndicatorEnd()).toBeCloseTo(getThumbCenter(screen.getByTestId('thumb-2')));
        });
        // Let the ResizeObserver deliver its initial callback, so it can't recompute after the update.
        await waitForFrames();

        await setProps({ value: [20, 50], width: nextWidth });

        expect(screen.queryByTestId('thumb-2')).toBe(null);
        const thumb = screen.getByTestId('thumb-1');
        await waitFor(() => {
          expect(getIndicatorEnd()).toBeCloseTo(getThumbCenter(thumb));
        });
      },
    );

    it.skipIf(isJSDOM)(
      'moves the indicator start to a thumb that becomes the first thumb',
      async () => {
        const App = defineComponent(
          (props: { value: number[] }) => () => (
            <Slider.Root modelValue={props.value} thumbAlignment="edge" style={{ width: '200px' }}>
              <Slider.Control
                data-testid="control"
                style={{ position: 'relative', width: '100%', height: '10px' }}
              >
                <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                  <Slider.Indicator data-testid="indicator" />
                  {props.value.map((thumbValue, index) => (
                    <Slider.Thumb
                      key={thumbValue}
                      index={index}
                      data-testid={`thumb-${thumbValue}`}
                      style={{ width: '40px', height: '10px' }}
                    />
                  ))}
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          ),
          { props: ['value'] },
        );

        const { setProps } = await render(<App value={[20, 50, 80]} />);

        const control = screen.getByTestId('control');
        const indicator = screen.getByTestId('indicator');
        const getIndicatorStart = () =>
          indicator.getBoundingClientRect().left - control.getBoundingClientRect().left;
        const getThumbCenter = (thumb: HTMLElement) => {
          const rect = thumb.getBoundingClientRect();
          return rect.left + rect.width / 2 - control.getBoundingClientRect().left;
        };

        await waitFor(() => {
          expect(getIndicatorStart()).toBeCloseTo(getThumbCenter(screen.getByTestId('thumb-20')));
        });
        // Let the ResizeObserver deliver its initial callback, so it can't recompute after the update.
        await waitForFrames();

        await setProps({ value: [50, 80] });

        expect(screen.queryByTestId('thumb-20')).toBe(null);
        const thumb = screen.getByTestId('thumb-50');
        await waitFor(() => {
          expect(getIndicatorStart()).toBeCloseTo(getThumbCenter(thumb));
        });
      },
    );

    it.skipIf(isJSDOM)(
      'disconnects its ResizeObserver when the slider unmounts during the mount measurement',
      async () => {
        const proto = ResizeObserver.prototype;
        const originalObserve = proto.observe;
        const originalDisconnect = proto.disconnect;
        const observedTargets = new Map<ResizeObserver, Element[]>();
        const disconnected = new Set<ResizeObserver>();
        const observeSpy = vi.spyOn(proto, 'observe').mockImplementation(function observe(
          this: ResizeObserver,
          target: Element,
          options?: ResizeObserverOptions,
        ) {
          observedTargets.set(this, [...(observedTargets.get(this) ?? []), target]);
          originalObserve.call(this, target, options);
        });
        const disconnectSpy = vi.spyOn(proto, 'disconnect').mockImplementation(function disconnect(
          this: ResizeObserver,
        ) {
          disconnected.add(this);
          originalDisconnect.call(this);
        });
        onTestFinished(() => {
          observeSpy.mockRestore();
          disconnectSpy.mockRestore();
        });

        const handleShown = vi.fn();
        const mounted = shallowRef(true);

        // Unmounts the slider once the indicator is positioned,
        // which happens inside the flush of the mount measurement.
        const UnmountOnShow = defineComponent({
          inheritAttrs: false,
          props: { onShown: { type: Function, required: true } },
          setup(props) {
            const attrs = useAttrs();
            const check = () => {
              if ((attrs.style as { visibility?: string } | undefined)?.visibility !== 'hidden') {
                props.onShown();
              }
            };
            onMounted(check);
            onUpdated(check);
            return () => h('div', attrs);
          },
        });

        const onShown = () => {
          handleShown();
          mounted.value = false;
        };

        await render(() =>
          mounted.value ? (
            <Slider.Root defaultValue={30} thumbAlignment="edge" style={{ width: '200px' }}>
              <Slider.Control
                data-testid="control"
                style={{ position: 'relative', width: '100%', height: '10px' }}
              >
                <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                  <Slider.Indicator
                    v-slots={{
                      render: ({ props }: { props: Record<string, unknown> }) => (
                        <UnmountOnShow {...props} onShown={onShown} />
                      ),
                    }}
                  />
                  <Slider.Thumb style={{ width: '40px', height: '10px' }} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          ) : (
            <span />
          ),
        );
        await waitForFrames();

        expect(handleShown).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('control')).toBe(null);

        const controlObservers = [...observedTargets].filter(([, targets]) =>
          targets.some((target) => target.getAttribute('data-testid') === 'control'),
        );
        // Without an observer, the next check passes with nothing to check.
        expect(controlObservers.length).toBeGreaterThan(0);
        expect(controlObservers.filter(([observer]) => !disconnected.has(observer))).toEqual([]);
      },
    );

    describe.skipIf(isJSDOM)('updates inset positions before the next paint', () => {
      async function renderEdgeSlider() {
        await render(
          <div data-testid="wrapper">
            <Slider.Root defaultValue={0} thumbAlignment="edge" style={{ width: '200px' }}>
              <Slider.Control
                data-testid="control"
                style={{ position: 'relative', width: '100%', height: '10px' }}
              >
                <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                  <Slider.Thumb data-testid="thumb" style={{ width: '40px', height: '10px' }} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          </div>,
        );

        const control = screen.getByTestId('control');
        const thumb = screen.getByTestId('thumb');

        await waitFor(() => {
          expect(thumb.getBoundingClientRect().left - control.getBoundingClientRect().left).toBe(0);
        });
        // Let the slider's ResizeObserver deliver its initial callback.
        await waitForFrames();

        return { control, thumb };
      }

      // Observers are notified in creation order before paint, so this callback sees what's painted.
      function readThumbOnNextResize(control: HTMLElement, thumb: HTMLElement) {
        return new Promise<{ startGap: number; visibility: string }>((resolve) => {
          const observer = new ResizeObserver(() => {
            const controlRect = control.getBoundingClientRect();
            if (controlRect.width === 0) {
              return;
            }
            observer.disconnect();
            resolve({
              startGap: thumb.getBoundingClientRect().left - controlRect.left,
              visibility: thumb.style.visibility,
            });
          });
          observer.observe(control);
        });
      }

      it('after the control resizes', async () => {
        const { control, thumb } = await renderEdgeSlider();
        const painted = readThumbOnNextResize(control, thumb);

        control.parentElement!.style.width = '600px';
        await waitForFrames();

        expect(await painted).toEqual({ startGap: 0, visibility: '' });
      });

      it('after the slider is shown again', async () => {
        const { control, thumb } = await renderEdgeSlider();
        const wrapper = screen.getByTestId('wrapper');

        wrapper.style.display = 'none';
        await waitForFrames();
        expect(control.getBoundingClientRect().width).toBe(0);

        const painted = readThumbOnNextResize(control, thumb);
        wrapper.style.display = '';
        await waitForFrames();

        expect(await painted).toEqual({ startGap: 0, visibility: '' });
      });
    });
  });

  /**
   * Browser tests render with 1024px width by default, so most tests here set
   * the component to `width: 100px` to make the asserted values more readable.
   */
  describe.skipIf(isJSDOM || isWebKit || typeof Touch === 'undefined')('positioning styles', () => {
    describe('positions the thumb when dragged', () => {
      it('single thumb', async () => {
        await render(
          <Slider.Root
            style={{
              width: '1000px',
            }}
          >
            <Slider.Control data-testid="control">
              <Slider.Track>
                <Slider.Indicator />
                <Slider.Thumb data-testid="thumb" />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>,
        );

        const sliderControl = screen.getByTestId('control');

        const thumbStyles = getComputedStyle(screen.getByTestId('thumb'));

        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
          getHorizontalSliderRect(1000),
        );

        await fireEvent.touchStart(
          sliderControl,
          createTouches([{ identifier: 1, clientX: 20, clientY: 0 }]),
        );
        await fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 199, clientY: 0 }]),
        );
        await fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 199, clientY: 0 }]),
        );

        await fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 199, clientY: 0 }]),
        );

        expect(thumbStyles.getPropertyValue('left')).toBe('200px');
        await fireEvent.touchEnd(
          document.body,
          createTouches([{ identifier: 1, clientX: 0, clientY: 0 }]),
        );
        expect(thumbStyles.getPropertyValue('left')).toBe('200px');
      });

      it('multiple thumbs', async () => {
        await render(
          <Slider.Root
            defaultValue={[20, 40]}
            style={{
              width: '1000px',
            }}
          >
            <Slider.Control data-testid="control">
              <Slider.Track>
                <Slider.Indicator />
                <Slider.Thumb data-testid="thumb" />
                <Slider.Thumb data-testid="thumb" />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>,
        );

        const sliderControl = screen.getByTestId('control');

        const computedStyles = {
          thumb1: getComputedStyle(screen.getAllByTestId('thumb')[0]),
          thumb2: getComputedStyle(screen.getAllByTestId('thumb')[1]),
        };

        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
          getHorizontalSliderRect(1000),
        );

        await fireEvent.touchStart(
          sliderControl,
          createTouches([{ identifier: 1, clientX: 400, clientY: 0 }]),
        );
        await fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 699, clientY: 0 }]),
        );
        await fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 699, clientY: 0 }]),
        );

        await fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 699, clientY: 0 }]),
        );

        expect(computedStyles.thumb2.getPropertyValue('left')).toBe('700px');
        await fireEvent.touchEnd(
          document.body,
          createTouches([{ identifier: 1, clientX: 0, clientY: 0 }]),
        );
        expect(computedStyles.thumb1.getPropertyValue('left')).toBe('200px');
        expect(computedStyles.thumb2.getPropertyValue('left')).toBe('700px');
      });

      describe('prop: thumbCollisionBehavior', () => {
        function getSliderValues() {
          return screen
            .getAllByRole('slider')
            .map((input) => Number(input.getAttribute('aria-valuenow')));
        }

        it('prevents thumbs from passing each other when set to "none"', async () => {
          await render(
            <Slider.Root
              defaultValue={[20, 40]}
              thumbCollisionBehavior="none"
              style={{
                width: '1000px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb index={0} data-testid="thumb1" />
                  <Slider.Thumb index={1} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>,
          );

          const sliderControl = screen.getByTestId('control');

          vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
            getHorizontalSliderRect(1000),
          );

          await fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 200, clientY: 0 }]),
          );
          await fireEvent.touchMove(
            document.body,
            createTouches([{ identifier: 1, clientX: 600, clientY: 0 }]),
          );
          await fireEvent.touchEnd(
            document.body,
            createTouches([{ identifier: 1, clientX: 600, clientY: 0 }]),
          );

          expect(getSliderValues()).toEqual([40, 40]);
        });

        it('pushes adjacent thumbs forward when set to "push"', async () => {
          await render(
            <Slider.Root
              defaultValue={[20, 40]}
              thumbCollisionBehavior="push"
              style={{
                width: '1000px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb index={0} data-testid="thumb1" />
                  <Slider.Thumb index={1} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>,
          );

          const sliderControl = screen.getByTestId('control');

          vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
            getHorizontalSliderRect(1000),
          );

          await fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 200, clientY: 0 }]),
          );
          await fireEvent.touchMove(
            document.body,
            createTouches([{ identifier: 1, clientX: 650, clientY: 0 }]),
          );
          await fireEvent.touchEnd(
            document.body,
            createTouches([{ identifier: 1, clientX: 650, clientY: 0 }]),
          );

          expect(getSliderValues()).toEqual([65, 65]);
        });

        it('allows thumbs to swap when set to "swap"', async () => {
          await render(
            <Slider.Root
              defaultValue={[20, 40]}
              thumbCollisionBehavior="swap"
              style={{
                width: '1000px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb index={0} data-testid="thumb1" />
                  <Slider.Thumb index={1} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>,
          );

          const sliderControl = screen.getByTestId('control');

          vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
            getHorizontalSliderRect(1000),
          );

          await fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 200, clientY: 0 }]),
          );
          await fireEvent.touchMove(
            document.body,
            createTouches([{ identifier: 1, clientX: 700, clientY: 0 }]),
          );
          await fireEvent.touchEnd(
            document.body,
            createTouches([{ identifier: 1, clientX: 700, clientY: 0 }]),
          );

          expect(getSliderValues()).toEqual([40, 70]);
        });

        it('maintains minimum steps between values when swapping', async () => {
          await render(
            <Slider.Root
              defaultValue={[20, 40, 60]}
              minStepsBetweenValues={10}
              thumbCollisionBehavior="swap"
              style={{
                width: '1000px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb index={0} data-testid="thumb1" />
                  <Slider.Thumb index={1} />
                  <Slider.Thumb index={2} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>,
          );

          const sliderControl = screen.getByTestId('control');

          vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
            getHorizontalSliderRect(1000),
          );

          await fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 200, clientY: 0 }]),
          );
          await fireEvent.touchMove(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 500, clientY: 0 }]),
          );
          await fireEvent.touchMove(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 550, clientY: 0 }]),
          );
          await fireEvent.touchMove(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 800, clientY: 0 }]),
          );
          await fireEvent.touchEnd(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 800, clientY: 0 }]),
          );

          expect(getSliderValues()).toEqual([30, 50, 80]);
        });
      });
    });

    describe('positions the thumb when the controlled value changes externally', () => {
      it('single thumb', async () => {
        const value = shallowRef(20);
        await render(() => (
          <>
            <button
              onClick={() => {
                value.value = 55;
              }}
            />
            <Slider.Root
              modelValue={value.value}
              onValueChange={(newValue) => {
                value.value = newValue as number;
              }}
              style={{
                width: '100px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb data-testid="thumb" />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          </>
        ));

        const thumbStyles = getComputedStyle(screen.getByTestId('thumb'));
        expect(thumbStyles.getPropertyValue('left')).toBe('20px');

        await fireEvent.click(screen.getByRole('button'));
        expect(thumbStyles.getPropertyValue('left')).toBe('55px');
      });

      it('multiple thumbs', async () => {
        const value = shallowRef([20, 50]);
        await render(() => (
          <>
            <button
              onClick={() => {
                value.value = [33, 72];
              }}
            />
            <Slider.Root
              modelValue={value.value}
              onValueChange={(newValue) => {
                value.value = newValue as number[];
              }}
              style={{
                width: '100px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb data-testid="thumb" />
                  <Slider.Thumb data-testid="thumb" />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          </>
        ));

        const computedStyles = {
          thumb1: getComputedStyle(screen.getAllByTestId('thumb')[0]),
          thumb2: getComputedStyle(screen.getAllByTestId('thumb')[1]),
        };

        expect(computedStyles.thumb1.getPropertyValue('left')).toBe('20px');
        expect(computedStyles.thumb2.getPropertyValue('left')).toBe('50px');

        await fireEvent.click(screen.getByRole('button'));
        expect(computedStyles.thumb1.getPropertyValue('left')).toBe('33px');
        expect(computedStyles.thumb2.getPropertyValue('left')).toBe('72px');
      });
    });

    it('thumb should not go out of bounds when the controlled value goes out of bounds', async () => {
      const value = shallowRef(50);
      const { user } = await render(() => (
        <>
          <button
            onClick={() => {
              value.value = 119.9;
            }}
          >
            max
          </button>
          <button
            onClick={() => {
              value.value = -7.31;
            }}
          >
            min
          </button>
          <Slider.Root
            modelValue={value.value}
            onValueChange={(newValue) => {
              value.value = newValue;
            }}
            min={0}
            max={100}
            style={{ width: '100px' }}
          >
            <Slider.Control data-testid="control">
              <Slider.Track>
                <Slider.Indicator />
                <Slider.Thumb data-testid="thumb" />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>
        </>
      ));

      const thumbStyles = getComputedStyle(screen.getByTestId('thumb'));
      expect(thumbStyles.getPropertyValue('left')).toBe('50px');

      await user.click(screen.getByRole('button', { name: 'max' }));
      expect(thumbStyles.getPropertyValue('left')).toBe('100px');

      await user.click(screen.getByRole('button', { name: 'min' }));
      expect(thumbStyles.getPropertyValue('left')).toBe('0px');
    });
  });

  describe.skipIf(isJSDOM)('server-side rendering', () => {
    // A fragment of a range runs the inline script of the server HTML, as a page does.
    async function insertServerHtml(props: {
      defaultValue: number | number[];
      alignment?: 'edge';
    }) {
      const serverHtml = await renderOnServer('src/slider/thumb/SliderThumbServer.test.vue', props);
      const container = document.createElement('div');
      document.body.append(container);
      onTestFinished(() => container.remove());
      container.append(document.createRange().createContextualFragment(serverHtml));
      return container;
    }

    it('single thumb', async () => {
      const container = await insertServerHtml({ defaultValue: 30 });

      expect(
        getComputedStyle(within(container).getByTestId('thumb')).getPropertyValue('left'),
      ).toBe('30px');
    });

    it('renders the inline pre-hydration script for edge-aligned thumbs', async () => {
      const container = await insertServerHtml({ defaultValue: 30, alignment: 'edge' });

      expect(container.querySelector('script')).not.toBe(null);
    });

    it('renders a single pre-hydration script with the last thumb', async () => {
      const container = await insertServerHtml({ defaultValue: [30, 40], alignment: 'edge' });

      const scripts = container.querySelectorAll('script');
      expect(scripts).toHaveLength(1);

      // The script must render with the last thumb so all preceding thumbs are already in the DOM.
      const thumbs = within(container).getAllByTestId('thumb');
      expect(thumbs[thumbs.length - 1].contains(scripts[0])).toBe(true);
    });

    it('multiple thumbs', async () => {
      const container = await insertServerHtml({ defaultValue: [30, 40] });

      const [thumb0, thumb1] = within(container).getAllByTestId('thumb');

      expect(getComputedStyle(thumb0).getPropertyValue('left')).toBe('30px');
      expect(getComputedStyle(thumb1).getPropertyValue('left')).toBe('40px');
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

    it('takes another input event after a canceled edit', async () => {
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

      slider.value = '55';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(slider).toHaveAttribute('aria-valuenow', '55');
    });

    it('handles no change event for the value that the input has after a write', async () => {
      const onValueChange = vi.fn();
      await render(
        <Slider.Root defaultValue={33} step={10} onValueChange={onValueChange}>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );
      const slider = screen.getByRole<HTMLInputElement>('slider');
      expect(slider.value).toBe('30');

      slider.dispatchEvent(new Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '33');
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

    it('does not measure an inset thumb while KeepAlive holds it, and measures it again at the activation', async () => {
      const value = shallowRef(30);
      const visible = shallowRef(true);
      const Content = defineComponent(() => () => (
        <Slider.Root modelValue={value.value} thumbAlignment="edge" style={{ width: '200px' }}>
          <Slider.Control style={{ position: 'relative', width: '100%', height: '10px' }}>
            <Slider.Thumb data-testid="thumb" style={{ width: '20px', height: '10px' }} />
          </Slider.Control>
        </Slider.Root>
      ));
      const App = defineComponent(() => () => (
        <KeepAlive>{visible.value ? <Content /> : null}</KeepAlive>
      ));

      await render(<App />);

      const thumb = screen.getByTestId('thumb');
      await waitFor(() => {
        expect(thumb.style.getPropertyValue('--position')).toBe('32%');
      });
      const measure = vi.spyOn(thumb, 'getBoundingClientRect');
      onTestFinished(() => {
        measure.mockRestore();
      });

      visible.value = false;
      await nextTick();
      value.value = 60;
      await nextTick();

      expect(measure).not.toHaveBeenCalled();
      expect(thumb.style.getPropertyValue('--position')).toBe('32%');

      visible.value = true;

      await waitFor(() => {
        expect(thumb.style.getPropertyValue('--position')).toBe('59%');
      });
    });

    it('measures an inset thumb from the first activation after a held mount', async () => {
      const value = shallowRef(30);
      const width = shallowRef(200);
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
        <Slider.Root
          modelValue={value.value}
          thumbAlignment="edge"
          style={{ width: `${width.value}px` }}
        >
          <Slider.Control style={{ position: 'relative', width: '100%', height: '10px' }}>
            <Slider.Thumb data-testid="thumb" style={{ width: '20px', height: '10px' }} />
          </Slider.Control>
        </Slider.Root>
      ));
      await render(<HeldBranch />);

      const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
      onTestFinished(() => observe.mockRestore());
      await mountWhileHeld();
      expect(
        observe.mock.calls.some(([target]) => target.getAttribute('data-testid') === 'thumb'),
      ).toBe(false);
      value.value = 60;
      await flushMicrotasks();
      await show();

      const thumb = screen.getByTestId('thumb');
      await waitFor(() => {
        expect(thumb.style.getPropertyValue('--position')).toBe('59%');
      });
      // A style write in the microtask checkpoint of an observer callback gives the loop error of
      // the browser, so the resize leaves that task.
      await waitSingleFrame();

      width.value = 400;

      await waitFor(() => {
        expect(thumb.style.getPropertyValue('--position')).toBe('59.5%');
      });
    });
  });

  describe('hydration', () => {
    removedPartHydrationTests({
      file: 'src/slider/root/SliderRootHydration.test.vue',
      component: SliderRootHydration,
      cases: [
        {
          name: 'a removed field label',
          props: { id: 'volume', defaultValue: 30, field: true, laterRemovedAtMount: true },
          selector: 'input[type="range"]',
          attribute: 'aria-labelledby',
          serverValue: 'label-a',
          clientValue: null,
        },
        {
          name: 'a removed description',
          props: { id: 'volume', defaultValue: 30, field: true, laterRemovedAtMount: true },
          selector: 'input[type="range"]',
          attribute: 'aria-describedby',
          serverValue: 'desc-a',
          clientValue: null,
        },
        {
          name: 'a removed slider label',
          props: {
            id: 'volume',
            defaultValue: 30,
            sliderLabel: 'after',
            laterRemovedAtMount: true,
          },
          selector: 'input[type="range"]',
          attribute: 'aria-labelledby',
          serverValue: 'volume-label',
          clientValue: null,
        },
      ],
    });

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

  describe('VUE-81: the state that the input got before the hydration', () => {
    async function hydrateWritten(props: Record<string, unknown>, written: string[]) {
      const serverHtml = await renderOnServer(FIXTURE, props);
      let serverInputs: HTMLInputElement[] = [];
      let events: string[] = [];
      const { container } = await hydrateAfter(SliderThumbHydration, {
        serverHtml,
        props,
        before(serverContainer) {
          events = recordInputEvents(serverContainer);
          serverInputs = [...serverContainer.querySelectorAll<HTMLInputElement>('input')];
          written.forEach((value, index) => {
            if (value !== '') {
              serverInputs[index]!.value = value;
            }
          });
        },
      });
      await flushMicrotasks();
      // Vue hydrated the nodes of the server HTML. It did not make new nodes.
      expect([...container.querySelectorAll('input')]).toEqual(serverInputs);
      return { fixture: within(container), inputs: serverInputs, events };
    }

    it('takes the value that the browser restored into one thumb', async () => {
      const { fixture, inputs, events } = await hydrateWritten({ defaultValue: [25, 75] }, [
        '55',
        '',
      ]);

      expect(inputs.map((input) => input.value)).toEqual(['55', '75']);
      expect(fixture.getByTestId('changes').textContent).toBe('55,75 (input-change)');
      expect(events).toEqual(['input']);
    });

    it.each([
      {
        name: 'a controlled range',
        props: { defaultValue: [25, 75], controlled: true },
        written: ['35', '65'],
        result: '35,65',
      },
      {
        name: 'a controlled range past its end',
        props: { defaultValue: [20, 80], controlled: true },
        written: ['85', '95'],
        result: '85,95',
      },
      {
        name: 'a range with a minimum distance',
        props: { defaultValue: [20, 80], minStepsBetweenValues: 10 },
        written: ['75', '95'],
        result: '75,95',
      },
    ])('takes each changed thumb of $name in one change', async ({ props, written, result }) => {
      const { fixture, inputs, events } = await hydrateWritten(props, written);

      expect(fixture.getByTestId('model').textContent).toBe(
        props.controlled ? result : String(props.defaultValue),
      );
      expect(fixture.getByTestId('changes').textContent).toBe(`${result} (input-change)`);
      expect(inputs.map((input) => input.value)).toEqual(result.split(','));
      expect(events).toEqual(['input', 'input']);
    });

    it('stops one thumb that the browser restored past its neighbour at the neighbour', async () => {
      const { fixture, inputs, events } = await hydrateWritten({ defaultValue: [25, 75] }, [
        '90',
        '',
      ]);

      expect(fixture.getByTestId('changes').textContent).toBe('75,75 (input-change)');
      expect(inputs.map((input) => input.value)).toEqual(['75', '75']);
      expect(events).toEqual(['input']);
    });
  });

  describe('VUE-81: the form state that the browser restores', () => {
    function readThumbs(container: HTMLElement) {
      return [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')].map(
        (input) => [input.value, input.getAttribute('aria-valuenow')],
      );
    }

    function writeInputs(container: HTMLElement, written: string[]) {
      const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')];
      written.forEach((value, index) => {
        inputs[index]!.value = value;
      });
      return inputs;
    }

    it('takes the input at a `pageshow` event', async () => {
      const { container } = await render(<SliderThumbHydration defaultValue={30} controlled />);
      const fixture = within(container);
      const events = recordInputEvents(container);
      const input = container.querySelector<HTMLInputElement>('input[type="range"]')!;
      input.value = '45';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(fixture.getByTestId('model').textContent).toBe('45');
      expect(fixture.getByTestId('changes').textContent).toBe('45 (input-change)');
      expect(input.value).toBe('45');
      expect(events).toEqual(['input']);
    });

    it.each([
      { name: 'one thumb', props: { defaultValue: 33 }, thumbs: [['30', '33']] },
      {
        name: 'a range',
        props: { defaultValue: [25, 75] },
        thumbs: [
          ['30', '25'],
          ['80', '75'],
        ],
      },
      {
        name: 'a controlled thumb',
        props: { defaultValue: 33, controlled: true },
        thumbs: [['30', '33']],
      },
    ])('keeps a value off the step at a `pageshow` event for $name', async ({ props, thumbs }) => {
      const { container } = await render(<SliderThumbHydration {...props} step={10} />);
      const events = recordInputEvents(container);
      expect(readThumbs(container)).toEqual(thumbs);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(readThumbs(container)).toEqual(thumbs);
      expect(within(container).getByTestId('changes').textContent).toBe('');
      expect(events).toEqual([]);
    });

    it('keeps a value off the step at a `pageshow` event after the hydration', async () => {
      const props = { defaultValue: 33, step: 10 };
      const serverHtml = await renderOnServer(FIXTURE, props);
      const { container } = await hydrate(SliderThumbHydration, { serverHtml, props });
      const events = recordInputEvents(container);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(readThumbs(container)).toEqual([['30', '33']]);
      expect(within(container).getByTestId('changes').textContent).toBe('');
      expect(events).toEqual([]);
    });

    async function expectNoTakeAfterChange(
      props: { defaultValue: number; step: number },
      change: { min?: number; max?: number; step?: number },
      thumb: string[],
    ) {
      const fixtureProps = shallowRef<typeof props & typeof change>(props);
      const { container } = await render(() => <SliderThumbHydration {...fixtureProps.value} />);
      fixtureProps.value = { ...props, ...change };
      await flushMicrotasks();
      const events = recordInputEvents(container);
      expect(readThumbs(container)).toEqual([thumb]);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(readThumbs(container)).toEqual([thumb]);
      expect(within(container).getByTestId('changes').textContent).toBe('');
      expect(events).toEqual([]);
    }

    it.each([
      {
        name: 'min',
        props: { defaultValue: 30, step: 10 },
        change: { min: 5 },
        thumb: ['35', '30'],
      },
      {
        name: 'max',
        props: { defaultValue: 95, step: 10 },
        change: { max: 95 },
        thumb: ['90', '95'],
      },
    ])(
      'keeps the value at a `pageshow` event after a change of $name',
      async ({ props, change, thumb }) => {
        await expectNoTakeAfterChange(props, change, thumb);
      },
    );

    it.runIf(stepMovesRangeValue)(
      'keeps the value at a `pageshow` event after a change of the step',
      async () => {
        await expectNoTakeAfterChange({ defaultValue: 33, step: 1 }, { step: 10 }, ['30', '33']);
      },
    );

    it.runIf(!stepMovesRangeValue)(
      'keeps the value at a `pageshow` event after a change of the step that the input keeps',
      async () => {
        await expectNoTakeAfterChange({ defaultValue: 33, step: 1 }, { step: 10 }, ['33', '33']);
      },
    );

    it('keeps a value off the step that a key gives at a `pageshow` event', async () => {
      const { container } = await render(
        <SliderThumbHydration defaultValue={30} max={95} step={10} />,
      );
      const slider = screen.getByRole<HTMLInputElement>('slider');
      slider.focus();
      await fireEvent.keyDown(slider, { key: 'End' });
      await flushMicrotasks();
      const events = recordInputEvents(container);
      expect(readThumbs(container)).toEqual([['90', '95']]);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(readThumbs(container)).toEqual([['90', '95']]);
      expect(within(container).getByTestId('changes').textContent).toBe('95 (keyboard)');
      expect(events).toEqual([]);
    });

    it('sends no event at a `pageshow` event after a change that a listener cancels', async () => {
      const onValueChange = vi.fn((_value: unknown, details: { cancel: () => void }) => {
        details.cancel();
      });
      const { container } = await render(
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
      const events = recordInputEvents(container);
      expect(slider.value).toBe('30');

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(events).toEqual([]);
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        name: 'a controlled range',
        props: { defaultValue: [25, 75], controlled: true },
        written: ['35', '65'],
        result: '35,65',
      },
      {
        name: 'a range',
        props: { defaultValue: [25, 75] },
        written: ['35', '65'],
        result: '35,65',
      },
      {
        name: 'a range that moves up past its end',
        props: { defaultValue: [20, 80] },
        written: ['85', '95'],
        result: '85,95',
      },
      {
        name: 'a controlled range that moves down',
        props: { defaultValue: [20, 80], controlled: true },
        written: ['5', '15'],
        result: '5,15',
      },
      {
        name: 'a range with a minimum distance',
        props: { defaultValue: [20, 80], minStepsBetweenValues: 10 },
        written: ['75', '95'],
        result: '75,95',
      },
      {
        name: 'a range written in the wrong order',
        props: { defaultValue: [20, 80] },
        written: ['95', '85'],
        result: '85,95',
      },
    ])(
      'takes each changed thumb of $name at a `pageshow` event in one change',
      async ({ props, written, result }) => {
        const { container } = await render(<SliderThumbHydration {...props} />);
        const fixture = within(container);
        const events = recordInputEvents(container);
        writeInputs(container, written);

        window.dispatchEvent(new PageTransitionEvent('pageshow'));
        await flushMicrotasks();

        expect(fixture.getByTestId('model').textContent).toBe(
          props.controlled ? result : String(props.defaultValue),
        );
        expect(fixture.getByTestId('changes').textContent).toBe(`${result} (input-change)`);
        expect(readThumbs(container)).toEqual(result.split(',').map((value) => [value, value]));
        expect(events).toEqual(['input']);
      },
    );

    it('keeps the second thumb when the take of the first thumb comes in its own task', async () => {
      const { container } = await render(<SliderThumbHydration defaultValue={[25, 75]} />);
      const inputs = writeInputs(container, ['35', '65']);

      // A browser runs the microtasks after each listener of `pageshow`. The take of the first
      // thumb thus renders the second thumb before the listener of the second thumb runs.
      inputs[0]!.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
      await flushMicrotasks();
      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(within(container).getByTestId('changes').textContent).toBe('35,65 (input-change)');
      expect(readThumbs(container)).toEqual([
        ['35', '35'],
        ['65', '65'],
      ]);
    });

    it('puts each input back when a listener cancels the restore', async () => {
      const onValueChange = vi.fn((_value: unknown, details: { cancel: () => void }) => {
        details.cancel();
      });
      const { container } = await render(
        <Slider.Root defaultValue={[25, 75]} onValueChange={onValueChange}>
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );
      writeInputs(container, ['35', '65']);
      expect(readThumbs(container)).toEqual([
        ['35', '25'],
        ['65', '75'],
      ]);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(readThumbs(container)).toEqual([
        ['25', '25'],
        ['75', '75'],
      ]);
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.lastCall?.[0]).toEqual([35, 65]);
    });

    it('refuses values that a program wrote closer than the minimum distance', async () => {
      const { container } = await render(
        <SliderThumbHydration defaultValue={[20, 80]} minStepsBetweenValues={10} />,
      );
      writeInputs(container, ['50', '55']);

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(within(container).getByTestId('changes').textContent).toBe('');
      expect(readThumbs(container)).toEqual([
        ['20', '20'],
        ['80', '80'],
      ]);
    });

    it('keeps the value of a key between `min` and `max` when it also takes another thumb', async () => {
      const onValueChange = vi.fn();
      const { container } = await render(
        <Slider.Root defaultValue={[0, 5]} minStepsBetweenValues={10} onValueChange={onValueChange}>
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );
      const [input] = container.querySelectorAll<HTMLInputElement>('input[type="range"]');
      input!.focus();
      await flushMicrotasks();
      // The render of the focus writes the state of each thumb to its input.
      writeInputs(container, ['0', '50']);

      // End gives the first thumb the old value of its neighbour minus the minimum distance: -5.
      await fireEvent.keyDown(input!, { key: 'End' });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.lastCall?.[0]).toEqual([0, 50]);
    });

    it('takes a value that the browser restores into a thumb whose value is off the step', async () => {
      const { container } = await render(
        <SliderThumbHydration defaultValue={33} step={10} controlled />,
      );
      const fixture = within(container);
      const events = recordInputEvents(container);
      const input = container.querySelector<HTMLInputElement>('input[type="range"]')!;
      input.value = '70';

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(fixture.getByTestId('model').textContent).toBe('70');
      expect(fixture.getByTestId('changes').textContent).toBe('70 (input-change)');
      expect(input.value).toBe('70');
      expect(events).toEqual(['input']);
    });

    it('keeps the value of a thumb through a render of its input only', async () => {
      mockPageBeforeLoad();
      const locale = shallowRef('en-US');
      const { container } = await render(() => (
        <FormRestoreRender family="slider" revision={0} locale={locale.value} />
      ));
      await flushMicrotasks();
      const recorded = recordInputEvents(container);
      const input = container.querySelector<HTMLInputElement>('input[name="volume"]')!;
      input.value = '70';

      locale.value = 'de-DE';
      await flushMicrotasks();
      expect(input).toHaveValue('70');

      window.dispatchEvent(new PageTransitionEvent('pageshow'));
      await flushMicrotasks();

      expect(within(container).getByTestId('changes').textContent).toBe('70 (input-change)');
      expect(recorded).toEqual(['input']);
    });
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
