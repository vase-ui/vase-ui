import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { PropType, VNode } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
} from '#test-utils';

type FieldRootInstance = InstanceType<typeof Field.Root>;
type FieldControlInstance = InstanceType<typeof Field.Control>;

describe('<Field.Root />', () => {
  const { render } = createRenderer();

  const SwappableField = defineComponent({
    inheritAttrs: false,
    props: {
      firstControl: { type: Object as PropType<VNode>, required: true },
      secondControl: { type: Object as PropType<VNode>, required: true },
    },
    setup(props, { attrs }) {
      const swapped = shallowRef(false);
      return () => (
        <div>
          <Field.Root {...attrs}>
            {swapped.value ? props.secondControl : props.firstControl}
          </Field.Root>
          <button
            type="button"
            onClick={() => {
              swapped.value = true;
            }}
          >
            swap
          </button>
        </div>
      );
    },
  });

  describeConformance(<Field.Root />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('prop: disabled', () => {
    it('keeps a disabled field with form errors marked invalid', async () => {
      await render(
        <Form errors={{ name: 'Server error' }}>
          <Field.Root name="name" disabled>
            <Field.Control data-testid="control" />
          </Field.Root>
        </Form>,
      );

      const control = screen.getByTestId('control');

      expect(control).toHaveAttribute('data-invalid', '');
      // It does not participate in native constraint validation.
      expect(control).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('prop: validate', () => {
    it('accepts synchronous and async validators with no return value', async () => {
      await render(
        <>
          <Field.Root data-testid="sync" validate={() => {}} />
          <Field.Root data-testid="async" validate={async () => {}} />
        </>,
      );

      expect(screen.getByTestId('sync')).toBeInTheDocument();
      expect(screen.getByTestId('async')).toBeInTheDocument();
    });

    it('unmounted fields are excluded from the validate fn', async () => {
      const validateSpy = vi.fn();
      const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

      const App = defineComponent(() => {
        const checked = shallowRef(true);

        return () => (
          <Form onSubmit={onSubmit}>
            <input
              type="checkbox"
              checked={checked.value}
              onChange={() => {
                checked.value = !checked.value;
              }}
            />
            {checked.value && (
              <Field.Root name="input1">
                <Field.Control defaultValue="one" />
              </Field.Root>
            )}
            <Field.Root name="input2" validate={validateSpy}>
              <Field.Control defaultValue="two" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        );
      });
      await render(<App />);

      await fireEvent.click(screen.getByText('submit'));

      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.calls[0][1]).toEqual({
        input1: 'one',
        input2: 'two',
      });

      await fireEvent.click(screen.getByRole('checkbox'));
      await fireEvent.click(screen.getByText('submit'));

      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[1]).toEqual({
        input2: 'two',
      });
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });

    it('uses the Field.Control name for form submission and form validation values', async () => {
      const handleSubmit = vi.fn();
      const validate = vi.fn((_value: unknown, _formValues: Form.Values) => null);

      await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root>
            <Field.Control name="email" defaultValue="one@example.com" />
          </Field.Root>
          <Field.Root name="confirmEmail" validate={validate}>
            <Field.Control defaultValue="one@example.com" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      await fireEvent.click(screen.getByText('submit'));

      expect(validate.mock.lastCall?.[1]).toEqual({
        email: 'one@example.com',
        confirmEmail: 'one@example.com',
      });
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({
        email: 'one@example.com',
        confirmEmail: 'one@example.com',
      });
    });

    it('updates the Field.Control name fallback when the name changes', async () => {
      const handleSubmit = vi.fn();

      const App = defineComponent(() => {
        const name = shallowRef<string | undefined>('email');

        return () => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root>
              <Field.Control name={name.value} defaultValue="one@example.com" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                name.value = 'alternateEmail';
              }}
            >
              Change name
            </button>
            <button
              type="button"
              onClick={() => {
                name.value = undefined;
              }}
            >
              Clear name
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      });

      await render(<App />);

      await fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ email: 'one@example.com' });

      await fireEvent.click(screen.getByText('Change name'));
      await fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({
        alternateEmail: 'one@example.com',
      });

      await fireEvent.click(screen.getByText('Clear name'));
      await fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
    });
  });

  describe('prop: validationMode', () => {
    describe('onBlur', () => {
      it('should not mark invalid if `valueMissing` is the only error and not yet dirtied', async () => {
        await render(
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>,
        );

        const control = screen.getByTestId('control');

        await fireEvent.focusIn(control);
        await fireEvent.focusOut(control);

        expect(control).not.toHaveAttribute('data-invalid');
        expect(control).not.toHaveAttribute('aria-invalid');
      });

      it('should mark invalid if `valueMissing` is the only error and dirtied', async () => {
        await render(
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>,
        );

        const control = screen.getByTestId('control');

        await fireEvent.focusIn(control);
        await fireEvent.input(control, { target: { value: 'a' } });
        await fireEvent.input(control, { target: { value: '' } });
        await fireEvent.focusOut(control);

        expect(control).toHaveAttribute('data-invalid', '');
        expect(control).toHaveAttribute('aria-invalid', 'true');
      });

      describe('computed validity state', () => {
        it('should not mark field as invalid for valueMissing if not dirty', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control data-testid="control" required />
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          await fireEvent.focusIn(control);
          await fireEvent.focusOut(control);

          expect(control).not.toHaveAttribute('data-invalid');
          expect(control).not.toHaveAttribute('aria-invalid');
        });

        it('should mark field as invalid for valueMissing if dirty', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control data-testid="control" required />
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          // Mark as touched and dirtied
          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: 'a' } });
          await fireEvent.input(control, { target: { value: '' } });
          await fireEvent.focusOut(control);

          // valueMissing is true, and markedDirtyRef is true, so valid should be false
          expect(control).toHaveAttribute('data-invalid', '');
          expect(control).toHaveAttribute('aria-invalid', 'true');
        });

        it('should mark field as invalid for other errors (e.g., typeMismatch) even if not dirty', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control data-testid="control" type="email" defaultValue="not_an_email@" />
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          // Mark as touched but not dirty
          await fireEvent.focusIn(control);
          await fireEvent.focusOut(control);

          // typeMismatch is true, so valid should be false regardless of dirty state
          expect(control).toHaveAttribute('data-invalid', '');
          expect(control).toHaveAttribute('aria-invalid', 'true');
        });
      });
    });
  });

  describe('custom validity ownership', () => {
    it('clears its own message on an input that became disabled', async () => {
      let root = null as FieldRootInstance | null;

      const App = defineComponent(() => {
        const disabled = shallowRef(false);
        const failing = shallowRef(true);

        return () => (
          <div>
            <Field.Root
              ref={(instance) => {
                root = instance as FieldRootInstance | null;
              }}
              validate={() => (failing.value ? 'custom error' : null)}
            >
              <Field.Control data-testid="control" disabled={disabled.value} />
            </Field.Root>
            <button type="button" onClick={() => root?.validate()}>
              validate
            </button>
            <button
              type="button"
              onClick={() => {
                disabled.value = !disabled.value;
              }}
            >
              toggle disabled
            </button>
            <button
              type="button"
              onClick={() => {
                failing.value = false;
              }}
            >
              pass
            </button>
          </div>
        );
      });

      await render(<App />);

      const control = screen.getByTestId<HTMLInputElement>('control');

      await fireEvent.click(screen.getByText('validate'));

      expect(control.validationMessage).toBe('custom error');

      await fireEvent.click(screen.getByText('toggle disabled'));
      await fireEvent.click(screen.getByText('pass'));
      await fireEvent.click(screen.getByText('validate'));
      await fireEvent.click(screen.getByText('toggle disabled'));

      expect(control.validationMessage).toBe('');
    });

    it('does not adopt a native message as the message it displaced', async () => {
      await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => (value === 'bad' ? 'custom error' : null)}
        >
          <Field.Control data-testid="control" type="email" />
        </Field.Root>,
      );

      const control = screen.getByTestId<HTMLInputElement>('control');

      await fireEvent.input(control, { target: { value: 'bad' } });
      expect(control.validationMessage).toBe('custom error');

      await fireEvent.input(control, { target: { value: 'a@b.co' } });

      expect(control.validity.customError).toBe(false);
      expect(control.validationMessage).toBe('');
    });
  });

  describe('style hooks', () => {
    describe('control remount', () => {
      it('keeps the original baseline when a controlled control remounts', async () => {
        const App = defineComponent(() => {
          const value = shallowRef('a');
          const mounted = shallowRef(true);
          return () => (
            <div>
              <Field.Root data-testid="root">
                {mounted.value && (
                  <Field.Control
                    data-testid="control"
                    value={value.value}
                    onValueChange={(nextValue) => {
                      value.value = nextValue;
                    }}
                  />
                )}
              </Field.Root>
              <button
                type="button"
                onClick={() => {
                  mounted.value = !mounted.value;
                }}
              >
                toggle
              </button>
            </div>
          );
        });

        await render(<App />);
        const root = screen.getByTestId('root');

        await fireEvent.input(screen.getByTestId('control'), { target: { value: 'b' } });
        expect(root).toHaveAttribute('data-dirty', '');

        await fireEvent.click(screen.getByText('toggle'));
        await fireEvent.click(screen.getByText('toggle'));

        expect(root).toHaveAttribute('data-dirty', '');

        await fireEvent.input(screen.getByTestId('control'), { target: { value: 'a' } });
        expect(root).not.toHaveAttribute('data-dirty');
      });

      it('keeps the field baseline when the control is swapped', async () => {
        await render(
          <SwappableField
            data-testid="root"
            firstControl={<Field.Control key="a" defaultValue="a" />}
            secondControl={<Field.Control key="b" data-testid="control" defaultValue="x" />}
          />,
        );
        const root = screen.getByTestId('root');

        await fireEvent.click(screen.getByText('swap'));
        const control = screen.getByTestId('control');

        await fireEvent.input(control, { target: { value: 'y' } });
        expect(root).toHaveAttribute('data-dirty', '');

        // The baseline is still the field's original value, not the swapped-in control's default.
        await fireEvent.input(control, { target: { value: 'a' } });
        expect(root).not.toHaveAttribute('data-dirty');
      });
    });

    describe('filled', () => {
      it('changes [data-filled] when the value is changed externally', async () => {
        const App = defineComponent(() => {
          const value = shallowRef('');
          return () => (
            <div>
              <Field.Root>
                <Field.Control
                  value={value.value}
                  onInput={(event) => {
                    value.value = (event.target as HTMLInputElement).value;
                  }}
                />
              </Field.Root>
              <button
                onClick={() => {
                  value.value = 'test';
                }}
              >
                change
              </button>
              <button
                onClick={() => {
                  value.value = '';
                }}
              >
                reset
              </button>
            </div>
          );
        });

        const { user } = await render(<App />);

        expect(screen.getByRole('textbox')).not.toHaveAttribute('data-filled', '');

        await user.click(screen.getByRole('button', { name: 'change' }));
        expect(screen.getByRole('textbox')).toHaveAttribute('data-filled', '');

        await user.click(screen.getByRole('button', { name: 'reset' }));
        expect(screen.getByRole('textbox')).not.toHaveAttribute('data-filled', '');
      });
    });
  });

  describe('defaultValue behavior', () => {
    it('should not reset to defaultValue when input value is programmatically changed and then focused', async () => {
      let control = null as FieldControlInstance | null;

      await render(() => (
        <Field.Root>
          <Field.Control
            ref={(instance) => {
              control = instance as FieldControlInstance | null;
            }}
            defaultValue="foo"
            data-testid="input"
          />
        </Field.Root>
      ));

      const input = screen.getByTestId('input') as HTMLInputElement;

      expect(input.value).toBe('foo');

      if (control?.element) {
        (control.element as HTMLInputElement).value = '';
      }

      expect(input.value).toBe('');

      await fireEvent.focusIn(input);

      expect(input.value).toBe('');
    });

    it('should not reset to defaultValue when input value is programmatically changed to non-empty value and then focused', async () => {
      let control = null as FieldControlInstance | null;

      await render(() => (
        <Field.Root>
          <Field.Control
            ref={(instance) => {
              control = instance as FieldControlInstance | null;
            }}
            defaultValue="foo"
            data-testid="input"
          />
        </Field.Root>
      ));

      const input = screen.getByTestId('input') as HTMLInputElement;

      expect(input.value).toBe('foo');

      if (control?.element) {
        (control.element as HTMLInputElement).value = 'abc';
      }

      expect(input.value).toBe('abc');

      await fireEvent.focusIn(input);

      expect(input.value).toBe('abc');
    });
  });

  describe('prop: dirty', () => {
    it('does not update controlled dirty state from user input', async () => {
      await render(
        <Field.Root data-testid="root" dirty={false}>
          <Field.Control />
        </Field.Root>,
      );

      await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'changed' } });

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-dirty');
    });
  });

  describe('prop: touched', () => {
    it('does not update controlled touched state on blur', async () => {
      await render(
        <Field.Root data-testid="root" touched={false}>
          <Field.Control />
        </Field.Root>,
      );

      await fireEvent.focusIn(screen.getByRole('textbox'));
      await fireEvent.focusOut(screen.getByRole('textbox'));

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-touched');
    });
  });

  describe('exposed validate method', () => {
    it('validates the control when the method of a template ref is called', async () => {
      let root = null as FieldRootInstance | null;

      await render(() => (
        <Field.Root
          ref={(instance) => {
            root = instance as FieldRootInstance | null;
          }}
        >
          <Field.Control data-testid="control" required />
        </Field.Root>
      ));

      const control = screen.getByTestId('control');
      expect(control).not.toHaveAttribute('aria-invalid');

      root!.validate();
      await flushMicrotasks();

      expect(control).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('form context', () => {
    it('is valid, and not neutral, after the user types over the error of a form', async () => {
      await render(
        <Form errors={{ name: 'Server error' }}>
          <Field.Root name="name" data-testid="root">
            <Field.Control data-testid="control" />
          </Field.Root>
        </Form>,
      );

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-invalid', '');

      await fireEvent.input(screen.getByTestId('control'), { target: { value: 'a' } });

      expect(root).toHaveAttribute('data-valid', '');
      expect(root).not.toHaveAttribute('data-invalid');
    });

    it('takes the validation mode of the form when it has no mode of its own', async () => {
      const validate = vi.fn(() => null);

      await render(
        <Form validationMode="onChange">
          <Field.Root name="name" validate={validate}>
            <Field.Control data-testid="control" />
          </Field.Root>
        </Form>,
      );

      await fireEvent.input(screen.getByTestId('control'), { target: { value: 'a' } });

      expect(validate).toHaveBeenCalledTimes(1);
    });
  });
});
