import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, ref, shallowRef, Teleport } from 'vue';
import type { FormHTMLAttributes } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Form } from '@vase-ui/vue/form';
import { Switch } from '@vase-ui/vue/switch';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
  within,
} from '#test-utils';
import FieldControlPart from '../../test/fixtures/FieldControlPart.vue';
import FieldScope from '../../test/fixtures/FieldScope.vue';
import { useRegisterFieldControl } from '../internals/field-register-control';
import { useFormContext } from '../internals/form-context';
import type { Errors, FormContext } from '../internals/form-context';
import FormHydration from './FormHydration.test.vue';

interface TestFieldProps {
  id: string;
  name?: string | undefined;
  value?: string | undefined;
  disabled?: boolean | undefined;
  onValidationCommit?: (() => void) | undefined;
}

// A field of the test fixtures. The root has the test id `<id>-field`, and the control has `<id>`.
// The form lists the field only when its control has an `id`. The field is invalid after a
// `validate()` when the value of its control is empty.
const TestField = defineComponent(
  (props: TestFieldProps) => () => (
    <FieldScope
      name={props.name}
      data-testid={`${props.id}-field`}
      onValidationCommit={props.onValidationCommit}
    >
      <FieldControlPart
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        data-testid={props.id}
      />
    </FieldScope>
  ),
  { props: ['id', 'name', 'value', 'disabled', 'onValidationCommit'] },
);

// A component that gives its test the context of the nearest form.
function defineFormContextProbe() {
  let context: FormContext | undefined;
  const Probe = defineComponent(() => {
    context = useFormContext();
    return () => null;
  });
  return { Probe, getContext: () => context as FormContext };
}

// A listener on an ancestor of the form runs after the listeners of the form. It records the event
// and whether the default was already prevented, and then it prevents the default. Firefox loads
// the page again for a `submit` event that nothing prevents, also when a test dispatches it.
function observeSubmit(container: HTMLElement) {
  const observed: { event?: Event; wasPrevented?: boolean } = {};
  container.addEventListener('submit', (event) => {
    observed.event = event;
    observed.wasPrevented = event.defaultPrevented;
    event.preventDefault();
  });
  return observed;
}

function preventDefault(event: Event) {
  event.preventDefault();
}

type FormInstance = { validate: (fieldName?: string) => void; element: HTMLFormElement | null };

