import { expect, describe, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import type { CDPSession } from '@vitest/browser-playwright';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  waitFor,
  within,
} from '#test-utils';
import { platform } from '../../common/platform';
import { ARROW_RIGHT } from '../../internals/composite/composite';
import * as Slider from '../index.parts';
import SliderRootHydration from './SliderRootHydration.test.vue';

const isBlink = platform.engine.blink;

const USD_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'USD',
};

describe('<Slider.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Root defaultValue={50} />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('hydration', () => {
    it('hydrates a root that names a label that does not exist, and the root then names none', async () => {
      const props = { id: 'volume', defaultValue: 30 };
      const serverHtml = await renderOnServer(
        'src/slider/root/SliderRootHydration.test.vue',
        props,
      );

      // A server cannot know that no label comes, so the root names the id that a label would have.
      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(
        template.content.querySelector('[role="group"]')?.getAttribute('aria-labelledby'),
      ).toBe('volume-label');

      const { container } = await hydrate(SliderRootHydration, { serverHtml, props });

      expect(within(container).getByRole('group')).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('prop: onValueCommitted', () => {
    // Real touch input, so the browser decides the pointer and compatibility touch event order.
    it.skipIf(isJSDOM || !isBlink)('commits a real touch track tap', async () => {
      const { cdp } = await import('vitest/browser');
      const handleValueCommitted = vi.fn();

      await render(
        <Slider.Root defaultValue={0} onValueCommitted={handleValueCommitted}>
          <Slider.Control data-testid="control" style={{ width: '200px', height: '20px' }}>
            <Slider.Thumb style={{ width: '10px', height: '10px' }} />
          </Slider.Control>
        </Slider.Root>,
      );

      const rect = screen.getByTestId('control').getBoundingClientRect();
      // The tester renders inside a scaled iframe, and CDP takes top-level page coordinates.
      const frameRect = window.frameElement?.getBoundingClientRect() ?? new DOMRect();
      const scale = frameRect.width / window.innerWidth || 1;
      const touchPoints = [
        {
          x: frameRect.left + (rect.left + rect.width / 2) * scale,
          y: frameRect.top + (rect.top + rect.height / 2) * scale,
        },
      ];

      const session = cdp() as CDPSession;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

      await waitFor(() => {
        expect(handleValueCommitted.mock.calls.length).toBe(1);
      });
      expect(handleValueCommitted.mock.calls[0][0]).toBe(50);
    });

    it('does not commit a canceled change', async () => {
      const handleValueChange = vi.fn((_value, details) => details.cancel());
      const handleValueCommitted = vi.fn();

      await render(
        <Slider.Root
          defaultValue={50}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      slider.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(slider, { key: ARROW_RIGHT });

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    it('does not commit when keyboard interaction leaves the value unchanged', async () => {
      const handleValueChange = vi.fn();
      const handleValueCommitted = vi.fn();

      await render(
        <Slider.Root
          defaultValue={100}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      slider.focus();
      await flushMicrotasks();

      await fireEvent.keyDown(slider, { key: ARROW_RIGHT });

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('Form', () => {
    describe.skipIf(isJSDOM)('form submission', () => {
      it('should include the slider value', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget as HTMLFormElement);
          expect(formData.get('slider')).toBe('25');
        });

        await render(
          <Form onSubmit={handleSubmit}>
            <Field.Root name="slider">
              <Slider.Root defaultValue={25} format={USD_NUMBER_FORMAT}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const submit = screen.getByRole('button');
        await fireEvent.click(submit);

        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('should include range slider value', async () => {
        const handleSubmit = vi.fn((event: Event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget as HTMLFormElement);
          expect(formData.getAll('slider')).toEqual(['25', '50']);
        });

        await render(
          <Form onSubmit={handleSubmit}>
            <Field.Root name="slider">
              <Slider.Root defaultValue={[25, 50]} format={USD_NUMBER_FORMAT}>
                <Slider.Control>
                  <Slider.Thumb />
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const submit = screen.getByRole('button');
        await fireEvent.click(submit);

        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('submits clamped range slider values to onFormSubmit', async () => {
        const handleSubmit = vi.fn();

        await render(
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="slider">
              <Slider.Root defaultValue={[19, 41]} min={20} max={40}>
                <Slider.Control>
                  <Slider.Thumb />
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const submit = screen.getByRole('button');
        await fireEvent.click(submit);

        expect(handleSubmit).toHaveBeenCalledWith(
          { slider: [20, 40] },
          expect.objectContaining({ reason: 'none' }),
        );
      });

      it('submits a clamped single-thumb slider value to onFormSubmit', async () => {
        const handleSubmit = vi.fn();

        await render(
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="slider">
              <Slider.Root defaultValue={5} min={20} max={40}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const submit = screen.getByRole('button');
        await fireEvent.click(submit);

        expect(handleSubmit).toHaveBeenCalledWith(
          { slider: 20 },
          expect.objectContaining({ reason: 'none' }),
        );
      });

      it('submits to an external form when `form` is provided', async () => {
        let submitValue: FormDataEntryValue | null = null;

        await render(
          <>
            <form
              id="external-form"
              onSubmit={(event: Event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget as HTMLFormElement);
                submitValue = formData.get('slider');
              }}
            >
              <button type="submit">Submit</button>
            </form>
            <Slider.Root name="slider" form="external-form" defaultValue={25}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </>,
        );

        await fireEvent.click(screen.getByRole('button'));

        expect(submitValue).toBe('25');
      });
    });
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-disabled', '');
    });

    it('should receive name prop from Field.Root', async () => {
      await render(
        <Field.Root name="field-slider">
          <Slider.Root>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      expect(screen.getByRole('slider')).toHaveAttribute('name', 'field-slider');
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      await fireEvent.focusIn(input);
      await fireEvent.focusOut(input);

      expect(root).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      expect(root).not.toHaveAttribute('data-dirty');

      await fireEvent.change(input, { target: { value: 'value' } });

      expect(root).toHaveAttribute('data-dirty', '');
    });

    it('[data-dirty] with a range value', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="root" defaultValue={[20, 40]}>
            <Slider.Control>
              <Slider.Thumb index={0} />
              <Slider.Thumb index={1} />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      const [, input2] = screen.getAllByRole('slider');

      expect(root).not.toHaveAttribute('data-dirty');

      await fireEvent.change(input2, { target: { value: '50' } });

      expect(root).toHaveAttribute('data-dirty', '');

      await fireEvent.change(input2, { target: { value: '40' } });

      expect(root).not.toHaveAttribute('data-dirty');
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>,
      );

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      expect(root).not.toHaveAttribute('data-focused');

      await fireEvent.focusIn(input);

      expect(root).toHaveAttribute('data-focused', '');

      await fireEvent.focusOut(input);

      expect(root).not.toHaveAttribute('data-focused');
    });

    describe('[data-focused] without a blur event', () => {
      function Thumbs(props: {
        firstMounted?: boolean;
        firstDisabled?: boolean;
        rangeValue?: boolean;
      }) {
        const { firstMounted = true, firstDisabled = false, rangeValue = false } = props;
        return (
          <Field.Root data-testid="root">
            <Slider.Root defaultValue={rangeValue ? [20, 40] : 20}>
              <Slider.Control>
                {firstMounted && <Slider.Thumb disabled={firstDisabled} />}
                {rangeValue && <Slider.Thumb />}
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        );
      }

      it('is removed when the focused thumb becomes disabled', async () => {
        const { setProps } = await render(<Thumbs />);

        screen.getByRole('slider').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });

      it('is removed when the focused thumb unmounts', async () => {
        const { setProps } = await render(<Thumbs />);

        screen.getByRole('slider').focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      });

      // A thumb's `blur` deliberately does nothing when focus moves to a sibling thumb, so a thumb
      // that once held focus must not assume it still owns the field's focused state.
      it('is kept when focus moved to a sibling before the first thumb is disabled', async () => {
        const { setProps } = await render(<Thumbs rangeValue />);

        const [first, second] = screen.getAllByRole('slider');

        first.focus();
        await flushMicrotasks();
        second.focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
      });

      it('is kept when a sibling thumb is disabled or unmounted', async () => {
        const { setProps } = await render(<Thumbs rangeValue />);

        screen.getAllByRole('slider')[1].focus();
        await flushMicrotasks();

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstDisabled: true });

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

        await setProps({ firstMounted: false });

        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
      });
    });

    describe('prop: validate', () => {
      it('validationMode=onSubmit', async () => {
        await render(
          <Form>
            <Field.Root validate={(val) => ((val as number) > 90 ? 'error' : null)}>
              <Slider.Root defaultValue={99} data-testid="root">
                <Slider.Control>
                  <Slider.Thumb data-testid="thumb" />
                </Slider.Control>
              </Slider.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const root = screen.getByTestId('root');
        const thumb = screen.getByTestId('thumb');
        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.change(input, { target: { value: '98' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.click(screen.getByText('submit'));
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).not.toBe(null);
        expect(root).toHaveAttribute('data-invalid');
        expect(thumb).toHaveAttribute('data-invalid');

        await fireEvent.change(input, { target: { value: '10' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
        expect(root).not.toHaveAttribute('data-invalid');
        expect(input).not.toHaveAttribute('data-invalid');
        expect(root).toHaveAttribute('data-valid');
        expect(thumb).toHaveAttribute('data-valid');

        await fireEvent.change(input, { target: { value: '94' } });
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).not.toBe(null);

        await fireEvent.change(input, { target: { value: '12' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
      });

      it('moves focus to the range input on invalid submit', async () => {
        await render(
          <Form>
            <Field.Root validate={() => 'error'}>
              <Slider.Root defaultValue={50}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const input = screen.getByRole('slider');
        expect(input).not.toHaveFocus();

        await fireEvent.click(screen.getByText('submit'));

        // Slider registers the range input as the field control, so invalid
        // submits focus the native input instead of the non-focusable wrapper.
        expect(input).toHaveFocus();
      });

      it('validationMode=onBlur', async () => {
        await render(
          <Field.Root
            validationMode="onBlur"
            validate={(value) => ((value as number) > 1 ? 'error' : null)}
          >
            <Slider.Root>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');

        await fireEvent.change(input, { target: { value: '2' } });
        expect(input).not.toHaveAttribute('aria-invalid');
        await fireEvent.focusOut(input);
        await flushMicrotasks();
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('validationMode=onBlur preserves single-element array values', async () => {
        const validate = vi.fn<(value: unknown) => null>(() => null);

        await render(
          <Field.Root validationMode="onBlur" validate={validate}>
            <Slider.Root defaultValue={[25]}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        await fireEvent.focusOut(screen.getByRole('slider'));
        await flushMicrotasks();

        expect(validate.mock.calls[0][0]).toEqual([25]);
      });

      it('validationMode=onChange', async () => {
        await render(
          <Field.Root
            validationMode="onChange"
            validate={(value) => (Number(value) === 1 ? 'error' : null)}
          >
            <Slider.Root defaultValue={0}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');

        await fireEvent.change(input, { target: { value: '1' } });
        await flushMicrotasks();
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('validates once when changed by the user', async () => {
        const validate = vi.fn();

        const { user } = await render(
          <Field.Root validationMode="onChange" validate={validate}>
            <Slider.Root defaultValue={0}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        await user.keyboard('[Tab]');
        expect(screen.getByRole('slider')).toHaveFocus();

        await user.keyboard(`[${ARROW_RIGHT}]`);
        await flushMicrotasks();

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.lastCall?.[0]).toBe(1);
      });

      it('validates once with an array value for range sliders when changed by the user', async () => {
        const validate = vi.fn();

        const { user } = await render(
          <Field.Root validationMode="onChange" validate={validate}>
            <Slider.Root defaultValue={[0, 5]}>
              <Slider.Control>
                <Slider.Thumb index={0} />
                <Slider.Thumb index={1} />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>,
        );

        await user.keyboard('[Tab]');
        expect(screen.getAllByRole('slider')[0]).toHaveFocus();

        await user.keyboard(`[${ARROW_RIGHT}]`);
        await flushMicrotasks();

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.lastCall?.[0]).toEqual([1, 5]);
      });

      it('revalidates when the controlled value changes externally', async () => {
        const validateSpy = vi.fn((value: unknown) => (Number(value) === 5 ? 'error' : null));
        const value = shallowRef(0);

        await render(() => (
          <>
            <Field.Root validationMode="onChange" validate={validateSpy} name="volume">
              <Slider.Root
                value={value.value}
                onValueChange={(next) => {
                  value.value = next;
                }}
              >
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                value.value = 5;
              }}
            >
              Set externally
            </button>
          </>
        ));

        const slider = screen.getByRole('slider');
        const toggle = screen.getByText('Set externally');

        expect(slider).not.toHaveAttribute('aria-invalid');
        const initialCallCount = validateSpy.mock.calls.length;

        await fireEvent.click(toggle);
        await flushMicrotasks();

        expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
        expect(validateSpy.mock.lastCall?.[0]).toBe(5);
        expect(slider).toHaveAttribute('aria-invalid', 'true');
      });

      it('receives an array value for range sliders', async () => {
        const validateSpy = vi.fn();
        const onSubmit = vi.fn((event: Event) => event.preventDefault());
        await render(
          <Form onSubmit={onSubmit}>
            <Field.Root validate={validateSpy}>
              <Slider.Root defaultValue={[5, 12]}>
                <Slider.Control>
                  <Slider.Thumb index={0} />
                  <Slider.Thumb index={1} />
                </Slider.Control>
              </Slider.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        await fireEvent.click(screen.getByText('submit'));
        expect(validateSpy.mock.calls.length).toBe(1);
        expect(validateSpy.mock.calls[0][0]).toEqual([5, 12]);
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });

    it('Field.Label', async () => {
      await render(
        <Field.Root>
          <Slider.Root>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
          <Field.Label data-testid="label" />
        </Field.Root>,
      );

      expect(screen.getByRole('slider')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('does not set fallback aria-labelledby when no label is rendered', async () => {
      await render(
        <Slider.Root>
          <Slider.Control>
            <Slider.Thumb aria-label="Volume" />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(screen.getByRole('slider')).not.toHaveAttribute('aria-labelledby');
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Slider.Root data-testid="slider" aria-describedby="external-description">
            <Slider.Control />
          </Slider.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByTestId('slider')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });
});