describe('<Form />', () => {
  const { render } = createRenderer();

  describeConformance(<Form />, () => ({
    refInstanceof: window.HTMLFormElement,
    render,
  }));

  it('does not submit if there are errors', async () => {
    const onSubmit = vi.fn();

    const { user } = await render(
      <Form onSubmit={onSubmit}>
        <Field.Root>
          <Field.Control required />
          <Field.Error data-testid="error" />
        </Field.Root>
        <button>Submit</button>
      </Form>,
    );

    const submit = screen.getByRole('button');

    await user.click(submit);

    expect(screen.getByTestId('error')).toBeInTheDocument();
    expect(onSubmit.mock.calls.length > 0).toBe(false);
  });

  it('blocks submit and focuses the first invalid field across custom and native validation', async () => {
    const onFormSubmit = vi.fn();
    const select = vi.spyOn(HTMLInputElement.prototype, 'select');

    try {
      const { user } = await render(
        <Form onFormSubmit={onFormSubmit}>
          <Field.Root name="custom" validate={() => 'custom error'}>
            <Field.Control data-testid="custom" />
          </Field.Root>
          <Field.Root name="native">
            <Field.Control data-testid="native" required />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onFormSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('custom')).toHaveFocus();
      expect(select).toHaveBeenCalledTimes(1);
    } finally {
      select.mockRestore();
    }
  });

  it('keeps focusing the first invalid field after a control value changes', async () => {
    const { user } = await render(
      <Form>
        <Field.Root name="a">
          <Checkbox.Root required data-testid="a" />
        </Field.Root>
        <Field.Root name="b">
          <Checkbox.Root required data-testid="b" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>,
    );

    const checkboxA = screen.getByTestId('a');
    const submit = screen.getByRole('button', { name: 'Submit' });

    await user.click(submit);
    expect(checkboxA).toHaveFocus();

    // Toggling the checkbox updates its field control registration.
    await user.click(checkboxA);
    await user.click(checkboxA);

    await user.click(submit);
    expect(checkboxA).toHaveFocus();
  });

  it('keeps the registration-order focus fallback stable across disconnected trees', async () => {
    const firstHost = document.createElement('div');
    const secondHost = document.createElement('div');
    const firstContainer = document.createElement('div');
    const secondContainer = document.createElement('div');
    const firstRoot = firstHost.attachShadow({ mode: 'open' });
    const secondRoot = secondHost.attachShadow({ mode: 'open' });
    firstRoot.append(firstContainer);
    secondRoot.append(secondContainer);
    document.body.append(firstHost, secondHost);

    try {
      const { unmount } = await render(
        <Form>
          <Teleport to={firstContainer}>
            <Field.Root name="a">
              <Checkbox.Root required data-testid="a" />
            </Field.Root>
          </Teleport>
          <Teleport to={secondContainer}>
            <Field.Root name="b">
              <Checkbox.Root required data-testid="b" />
            </Field.Root>
          </Teleport>
          <button type="submit">Submit</button>
        </Form>,
      );

      try {
        const checkboxA = within(firstContainer).getByTestId('a');
        const submit = screen.getByRole('button', { name: 'Submit' });
        const form = submit.closest('form');
        if (!form) {
          throw new Error('Expected submit button to be inside a form');
        }

        await fireEvent.submit(form);
        expect(firstRoot.activeElement).toBe(checkboxA);

        await fireEvent.click(checkboxA);
        await fireEvent.click(checkboxA);
        await fireEvent.submit(form);

        expect(firstRoot.activeElement).toBe(checkboxA);
      } finally {
        unmount();
      }
    } finally {
      firstHost.remove();
      secondHost.remove();
    }
  });

  it('focuses the first invalid field in document order when keyed fields are reordered', async () => {
    const App = defineComponent(() => {
      const names = shallowRef(['a', 'b']);
      return () => (
        <>
          <button
            type="button"
            onClick={() => {
              names.value = ['b', 'a'];
            }}
          >
            Reorder
          </button>
          <Form>
            {names.value.map((name) => (
              <Field.Root key={name} name={name}>
                <Checkbox.Root required data-testid={name} />
              </Field.Root>
            ))}
            <button type="submit">Submit</button>
          </Form>
        </>
      );
    });

    const { user } = await render(<App />);

    // Keyed reorder moves the DOM nodes without remounting, so the internal
    // registration Map keeps the original order while the DOM order flips.
    await user.click(screen.getByRole('button', { name: 'Reorder' }));

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByTestId('b')).toHaveFocus();
  });

  it('submits when a valid async validator is pending', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });
    const validate = vi.fn(() => new Promise<null>(() => {}));

    await render(
      <Form onSubmit={onSubmit}>
        <Field.Root validate={validate}>
          <Field.Control />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>,
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(validate).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('re-runs an onBlur cross-field validator on submit', async () => {
    const onFormSubmit = vi.fn();
    const validate = vi.fn((value: unknown, formValues: Form.Values) =>
      value !== formValues.password ? 'Passwords do not match' : null,
    );

    await render(
      <Form onFormSubmit={onFormSubmit}>
        <Field.Root name="password" validationMode="onBlur">
          <Field.Control data-testid="password" />
        </Field.Root>
        <Field.Root name="confirmPassword" validationMode="onBlur" validate={validate}>
          <Field.Control data-testid="confirm" />
          <Field.Error data-testid="confirm-error" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>,
    );

    const password = screen.getByTestId('password');
    const confirm = screen.getByTestId('confirm');

    await fireEvent.input(password, { target: { value: 'secret' } });
    await fireEvent.input(confirm, { target: { value: 'typo' } });
    await fireEvent.focusOut(confirm);

    expect(validate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('confirm-error')).toHaveTextContent('Passwords do not match');

    await fireEvent.input(password, { target: { value: 'typo' } });
    await fireEvent.focusOut(password);

    await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(validate).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('confirm-error')).toBe(null);
    expect(onFormSubmit).toHaveBeenCalledTimes(1);
  });

  it('retires a stale async validation result on the next submit', async () => {
    const onFormSubmit = vi.fn();
    const validate = vi.fn((value: unknown) =>
      Promise.resolve(value === 'bad' ? 'async error' : null),
    );

    await render(
      <Form onFormSubmit={onFormSubmit}>
        <Field.Root name="field" validationMode="onSubmit" validate={validate}>
          <Field.Control data-testid="control" defaultValue="bad" />
          <Field.Error data-testid="error" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>,
    );

    const control = screen.getByTestId('control');
    const submit = screen.getByRole('button', { name: 'Submit' });

    await fireEvent.click(submit);

    expect(onFormSubmit).toHaveBeenCalledTimes(1);

    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('async error');
    });

    await fireEvent.input(control, { target: { value: 'good' } });
    await fireEvent.click(submit);

    expect(onFormSubmit).toHaveBeenCalledTimes(2);

    expect(screen.queryByTestId('error')).toBe(null);

    await flushMicrotasks();
  });

  it.each([{ validationMode: 'onBlur' as const }, { validationMode: 'onChange' as const }])(
    'blocks submission on a resolved async error in $validationMode mode',
    async ({ validationMode }) => {
      const onFormSubmit = vi.fn();
      const validate = vi.fn((value: unknown) =>
        Promise.resolve(value === 'taken' ? 'Username is taken' : null),
      );

      await render(
        <Form onFormSubmit={onFormSubmit}>
          <Field.Root name="username" validationMode={validationMode} validate={validate}>
            <Field.Control data-testid="control" />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const control = screen.getByTestId('control');

      await fireEvent.input(control, { target: { value: 'taken' } });
      await fireEvent.focusOut(control);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');
      });

      await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onFormSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');

      await flushMicrotasks();
    },
  );

  it('does not submit if an unnamed registered field control is invalid', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });

    const { user } = await render(
      <Form onSubmit={onSubmit}>
        <Field.Root>
          <Switch.Root required />
          <Field.Error data-testid="error" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>,
    );

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('error')).toBeInTheDocument();
  });

  it('clears invalid state for an unnamed registered field control on change', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });

    const { user } = await render(
      <Form onSubmit={onSubmit}>
        <Field.Root>
          <Switch.Root required />
          <Field.Error data-testid="error" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>,
    );

    const submit = screen.getByRole('button', { name: 'Submit' });
    const switchControl = screen.getByRole('switch');

    await user.click(submit);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(switchControl).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('error')).toBeInTheDocument();

    await user.click(switchControl);

    expect(switchControl).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByTestId('error')).toBe(null);

    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('keeps same-name field validity scoped on submit', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });

    const { user } = await render(
      <Form onSubmit={onSubmit}>
        <Field.Root name="shared">
          <Switch.Root required data-testid="first" />
          <Field.Error data-testid="first-error" />
        </Field.Root>
        <Field.Root name="shared">
          <Switch.Root required defaultChecked data-testid="second" />
          <Field.Error data-testid="second-error" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>,
    );

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('first')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('first-error')).toBeInTheDocument();
    expect(screen.getByTestId('second')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByTestId('second-error')).toBe(null);
  });

  it('removes the previous registered field id when another control takes over', async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });

    const { user } = await render(
      <Form onSubmit={onSubmit}>
        <Field.Root>
          <Switch.Root required data-testid="first" />
          <Switch.Root required defaultChecked data-testid="second" />
          <Field.Error data-testid="error" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>,
    );

    const submit = screen.getByRole('button', { name: 'Submit' });

    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('error')).toBe(null);
    expect(screen.getByTestId('first')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByTestId('second')).not.toHaveAttribute('aria-invalid');
  });

  it('unmounted fields should be removed from the form', async () => {
    const submitSpy = vi.fn((event: SubmitEvent) => event.preventDefault());

    const App = defineComponent(() => {
      const checked = shallowRef(true);

      return () => (
        <Form onSubmit={submitSpy}>
          <Field.Root name="name">
            <Field.Control defaultValue="Alice" />
          </Field.Root>

          <input
            type="checkbox"
            checked={checked.value}
            onChange={() => {
              checked.value = !checked.value;
            }}
          />

          {checked.value && (
            <Field.Root name="email">
              <Field.Control defaultValue="" required data-testid="email" />
            </Field.Root>
          )}

          <button>Submit</button>
        </Form>
      );
    });

    const { user } = await render(<App />);

    const submit = screen.getByText('Submit');

    await user.click(submit);
    expect(submitSpy.mock.calls.length).toBe(0);
    expect(screen.getByTestId('email')).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('checkbox'));
    await user.click(submit);
    expect(submitSpy.mock.calls.length).toBe(1);
  });

  it('excludes disabled fieldset fields from validation and onFormSubmit values', async () => {
    const handleSubmit = vi.fn();

    await render(
      <Form onFormSubmit={handleSubmit}>
        <Fieldset.Root disabled>
          <Field.Root name="disabled">
            <Field.Control required data-testid="disabled" />
          </Field.Root>
        </Fieldset.Root>
        <Field.Root name="enabled">
          <Field.Control defaultValue="sent" />
        </Field.Root>
        <button type="submit">Submit</button>
      </Form>,
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({ enabled: 'sent' });
    expect(screen.getByTestId('disabled')).not.toHaveAttribute('aria-invalid');
  });

  it('clears invalid UI when a fieldset field becomes disabled', async () => {
    const handleSubmit = vi.fn();

    const App = defineComponent(() => {
      const disabled = shallowRef(false);

      return () => (
        <Form onFormSubmit={handleSubmit}>
          <Fieldset.Root disabled={disabled.value}>
            <Field.Root name="disabled">
              <Field.Control required data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>
          </Fieldset.Root>
          <button
            type="button"
            onClick={() => {
              disabled.value = true;
            }}
          >
            Disable
          </button>
          <button
            type="button"
            onClick={() => {
              disabled.value = false;
            }}
          >
            Enable
          </button>
          <button type="submit">Submit</button>
        </Form>
      );
    });

    const { user } = await render(<App />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('error')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable' }));

    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('control')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByTestId('error')).toBe(null);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Enable' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('error')).toBeInTheDocument();
  });

  it('clears invalid attributes when a field control becomes disabled', async () => {
    const handleSubmit = vi.fn();

    const App = defineComponent(() => {
      const disabled = shallowRef(false);

      return () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="disabled">
            <Field.Control disabled={disabled.value} required data-testid="control" />
          </Field.Root>
          <button
            type="button"
            onClick={() => {
              disabled.value = true;
            }}
          >
            Disable
          </button>
          <button type="submit">Submit</button>
        </Form>
      );
    });

    const { user } = await render(<App />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: 'Disable' }));

    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('control')).not.toHaveAttribute('aria-invalid');

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
  });

  it('re-registers field controls when they become enabled again', async () => {
    const handleSubmit = vi.fn();

    const App = defineComponent(() => {
      const disabled = shallowRef(false);

      return () => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="control">
            <Field.Control disabled={disabled.value} required data-testid="control" />
          </Field.Root>
          <button
            type="button"
            onClick={() => {
              disabled.value = true;
            }}
          >
            Disable
          </button>
          <button
            type="button"
            onClick={() => {
              disabled.value = false;
            }}
          >
            Enable
          </button>
          <button type="submit">Submit</button>
        </Form>
      );
    });

    const { user } = await render(<App />);
    const submit = screen.getByRole('button', { name: 'Submit' });

    await user.click(submit);

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    await user.click(submit);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Enable' }));
    await user.click(submit);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByTestId('control'), 'sent');
    await user.click(submit);

    expect(handleSubmit).toHaveBeenCalledTimes(2);
    expect(handleSubmit.mock.lastCall?.[0]).toEqual({ control: 'sent' });
  });

  describe('prop: errors', () => {
    it('should mark <Field.Control> as invalid and populate <Field.Error>', async () => {
      await render(
        <Form errors={{ foo: 'bar' }}>
          <Field.Root name="foo">
            <Field.Control />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('bar');
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not mark <Field.Control> as invalid if no error is provided', async () => {
      await render(
        <Form>
          <Field.Root name="foo">
            <Field.Control />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    });

    it('focuses asynchronously replaced external errors and clears only the changed own property', async () => {
      const App = defineComponent(() => {
        const errors = shallowRef<Errors>();

        return () => (
          <Form
            errors={errors.value}
            onFormSubmit={() => {
              const nextErrors = Object.create(null) as Errors;
              nextErrors.first = 'First error';
              nextErrors.second = 'Second error';
              Promise.resolve().then(() => {
                errors.value = nextErrors;
              });
            }}
          >
            <Field.Root name="first">
              <Field.Control data-testid="first" />
              <Field.Error data-testid="first-error" />
            </Field.Root>
            <Field.Root name="second">
              <Field.Control data-testid="second" />
              <Field.Error data-testid="second-error" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<App />);

      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());
      expect(screen.getByTestId('first-error')).toHaveTextContent('First error');
      expect(screen.getByTestId('second-error')).toHaveTextContent('Second error');

      await user.type(screen.getByTestId('first'), 'a');

      expect(screen.queryByTestId('first-error')).toBe(null);
      expect(screen.getByTestId('second-error')).toHaveTextContent('Second error');
    });

    const NameAndAge = defineComponent(() => {
      const errors = shallowRef<Errors>({});

      return () => (
        <Form
          errors={errors.value}
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget as HTMLFormElement);
            const name = formData.get('name') as string;
            const age = formData.get('age') as string;

            errors.value = {
              ...(name === '' && { name: 'Name is required' }),
              ...(age === '' && { age: 'Age is required' }),
            };
          }}
        >
          <Field.Root name="name">
            <Field.Control data-testid="name" />
            <Field.Error data-testid="name-error" />
          </Field.Root>
          <Field.Root name="age">
            <Field.Control data-testid="age" />
            <Field.Error data-testid="age-error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      );
    });

    it('focuses the first invalid field only on submit', async () => {
      const { user } = await render(<NameAndAge />);

      const submit = screen.getByRole('button');
      const name = screen.getByTestId('name');
      const age = screen.getByTestId('age');

      await user.click(submit);

      expect(name).toHaveFocus();

      await fireEvent.input(name, { target: { value: 'John' } });

      expect(age).not.toHaveFocus();

      await user.click(submit);

      expect(age).toHaveFocus();

      await fireEvent.input(age, { target: { value: '42' } });

      await user.click(submit);

      expect(age).not.toHaveFocus();
    });

    it('does not swap focus immediately on change after two submissions', async () => {
      const { user } = await render(<NameAndAge />);

      const submit = screen.getByRole('button');
      const name = screen.getByTestId('name');
      const age = screen.getByTestId('age');

      await user.click(submit);

      expect(name).toHaveFocus();

      await user.click(submit);

      await fireEvent.input(name, { target: { value: 'John' } });

      expect(age).not.toHaveFocus();
    });

    it('removes errors upon change', async () => {
      await render(<NameAndAge />);

      const name = screen.getByTestId('name');
      const age = screen.getByTestId('age');

      await fireEvent.click(screen.getByText('Submit'));

      expect(screen.queryByTestId('name-error')).not.toBe(null);
      expect(screen.queryByTestId('age-error')).not.toBe(null);

      await fireEvent.input(name, { target: { value: 'John' } });
      await fireEvent.input(age, { target: { value: '42' } });
      expect(screen.queryByTestId('name-error')).toBe(null);
      expect(screen.queryByTestId('age-error')).toBe(null);
    });

    it('runs field validation on first change after Form error is set', async () => {
      const validateSpy = vi.fn((value: unknown) => {
        if (value === 'abcd') {
          return 'field error';
        }
        return null;
      });

      const Test = defineComponent(() => {
        const errors = shallowRef<Errors>({});

        return () => (
          <Form
            errors={errors.value}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget as HTMLFormElement);
              const name = formData.get('name') as string;

              if (name === 'abcde') {
                errors.value = { name: 'submit error' };
              } else {
                errors.value = {};
              }
            }}
          >
            <Field.Root name="name" validate={validateSpy}>
              <Field.Control data-testid="name" />
              <Field.Error data-testid="name-error" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      });

      const { user } = await render(<Test />);

      const input = screen.getByTestId('name');
      await user.click(input);
      await user.keyboard('abcde');
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      expect(screen.queryByTestId('name-error')).not.toBe(null);
      expect(screen.getByTestId('name-error')).toHaveTextContent('submit error');

      validateSpy.mockClear();

      await user.click(input);
      // value changes from 'abcde' to 'abcd'
      await user.keyboard('{Backspace}');
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(screen.queryByTestId('name-error')).not.toBe(null);
      expect(screen.getByTestId('name-error')).toHaveTextContent('field error');
    });

    it('runs field validation on change when invalid prop is true and validationMode is onChange', async () => {
      const validateSpy = vi.fn(() => 'field error');

      const { user } = await render(
        <Form errors={{ name: 'server error' }}>
          <Field.Root name="name" invalid validate={validateSpy} validationMode="onChange">
            <Field.Control data-testid="name" />
            <Field.Error data-testid="name-error" />
          </Field.Root>
        </Form>,
      );

      const input = screen.getByTestId('name');
      expect(screen.getByTestId('name-error')).toHaveTextContent('server error');

      await user.click(input);
      await user.keyboard('a');

      expect(validateSpy.mock.calls.length).toBe(1);
      expect(screen.getByTestId('name-error')).toHaveTextContent('field error');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not run field validation on change for onBlur mode when invalid prop is true', async () => {
      const validateSpy = vi.fn(() => 'field error');

      const { user } = await render(
        <Form errors={{ name: 'server error' }}>
          <Field.Root name="name" invalid validate={validateSpy} validationMode="onBlur">
            <Field.Control data-testid="name" />
            <Field.Error data-testid="name-error" />
          </Field.Root>
        </Form>,
      );

      const input = screen.getByTestId('name');
      expect(screen.getByTestId('name-error')).toHaveTextContent('server error');

      await user.click(input);
      await user.keyboard('a');
      expect(validateSpy.mock.calls.length).toBe(0);
      expect(screen.queryByTestId('name-error')).toBe(null);

      await user.tab();
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(screen.getByTestId('name-error')).toHaveTextContent('field error');
    });

    it('removes errors for every field that changes within a single commit', async () => {
      const errors = { a: 'A error', b: 'B error', c: 'C error' };

      const MultiChangeApp = defineComponent(() => {
        const a = shallowRef(false);
        const b = shallowRef(false);
        const c = shallowRef(false);

        return () => (
          <Form errors={errors}>
            <Field.Root name="a">
              <Switch.Root
                checked={a.value}
                onCheckedChange={(checked: boolean) => {
                  a.value = checked;
                }}
              />
              <Field.Error data-testid="a-error" />
            </Field.Root>
            <Field.Root name="b">
              <Switch.Root
                checked={b.value}
                onCheckedChange={(checked: boolean) => {
                  b.value = checked;
                }}
              />
              <Field.Error data-testid="b-error" />
            </Field.Root>
            <Field.Root name="c">
              <Switch.Root
                checked={c.value}
                onCheckedChange={(checked: boolean) => {
                  c.value = checked;
                }}
              />
              <Field.Error data-testid="c-error" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                a.value = true;
                b.value = true;
              }}
            >
              Change both
            </button>
          </Form>
        );
      });

      await render(<MultiChangeApp />);

      expect(screen.queryByTestId('a-error')).not.toBe(null);
      expect(screen.queryByTestId('b-error')).not.toBe(null);
      expect(screen.queryByTestId('c-error')).not.toBe(null);

      await fireEvent.click(screen.getByText('Change both'));

      expect(screen.queryByTestId('a-error')).toBe(null);
      expect(screen.queryByTestId('b-error')).toBe(null);
      expect(screen.queryByTestId('c-error')).not.toBe(null);
    });
  });

  describe('prop: onFormSubmit', () => {
    it('does not run when the form is invalid', async () => {
      const submitSpy = vi.fn();

      await render(
        <Form onFormSubmit={submitSpy}>
          <Field.Root name="username">
            <Field.Control defaultValue="" required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );
      expect(screen.queryByTestId('error')).toBe(null);
      await fireEvent.click(screen.getByText('submit'));
      expect(submitSpy.mock.calls.length).toBe(0);
      expect(screen.queryByTestId('error')).not.toBe(null);
    });
  });

  it('does not submit when invalid prop remains true even if validate returns null', async () => {
    const submitSpy = vi.fn();
    const validateSpy = vi.fn(() => null);

    const { user } = await render(
      <Form onSubmit={submitSpy}>
        <Field.Root name="name" invalid validate={validateSpy} validationMode="onChange">
          <Field.Control data-testid="name" />
          <Field.Error data-testid="name-error" />
        </Field.Root>
        <button type="submit">submit</button>
      </Form>,
    );

    const input = screen.getByTestId('name');
    await user.click(input);
    await user.keyboard('o');

    expect(validateSpy.mock.calls.length).toBe(1);

    await user.click(screen.getByText('submit'));

    expect(submitSpy.mock.calls.length).toBe(0);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  describe('prop: actionsRef', () => {
    it('targets only the current Strict Mode registration after name, id, and control replacement', async () => {
      const initialValidate = vi.fn(() => null);
      const renamedValidate = vi.fn(() => null);
      const replacementValidate = vi.fn(() => null);
      const handle: { form?: FormInstance } = {};

      const App = defineComponent(() => {
        const step = shallowRef(0);

        return () => {
          const visible = step.value !== 2;
          const name = step.value === 0 ? 'initial' : 'current';
          let validate = initialValidate;
          if (step.value === 1) {
            validate = renamedValidate;
          } else if (step.value > 1) {
            validate = replacementValidate;
          }

          return (
            <>
              <Form
                ref={(value) => {
                  handle.form = value as FormInstance | null as FormInstance;
                }}
              >
                {visible && (
                  <Field.Root key={step.value} name={name} validate={validate}>
                    <Field.Control id={`control-${step.value}`} />
                  </Field.Root>
                )}
              </Form>
              <button
                type="button"
                onClick={() => {
                  step.value = 1;
                }}
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  step.value = 2;
                }}
              >
                Unmount
              </button>
              <button
                type="button"
                onClick={() => {
                  step.value = 3;
                }}
              >
                Replace
              </button>
              <button type="button" onClick={() => handle.form?.validate('initial')}>
                Validate initial
              </button>
              <button type="button" onClick={() => handle.form?.validate('current')}>
                Validate current
              </button>
            </>
          );
        };
      });

      const { user } = await render(<App />);

      await user.click(screen.getByRole('button', { name: 'Rename' }));
      await user.click(screen.getByRole('button', { name: 'Validate initial' }));
      await user.click(screen.getByRole('button', { name: 'Validate current' }));

      expect(initialValidate).not.toHaveBeenCalled();
      expect(renamedValidate).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: 'Unmount' }));
      await user.click(screen.getByRole('button', { name: 'Validate current' }));
      expect(renamedValidate).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: 'Replace' }));
      await user.click(screen.getByRole('button', { name: 'Validate current' }));

      expect(replacementValidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('prop: noValidate', () => {
    it('should disable native validation if set to true (default)', async () => {
      await render(<Form data-testid="form" />);
      expect(screen.getByTestId('form')).toHaveAttribute('novalidate');
    });

    it('should enable native validation if set to false', async () => {
      await render(<Form novalidate={false} data-testid="form" />);
      expect(screen.getByTestId('form')).not.toHaveAttribute('novalidate');
    });
  });

  describe('submit', () => {
    it('validates each field, emits nothing and prevents the default when a field is invalid', async () => {
      const onSubmit = vi.fn();
      const onFormSubmit = vi.fn();
      const onFirstValidate = vi.fn();
      const onSecondValidate = vi.fn();

      await render(
        <Form data-testid="form" onSubmit={onSubmit} onFormSubmit={onFormSubmit}>
          <TestField id="first" value="x" onValidationCommit={onFirstValidate} />
          <TestField id="second" value="" onValidationCommit={onSecondValidate} />
        </Form>,
      );

      const notPrevented = await fireEvent.submit(screen.getByTestId('form'));

      expect(notPrevented).toBe(false);
      expect(onFirstValidate).toHaveBeenCalledTimes(1);
      expect(onSecondValidate).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onFormSubmit).not.toHaveBeenCalled();
    });

    it('emits submit with the native event when each field is valid, and does not prevent the default', async () => {
      const onSubmit = vi.fn();

      const { container } = await render(
        <Form data-testid="form" onSubmit={onSubmit}>
          <TestField id="first" value="x" />
        </Form>,
      );
      const submit = observeSubmit(container);

      await fireEvent.submit(screen.getByTestId('form'));

      expect(submit.wasPrevented).toBe(false);
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][0]).toBe(submit.event);
    });

    it('emits submit and then formSubmit with the values of the named fields, and prevents the default', async () => {
      const calls: string[] = [];
      const onSubmit = vi.fn(() => {
        calls.push('submit');
      });
      const onFormSubmit = vi.fn<(values: Form.Values, details: Form.SubmitEventDetails) => void>(
        () => {
          calls.push('formSubmit');
        },
      );

      const { container } = await render(
        <Form data-testid="form" onSubmit={onSubmit} onFormSubmit={onFormSubmit}>
          <TestField id="first" name="first" value="1" />
          <TestField id="unnamed" value="2" />
          <TestField id="third" name="third" value="3" />
        </Form>,
      );
      const submit = observeSubmit(container);

      await fireEvent.submit(screen.getByTestId('form'));

      expect(submit.wasPrevented).toBe(true);
      expect(calls).toEqual(['submit', 'formSubmit']);
      const [values, details] = onFormSubmit.mock.calls[0];
      expect(values).toEqual({ first: '1', third: '3' });
      expect(details.reason).toBe('none');
      expect(details.event).toBe(submit.event);
    });

    it('calls two formSubmit listeners one time each, with no Vue warning', async () => {
      const first = vi.fn();
      const second = vi.fn();
      // A wrapper that adds a listener to its attributes gives the form an array of listeners.
      const Wrapper = defineComponent(
        (_props: Record<string, unknown>, { attrs, slots }) =>
          () => <Form {...attrs} onFormSubmit={second} v-slots={slots} />,
        { inheritAttrs: false },
      );

      await render(
        <Wrapper data-testid="form" onFormSubmit={first}>
          <TestField id="field" name="field" value="x" />
        </Wrapper>,
      );

      await fireEvent.submit(screen.getByTestId('form'));

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('leaves a disabled control out of the validation and of the values', async () => {
      const onFormSubmit = vi.fn();
      const onDisabledValidate = vi.fn();

      await render(
        <Form data-testid="form" onFormSubmit={onFormSubmit}>
          <TestField id="enabled" name="enabled" value="sent" />
          <TestField
            id="disabled"
            name="disabled"
            value=""
            disabled
            onValidationCommit={onDisabledValidate}
          />
        </Form>,
      );

      await fireEvent.submit(screen.getByTestId('form'));

      expect(onDisabledValidate).not.toHaveBeenCalled();
      expect(onFormSubmit).toHaveBeenCalledTimes(1);
      expect(onFormSubmit.mock.calls[0][0]).toEqual({ enabled: 'sent' });
    });

    it('emits formSubmit also when a submit listener prevents the default', async () => {
      const onFormSubmit = vi.fn();

      await render(
        <Form
          data-testid="form"
          onSubmit={(event) => event.preventDefault()}
          onFormSubmit={onFormSubmit}
        >
          <TestField id="field" name="field" value="x" />
        </Form>,
      );

      await fireEvent.submit(screen.getByTestId('form'));

      expect(onFormSubmit).toHaveBeenCalledTimes(1);
    });

    it('calls a formSubmit listener with .once one time over two submits, and prevents the default on both', async () => {
      const onceListener = vi.fn();
      const { container } = await render(
        // A template gives the key `onFormSubmitOnce` for `@form-submit.once`.
        <Form data-testid="form" onFormSubmitOnce={onceListener}>
          <TestField id="field" name="field" value="x" />
        </Form>,
      );
      const submit = observeSubmit(container);

      await fireEvent.submit(screen.getByTestId('form'));

      expect(submit.wasPrevented).toBe(true);
      expect(onceListener).toHaveBeenCalledTimes(1);

      await fireEvent.submit(screen.getByTestId('form'));

      expect(submit.wasPrevented).toBe(true);
      expect(onceListener).toHaveBeenCalledTimes(1);
    });

    it('does not prevent the default when the formSubmit listeners are null', async () => {
      const { container } = await render(
        <Form
          data-testid="form"
          // @ts-expect-error The type has no null, but a consumer in JavaScript can give it.
          onFormSubmit={null}
          // @ts-expect-error The type has no null, but a consumer in JavaScript can give it.
          onFormSubmitOnce={null}
        >
          <TestField id="field" name="field" value="x" />
        </Form>,
      );
      const submit = observeSubmit(container);

      await fireEvent.submit(screen.getByTestId('form'));

      expect(submit.wasPrevented).toBe(false);
    });
  });

  describe('focus of the first invalid control', () => {
    it('focuses the first invalid control in the order of the document, and selects an input', async () => {
      const showFirst = shallowRef(false);
      await render(() => (
        <Form data-testid="form">
          {showFirst.value && <TestField id="first" value="" />}
          <TestField id="second" value="" />
        </Form>
      ));
      // The field that mounts later comes first in the document.
      showFirst.value = true;
      await flushMicrotasks();

      const select = vi.spyOn(HTMLInputElement.prototype, 'select');
      try {
        await fireEvent.submit(screen.getByTestId('form'));

        expect(screen.getByTestId('first')).toHaveFocus();
        expect(select).toHaveBeenCalledTimes(1);
      } finally {
        select.mockRestore();
      }
    });

    it('keeps the order of the registrations for two controls in two shadow roots', async () => {
      const hosts = [document.createElement('div'), document.createElement('div')];
      const roots = hosts.map((host) => host.attachShadow({ mode: 'open' }));
      const containers = roots.map((root) => {
        const container = document.createElement('div');
        root.append(container);
        return container;
      });
      document.body.append(...hosts);

      const { unmount } = await render(
        <Form data-testid="form">
          <Teleport to={containers[0]}>
            <TestField id="first" value="" />
          </Teleport>
          <Teleport to={containers[1]}>
            <TestField id="second" value="" />
          </Teleport>
        </Form>,
      );

      // The document position of two controls in two trees depends on the engine. The stub makes
      // it the same in each engine. Without the check for the other tree, the later control wins.
      const compareDocumentPosition = vi
        .spyOn(Node.prototype, 'compareDocumentPosition')
        .mockReturnValue(Node.DOCUMENT_POSITION_DISCONNECTED | Node.DOCUMENT_POSITION_FOLLOWING);
      try {
        await fireEvent.submit(screen.getByTestId('form'));

        expect(roots[0].activeElement).toBe(within(containers[0]).getByTestId('first'));
      } finally {
        compareDocumentPosition.mockRestore();
        unmount();
        hosts.forEach((host) => host.remove());
      }
    });

    it('blocks the submit and moves no focus when the invalid field has a control with no element', async () => {
      const ControlWithNoElement = defineComponent(() => {
        useRegisterFieldControl(
          () => null,
          'no-element',
          () => '',
        );
        return () => null;
      });
      const onSubmit = vi.fn();

      await render(
        <Form data-testid="form" onSubmit={onSubmit}>
          <button type="button" data-testid="other" />
          <FieldScope>
            <ControlWithNoElement />
          </FieldScope>
        </Form>,
      );
      screen.getByTestId('other').focus();

      const notPrevented = await fireEvent.submit(screen.getByTestId('form'));

      expect(notPrevented).toBe(false);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('other')).toHaveFocus();
    });
  });

  describe('errors', () => {
    it('makes the field with that name invalid, and no other field', async () => {
      await render(
        <Form errors={{ first: 'First error' }}>
          <TestField id="first" name="first" value="x" />
          <TestField id="second" name="second" value="x" />
        </Form>,
      );

      expect(screen.getByTestId('first-field')).toHaveAttribute('data-invalid');
      expect(screen.getByTestId('second-field')).not.toHaveAttribute('data-invalid');
    });

    it('removes only that own key with clearErrors, and keeps the object of the consumer', async () => {
      const { Probe, getContext } = defineFormContextProbe();
      // An object with no prototype, as a consumer can make it.
      const errors = Object.create(null) as Errors;
      errors.first = 'First error';
      errors.second = 'Second error';

      await render(
        <Form errors={errors}>
          <Probe />
        </Form>,
      );

      getContext().clearErrors('first');

      expect(getContext().errors.value).toEqual({ second: 'Second error' });
      expect(errors).toEqual({ first: 'First error', second: 'Second error' });
    });

    it('gives no new errors object for a name with no error or for undefined', async () => {
      const { Probe, getContext } = defineFormContextProbe();

      await render(
        <Form errors={{ first: 'First error' }}>
          <Probe />
        </Form>,
      );
      const initial = getContext().errors.value;

      // `toString` is a key of each plain object, but it is not an own key.
      getContext().clearErrors('toString');
      getContext().clearErrors('second');
      getContext().clearErrors(undefined);

      expect(getContext().errors.value).toBe(initial);
    });

    it('focuses the first invalid control when new errors follow a valid submit', async () => {
      const errors = shallowRef<Errors>();
      await render(() => (
        <Form data-testid="form" errors={errors.value} onSubmit={preventDefault}>
          <TestField id="first" name="first" value="x" />
          <TestField id="second" name="second" value="x" />
        </Form>
      ));
      await fireEvent.submit(screen.getByTestId('form'));

      errors.value = { second: 'Second error', first: 'First error' };

      await waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());
    });

    it('moves no focus when new errors come with no submit before them', async () => {
      const errors = shallowRef<Errors>();
      await render(() => (
        <Form errors={errors.value}>
          <TestField id="first" name="first" value="x" />
        </Form>
      ));

      errors.value = { first: 'First error' };
      await flushMicrotasks();

      expect(screen.getByTestId('first-field')).toHaveAttribute('data-invalid');
      expect(screen.getByTestId('first')).not.toHaveFocus();
    });

    it('moves no focus when clearErrors follows the focus of a submit', async () => {
      const { Probe, getContext } = defineFormContextProbe();
      const errors = shallowRef<Errors>();
      await render(() => (
        <Form data-testid="form" errors={errors.value} onSubmit={preventDefault}>
          <TestField id="first" name="first" value="x" />
          <TestField id="second" name="second" value="x" />
          <Probe />
        </Form>
      ));
      await fireEvent.submit(screen.getByTestId('form'));
      errors.value = { first: 'First error', second: 'Second error' };
      await waitFor(() => expect(screen.getByTestId('first')).toHaveFocus());

      getContext().clearErrors('first');
      await flushMicrotasks();

      expect(screen.getByTestId('first-field')).not.toHaveAttribute('data-invalid');
      expect(screen.getByTestId('second')).not.toHaveFocus();
    });

    it('VUE-13: follows a key that the consumer adds in place to a reactive errors object, also after a clearErrors', async () => {
      const { Probe, getContext } = defineFormContextProbe();
      const errors = ref<Errors>({});
      await render(() => (
        <Form errors={errors.value}>
          <TestField id="first" name="first" value="x" />
          <TestField id="second" name="second" value="x" />
          <Probe />
        </Form>
      ));

      errors.value.first = 'First error';
      await flushMicrotasks();
      expect(screen.getByTestId('first-field')).toHaveAttribute('data-invalid');

      getContext().clearErrors('first');
      await flushMicrotasks();
      expect(screen.getByTestId('first-field')).not.toHaveAttribute('data-invalid');

      errors.value.second = 'Second error';
      await flushMicrotasks();
      expect(screen.getByTestId('second-field')).toHaveAttribute('data-invalid');
    });
  });

  describe('exposed validate', () => {
    async function renderFields() {
      const handle: { form?: FormInstance } = {};
      const onValidate = { first: vi.fn(), second: vi.fn(), other: vi.fn() };
      const onSubmit = vi.fn();
      const onFormSubmit = vi.fn();

      await render(() => (
        <Form
          ref={(value) => {
            handle.form = value as FormInstance | null as FormInstance;
          }}
          onSubmit={onSubmit}
          onFormSubmit={onFormSubmit}
        >
          <TestField id="first" name="shared" value="" onValidationCommit={onValidate.first} />
          <TestField id="second" name="shared" value="x" onValidationCommit={onValidate.second} />
          <TestField id="other" name="other" value="x" onValidationCommit={onValidate.other} />
        </Form>
      ));

      return { form: handle.form as FormInstance, onValidate, onSubmit, onFormSubmit };
    }

    it('validates each field when it gets no name', async () => {
      const { form, onValidate } = await renderFields();

      form.validate();

      expect(onValidate.first).toHaveBeenCalledTimes(1);
      expect(onValidate.second).toHaveBeenCalledTimes(1);
      expect(onValidate.other).toHaveBeenCalledTimes(1);
    });

    it('validates only the first field with that name', async () => {
      const { form, onValidate } = await renderFields();

      form.validate('shared');

      expect(onValidate.first).toHaveBeenCalledTimes(1);
      expect(onValidate.second).not.toHaveBeenCalled();
      expect(onValidate.other).not.toHaveBeenCalled();
    });

    it('does nothing for an unknown name', async () => {
      const { form, onValidate } = await renderFields();

      form.validate('unknown');

      expect(onValidate.first).not.toHaveBeenCalled();
      expect(onValidate.second).not.toHaveBeenCalled();
      expect(onValidate.other).not.toHaveBeenCalled();
    });

    it('moves no focus and emits nothing', async () => {
      const { form, onSubmit, onFormSubmit } = await renderFields();

      form.validate();
      await flushMicrotasks();

      expect(screen.getByTestId('first-field')).toHaveAttribute('data-invalid');
      expect(document.body).toHaveFocus();
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onFormSubmit).not.toHaveBeenCalled();
    });
  });

  describe('context', () => {
    it('gives validationMode from the prop', async () => {
      const { Probe, getContext } = defineFormContextProbe();
      const { setProps } = await render(
        <Form>
          <Probe />
        </Form>,
      );
      expect(getContext().validationMode.value).toBe('onSubmit');

      await setProps({ validationMode: 'onBlur' });

      expect(getContext().validationMode.value).toBe('onBlur');
    });

    it('gives the form element as elementRef, also with the #render slot', async () => {
      const { Probe, getContext } = defineFormContextProbe();
      await render(
        <Form
          v-slots={{
            render: ({ props }: { props: FormHTMLAttributes & Pick<HTMLProps, 'ref'> }) => (
              <form {...props} data-testid="custom-form">
                <Probe />
              </form>
            ),
          }}
        />,
      );

      expect(getContext().elementRef.value).toBe(screen.getByTestId('custom-form'));
    });

    it('counts each submit in submitCountRef, also a blocked one', async () => {
      const { Probe, getContext } = defineFormContextProbe();
      const value = shallowRef('');
      await render(() => (
        <Form data-testid="form" onSubmit={preventDefault}>
          <TestField id="field" value={value.value} />
          <Probe />
        </Form>
      ));
      expect(getContext().submitCountRef.value).toBe(0);

      await fireEvent.submit(screen.getByTestId('form'));
      expect(getContext().submitCountRef.value).toBe(1);

      value.value = 'x';
      await flushMicrotasks();
      await fireEvent.submit(screen.getByTestId('form'));
      expect(getContext().submitCountRef.value).toBe(2);
    });
  });

  describe('native behavior', () => {
    it('submits with a click on a submit button, and the FormData holds the enabled named controls', async () => {
      let formData: Record<string, FormDataEntryValue> | undefined;
      await render(
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            formData = Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement));
          }}
        >
          <input name="email" value="a@b.c" />
          <input name="disabled" value="x" disabled />
          <button type="submit">Send</button>
        </Form>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(formData).toEqual({ email: 'a@b.c' });
    });

    it('submits with Enter in a text input, and the FormData holds its value', async () => {
      const formData: Record<string, FormDataEntryValue>[] = [];
      await render(
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            formData.push(Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement)));
          }}
        >
          <input name="email" data-testid="email" />
          <button type="submit">Send</button>
        </Form>,
      );

      await userEvent.fill(screen.getByTestId('email'), 'a@b.c');
      await userEvent.keyboard('{Enter}');

      expect(formData).toEqual([{ email: 'a@b.c' }]);
    });

    it('submits with a button outside the form that has the form attribute', async () => {
      const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
      await render(
        <div>
          <Form id="outside-form" onSubmit={onSubmit}>
            <input name="email" />
          </Form>
          <button type="submit" form="outside-form">
            Send
          </button>
        </div>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('resets the controls natively, and gives the reset event to the listener of the consumer', async () => {
      const onReset = vi.fn();
      await render(
        <Form onReset={onReset}>
          {/* Vue sets `defaultValue` as a DOM property, which also sets the `value` attribute. */}
          <input name="email" data-testid="email" {...{ defaultValue: 'saved' }} />
          <button type="reset">Reset</button>
        </Form>,
      );
      const input = screen.getByTestId<HTMLInputElement>('email');
      await userEvent.fill(input, 'typed');
      expect(input.value).toBe('typed');

      await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

      expect(input.value).toBe('saved');
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onReset.mock.calls[0][0].type).toBe('reset');
    });

    it('lets the browser block the submit of an empty required input when novalidate is false', async () => {
      const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
      await render(
        <Form novalidate={false} onSubmit={onSubmit}>
          <input name="email" required />
          <button type="submit">Send</button>
        </Form>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('emits submit for an empty required input with the default novalidate', async () => {
      const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
      await render(
        <Form onSubmit={onSubmit}>
          <input name="email" required />
          <button type="submit">Send</button>
        </Form>,
      );

      await userEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe('hydration', () => {
    it('hydrates a form with a server error, and a submit then focuses the first invalid control', async () => {
      const props = { errors: { second: 'Second error' }, firstValue: 'x', secondValue: 'y' };
      const serverHtml = await renderOnServer('src/form/FormHydration.test.vue', props);

      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(template.content.querySelector('form')?.hasAttribute('novalidate')).toBe(true);
      expect(
        template.content
          .querySelector('[data-testid="second-field"]')
          ?.hasAttribute('data-invalid'),
      ).toBe(true);

      const { container } = await hydrate(FormHydration, { serverHtml, props });
      await fireEvent.submit(within(container).getByTestId('form'));

      expect(within(container).getByTestId('second')).toHaveFocus();
    });
  });
});
