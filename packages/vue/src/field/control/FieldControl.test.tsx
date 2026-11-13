import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createSSRApp, defineComponent, nextTick, shallowRef, Teleport } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import FieldPartOrder from '../root/FieldPartOrder.test.vue';
import FieldControlHydration from './FieldControlHydration.test.vue';
import FieldControlReplace from './FieldControlReplace.test.vue';

const HYDRATION_FIXTURE = 'src/field/control/FieldControlHydration.test.vue';
const ORDER_FIXTURE = 'src/field/root/FieldPartOrder.test.vue';

// A case that acts between the server HTML and the hydration puts the HTML in the document and
// mounts the app by hand.
async function insertServerHtml(props: Record<string, unknown>) {
  const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = serverHtml;
  onTestFinished(() => container.remove());
  return container;
}

async function mountByHand(container: HTMLElement, props: Record<string, unknown>) {
  const app = createSSRApp(FieldControlHydration, props);
  onTestFinished(() => app.unmount());
  app.mount(container);
  await nextTick();
  await nextTick();
}

describe('<Field.Control />', () => {
  const { render } = createRenderer();

  describeConformance(<Field.Control />, () => ({
    refInstanceof: window.HTMLInputElement,
    render(node) {
      return render(<Field.Root>{node}</Field.Root>);
    },
  }));

  it('avoids rerendering for uncontrolled input changes', async () => {
    let renderCount = 0;

    // Count renders of Field.Control itself: the render function runs every time it renders.
    await render(
      <Field.Root>
        <Field.Control
          data-testid="control"
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => {
              renderCount += 1;
              return <input {...props} />;
            },
          }}
        />
      </Field.Root>,
    );

    const control = screen.getByTestId('control');
    const initialRenderCount = renderCount;

    await fireEvent.input(control, { target: { value: 'a' } });
    const afterFirstChange = renderCount;

    await fireEvent.input(control, { target: { value: 'ab' } });
    await fireEvent.input(control, { target: { value: 'abc' } });

    expect(renderCount).toBe(afterFirstChange);
    expect(afterFirstChange).toBeLessThanOrEqual(initialRenderCount + 1);
  });

  it('renders once per keystroke for controlled input changes', async () => {
    let renderCount = 0;

    const App = defineComponent(() => {
      const value = shallowRef('');
      return () => (
        <Field.Root>
          <Field.Control
            data-testid="control"
            value={value.value}
            onValueChange={(nextValue) => {
              value.value = nextValue;
            }}
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => {
                renderCount += 1;
                return <input {...props} />;
              },
            }}
          />
        </Field.Root>
      );
    });

    await render(<App />);

    const control = screen.getByTestId('control');

    // The first keystroke also flips dirty and filled, so measure the steady state after it.
    await fireEvent.input(control, { target: { value: 'a' } });
    const settledRenderCount = renderCount;

    await fireEvent.input(control, { target: { value: 'ab' } });
    await fireEvent.input(control, { target: { value: 'abc' } });

    // The controlled echo must not schedule a second render per keystroke.
    expect(renderCount).toBe(settledRenderCount + 2);
  });

  it('validates once when changed by the user', async () => {
    const validate = vi.fn();

    await render(
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control />
      </Field.Root>,
    );

    await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe('a');
  });

  it('validates once when a controlled value is changed by the user', async () => {
    const validate = vi.fn(() => null);

    const App = defineComponent(() => {
      const value = shallowRef('');
      return () => (
        <Field.Root validationMode="onChange" validate={validate}>
          <Field.Control
            value={value.value}
            onValueChange={(nextValue) => {
              value.value = nextValue;
            }}
          />
        </Field.Root>
      );
    });

    await render(<App />);

    await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });

    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('clears dirty state when a numeric controlled value returns to its initial value', async () => {
    const App = defineComponent(() => {
      const value = shallowRef(5);
      return () => (
        <Field.Root data-testid="root">
          <Field.Control
            value={value.value}
            onValueChange={(nextValue) => {
              value.value = Number(nextValue);
            }}
          />
        </Field.Root>
      );
    });

    await render(<App />);

    const root = screen.getByTestId('root');
    const control = screen.getByRole('textbox');

    expect(root).not.toHaveAttribute('data-dirty');

    await fireEvent.input(control, { target: { value: '56' } });

    expect(root).toHaveAttribute('data-dirty', '');

    await fireEvent.input(control, { target: { value: '5' } });

    expect(root).not.toHaveAttribute('data-dirty');
  });

  it('syncs state and validates when the controlled value changes programmatically', async () => {
    const validate = vi.fn((_value: unknown) => null);

    const App = defineComponent(() => {
      const value = shallowRef('');
      return () => (
        <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
          <Field.Control
            value={value.value}
            onValueChange={(nextValue) => {
              value.value = nextValue;
            }}
          />
          <button
            type="button"
            onClick={() => {
              value.value = 'external';
            }}
          >
            set
          </button>
        </Field.Root>
      );
    });

    await render(<App />);

    await fireEvent.click(screen.getByRole('button'));

    const root = screen.getByTestId('root');

    expect(root).toHaveAttribute('data-filled', '');
    expect(root).toHaveAttribute('data-dirty', '');
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe('external');
  });

  it('validates the final controlled value when it is normalized on blur', async () => {
    const validate = vi.fn((value) => (String(value).includes('@') ? null : 'Invalid email'));

    const App = defineComponent(() => {
      const value = shallowRef('');
      return () => (
        <Field.Root validationMode="onBlur" validate={validate}>
          <Field.Control
            value={value.value}
            onValueChange={(nextValue) => {
              value.value = nextValue;
            }}
            onFocusout={() => {
              value.value = value.value.trim();
            }}
          />
          <Field.Error />
        </Field.Root>
      );
    });

    await render(<App />);

    const control = screen.getByRole('textbox');
    await fireEvent.input(control, { target: { value: 'foo ' } });
    await fireEvent.focusOut(control);

    await flushMicrotasks();

    expect(validate.mock.lastCall?.[0]).toBe('foo');
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('keeps the final async validation when a controlled value is normalized on blur', async () => {
    const resolvers: Record<string, (value: string | null) => void> = {};
    const validate = vi.fn(
      (value) =>
        new Promise<string | null>((resolve) => {
          resolvers[String(value)] = resolve;
        }),
    );

    const App = defineComponent(() => {
      const value = shallowRef('');
      return () => (
        <Field.Root validationMode="onBlur" validate={validate}>
          <Field.Control
            value={value.value}
            onValueChange={(nextValue) => {
              value.value = nextValue;
            }}
            onFocusout={() => {
              value.value = value.value.trim();
            }}
          />
          <Field.Error />
        </Field.Root>
      );
    });

    await render(<App />);

    const control = screen.getByRole('textbox');
    await fireEvent.input(control, { target: { value: 'foo ' } });
    await fireEvent.focusOut(control);

    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(2);
    expect(validate.mock.lastCall?.[0]).toBe('foo');

    resolvers.foo('Invalid email');
    await flushMicrotasks();

    expect(screen.getByText('Invalid email')).toBeInTheDocument();

    resolvers['foo ']('Stale error');
    await flushMicrotasks();

    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('does not validate when a controlled value is reset to the initial value on blur', async () => {
    const App = defineComponent(() => {
      const value = shallowRef('');
      return () => (
        <Field.Root validationMode="onBlur">
          <Field.Control
            required
            value={value.value}
            onValueChange={(nextValue) => {
              value.value = nextValue;
            }}
            onFocusout={() => {
              value.value = '';
            }}
          />
          <Field.Error match="valueMissing">Required</Field.Error>
        </Field.Root>
      );
    });

    await render(<App />);

    const control = screen.getByRole('textbox');
    await fireEvent.input(control, { target: { value: 'foo' } });
    await fireEvent.focusOut(control);

    await flushMicrotasks();

    expect(screen.queryByText('Required')).toBe(null);
  });

  it('sets filled state on mount when the control is prefilled', async () => {
    await render(
      <Field.Root data-testid="root">
        <Field.Control defaultValue="foo" />
      </Field.Root>,
    );

    expect(screen.getByTestId('root')).toHaveAttribute('data-filled', '');
  });

  it('does not set filled state on mount for an empty controlled value', async () => {
    await render(
      <Field.Root data-testid="root">
        <Field.Control value="" onValueChange={() => {}} />
      </Field.Root>,
    );

    expect(screen.getByTestId('root')).not.toHaveAttribute('data-filled');
  });

  it('clears filled state when a controlled control remounts empty', async () => {
    const App = defineComponent(() => {
      const empty = shallowRef(false);
      return () => (
        <Field.Root data-testid="root">
          <Field.Control
            key={String(empty.value)}
            value={empty.value ? '' : 'value'}
            onValueChange={() => {}}
          />
          <button
            type="button"
            onClick={() => {
              empty.value = true;
            }}
          >
            clear
          </button>
        </Field.Root>
      );
    });

    await render(<App />);

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-filled', '');

    await fireEvent.click(screen.getByRole('button'));

    expect(root).not.toHaveAttribute('data-filled');
  });

  it('clears filled state when an uncontrolled control remounts empty', async () => {
    const App = defineComponent(() => {
      const empty = shallowRef(false);
      return () => (
        <Field.Root data-testid="root">
          <Field.Control key={String(empty.value)} defaultValue={empty.value ? '' : 'value'} />
          <button
            type="button"
            onClick={() => {
              empty.value = true;
            }}
          >
            clear
          </button>
        </Field.Root>
      );
    });

    await render(<App />);

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-filled', '');

    await fireEvent.click(screen.getByRole('button'));

    expect(root).not.toHaveAttribute('data-filled');
  });

  it('forwards a changing defaultValue without warning', async () => {
    const defaultValue = shallowRef('');

    await render(() => (
      <Field.Root data-testid="root">
        <Field.Control defaultValue={defaultValue.value} />
      </Field.Root>
    ));

    const root = screen.getByTestId('root');
    expect(root).not.toHaveAttribute('data-filled');

    defaultValue.value = 'value';
    await flushMicrotasks();

    expect(screen.getByRole('textbox')).toHaveValue('value');
    expect(root).toHaveAttribute('data-filled', '');
    expect(takeReportedMessages()).toEqual([]);
  });

  it('keeps filled state from the edited value when defaultValue changes', async () => {
    const defaultValue = shallowRef('');

    await render(() => (
      <Field.Root data-testid="root">
        <Field.Control defaultValue={defaultValue.value} />
      </Field.Root>
    ));

    const root = screen.getByTestId('root');
    const input = screen.getByRole('textbox');
    await fireEvent.input(input, { target: { value: 'typed' } });
    expect(root).toHaveAttribute('data-filled', '');

    defaultValue.value = 'next';
    await flushMicrotasks();
    defaultValue.value = '';
    await flushMicrotasks();

    expect(input).toHaveValue('typed');
    expect(root).toHaveAttribute('data-filled', '');
  });

  it('sets filled state from a controlled value on a custom element', async () => {
    await render(
      <Field.Root data-testid="root">
        <Field.Control value="value" onValueChange={() => {}} as="div" />
      </Field.Root>,
    );

    expect(screen.getByTestId('root')).toHaveAttribute('data-filled', '');
  });

  it('does not validate when the change is canceled', async () => {
    const validate = vi.fn(() => null);

    await render(
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control onValueChange={(value, details) => details.cancel()} />
      </Field.Root>,
    );

    await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });

    expect(validate).not.toHaveBeenCalled();
  });

  it('does not clear errors or validate when change is prevented', async () => {
    const validate = vi.fn();
    const handleValueChange = vi.fn();

    await render(
      <Form errors={{ message: 'Server error' }}>
        <Field.Root name="message" validationMode="onChange" validate={validate}>
          <Field.Control onValueChange={handleValueChange} />
          <Field.Error />
        </Field.Root>
      </Form>,
    );

    const control = screen.getByRole<HTMLInputElement>('textbox');
    control.addEventListener('input', (event) => event.preventDefault(), {
      capture: true,
      once: true,
    });
    await fireEvent.input(control, { cancelable: true, target: { value: 'a' } });

    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(validate).not.toHaveBeenCalled();
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it.skipIf(isJSDOM)('validates once when Enter implicitly submits a form', async () => {
    // Real browser input is needed: implicit form submission on Enter is browser behavior.
    const validate = vi.fn(() => null);
    const handleSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

    await render(
      <Form onSubmit={handleSubmit}>
        <Field.Root validate={validate}>
          <Field.Control defaultValue="a" />
        </Field.Root>
        <button type="submit">submit</button>
      </Form>,
    );

    const control = screen.getByRole<HTMLInputElement>('textbox');

    await userEvent.type(control, '[Enter]');
    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it.skipIf(isJSDOM)('validates when Enter does not implicitly submit the form', async () => {
    // Real browser input is needed: implicit form submission on Enter is browser behavior.
    const validate = vi.fn(() => null);
    const handleSubmit = vi.fn();

    await render(
      <Form onSubmit={handleSubmit}>
        <Field.Root validate={validate}>
          <Field.Control defaultValue="a" />
        </Field.Root>
        <input />
      </Form>,
    );

    const control = screen.getByDisplayValue<HTMLInputElement>('a');

    await userEvent.type(control, '[Enter]');
    await flushMicrotasks();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it.skipIf(isJSDOM)(
    'validates when a disabled submit button blocks implicit submission',
    async () => {
      // Real browser input is needed: implicit form submission on Enter is browser behavior.
      const validate = vi.fn(() => null);
      const handleSubmit = vi.fn();

      await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root validate={validate}>
            <Field.Control defaultValue="a" />
          </Field.Root>
          <button type="submit" disabled>
            submit
          </button>
        </Form>,
      );

      const control = screen.getByRole<HTMLInputElement>('textbox');

      await userEvent.type(control, '[Enter]');
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(1);
      expect(handleSubmit).not.toHaveBeenCalled();
    },
  );

  it('validates the latest value when Enter does not submit the form', async () => {
    const validate = vi.fn((_value: unknown) => null);

    const App = defineComponent(() => {
      const value = shallowRef('a');
      return () => (
        <Form
          onKeydown={() => {
            value.value = '';
          }}
        >
          <Field.Root validate={validate}>
            <Field.Control
              value={value.value}
              onValueChange={(nextValue) => {
                value.value = nextValue;
              }}
            />
          </Field.Root>
          <input />
        </Form>
      );
    });

    await render(<App />);

    const control = screen.getByDisplayValue<HTMLInputElement>('a');
    control.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(control, { key: 'Enter' });

    await waitFor(() => {
      expect(validate).toHaveBeenCalledTimes(1);
    });

    expect(validate.mock.lastCall?.[0]).toBe('');
  });

  it('validates when Enter is pressed outside a form', async () => {
    const validate = vi.fn(() => null);

    await render(
      <Field.Root validate={validate}>
        <Field.Control defaultValue="a" />
      </Field.Root>,
    );

    const control = screen.getByRole('textbox');
    control.focus();
    await flushMicrotasks();
    await fireEvent.keyDown(control, { key: 'Enter' });

    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('shows a required error when a prefilled value is cleared', async () => {
    await render(
      <Field.Root validationMode="onChange">
        <Field.Control data-testid="control" defaultValue="value" required />
        <Field.Error match="valueMissing">Required</Field.Error>
      </Field.Root>,
    );

    const control = screen.getByTestId('control');

    await fireEvent.input(control, { target: { value: '' } });

    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  describe('[data-focused]', () => {
    const Controls = defineComponent(
      (props: { firstMounted?: boolean; firstDisabled?: boolean }) => () => {
        const { firstMounted = true, firstDisabled = false } = props;
        return (
          <>
            <Field.Root data-testid="root">
              <Field.Label data-testid="label">Name</Field.Label>
              {firstMounted && <Field.Control data-testid="first" disabled={firstDisabled} />}
            </Field.Root>
            <button type="button" data-testid="outside" />
          </>
        );
      },
      { props: ['firstMounted', 'firstDisabled'] },
    );

    it('is removed when the focused control becomes disabled', async () => {
      const { setProps } = await render(<Controls />);

      const control = screen.getByTestId('first');
      control.focus();
      await flushMicrotasks();

      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
      expect(control).toHaveAttribute('data-focused', '');

      await setProps({ firstDisabled: true });

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      expect(control).not.toHaveAttribute('data-focused');
      expect(screen.getByTestId('label')).not.toHaveAttribute('data-focused');
    });

    it('is removed when the field root becomes disabled', async () => {
      function TestCase(props: { disabled?: boolean }) {
        const { disabled = false } = props;
        return (
          <Field.Root data-testid="root" disabled={disabled}>
            <Field.Control data-testid="control" />
          </Field.Root>
        );
      }

      const { setProps } = await render(<TestCase />);

      screen.getByTestId('control').focus();
      await flushMicrotasks();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

      await setProps({ disabled: true });

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
    });

    it('can be re-acquired after the control is re-enabled', async () => {
      const { setProps } = await render(<Controls />);

      const control = screen.getByTestId('first');
      control.focus();
      await flushMicrotasks();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

      await setProps({ firstDisabled: true });
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');

      // The control must not be the active element, so that the later `focus()` is a new focus.
      screen.getByTestId('outside').focus();
      await flushMicrotasks();

      await setProps({ firstDisabled: false });
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');

      control.focus();
      await flushMicrotasks();
      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
    });

    it('is removed when the focused control unmounts', async () => {
      const { setProps } = await render(<Controls />);

      screen.getByTestId('first').focus();
      await flushMicrotasks();

      expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');

      await setProps({ firstMounted: false });

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
      expect(screen.getByTestId('label')).not.toHaveAttribute('data-focused');
    });
  });

  it.skipIf(isJSDOM)('should sync focused state when autoFocus is used with SSR', async () => {
    const props = { autofocus: true };
    const container = await insertServerHtml(props);
    const input = within(container).getByRole('textbox');

    expect(input).toHaveAttribute('autofocus');

    // The browser focuses the control before the hydration.
    input.focus();
    expect(input).toBe(document.activeElement);

    await mountByHand(container, props);

    expect(within(container).getByTestId('root')).toHaveAttribute('data-focused', '');
    expect(input).toHaveAttribute('data-focused', '');
    expect(within(container).getByText('Name')).toHaveAttribute('data-focused', '');
  });

  describe('id', () => {
    it('updates the label association when the control is swapped', async () => {
      const App = defineComponent(() => {
        const controlKey = shallowRef('a');
        return () => (
          <>
            <Field.Root>
              <Field.Label data-testid="label">Label</Field.Label>
              <Field.Control key={controlKey.value} id={controlKey.value} />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                controlKey.value = 'b';
              }}
            >
              swap
            </button>
          </>
        );
      });

      await render(<App />);

      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'a');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      await fireEvent.click(screen.getByRole('button'));

      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'b');
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'b');
    });
  });

  describe('v-model:value', () => {
    it('emits valueChange with the value and the details, then update:value', async () => {
      const calls: string[] = [];

      await render(
        <Field.Root>
          <Field.Control
            value=""
            onValueChange={(value, details) => {
              calls.push(`valueChange ${value} ${details.reason} ${details.event.type}`);
            }}
            onUpdate:value={(value) => {
              calls.push(`update:value ${value}`);
            }}
          />
        </Field.Root>,
      );

      await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });

      expect(calls).toEqual(['valueChange a none input', 'update:value a']);
    });

    it.each([
      { name: 'a listener that cancels the change', cancel: true },
      { name: 'a parent that keeps its value', cancel: false },
    ])('shows the value of the prop after $name', async ({ cancel }) => {
      const updates: string[] = [];

      await render(
        <Field.Root data-testid="root">
          <Field.Control
            value="fixed"
            onValueChange={(value, details) => {
              if (cancel) {
                details.cancel();
              }
            }}
            onUpdate:value={(value) => {
              updates.push(value);
            }}
          />
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      await fireEvent.input(input, { target: { value: 'fixedx' } });
      await flushMicrotasks();

      expect(input).toHaveValue('fixed');
      expect(updates).toEqual(cancel ? [] : ['fixedx']);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-dirty');
    });
  });

  describe('change event', () => {
    it('handles a change event that has a new value and no input event', async () => {
      const handleValueChange = vi.fn();

      await render(
        <Field.Root data-testid="root">
          <Field.Control onValueChange={handleValueChange} />
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      await fireEvent.change(input, { target: { value: 'filled' } });

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.lastCall?.[0]).toBe('filled');
      expect(screen.getByTestId('root')).toHaveAttribute('data-filled', '');
    });

    it('ignores a change event that has the value of the last handled event', async () => {
      const handleValueChange = vi.fn();

      await render(
        <Field.Root>
          <Field.Control onValueChange={handleValueChange} />
        </Field.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('textbox');
      // A browser sends one `change` event after the `input` events of real typing.
      await fireEvent.input(input, { target: { value: 'ab' } });
      await fireEvent.change(input);
      await fireEvent.change(input);

      expect(handleValueChange).toHaveBeenCalledTimes(1);
    });

    it('ignores a change event that has the value of the mount', async () => {
      const handleValueChange = vi.fn();

      await render(
        <Field.Root>
          <Field.Control defaultValue="foo" onValueChange={handleValueChange} />
        </Field.Root>,
      );

      await fireEvent.change(screen.getByRole('textbox'));

      expect(handleValueChange).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'a parent that changes the value',
        initialValue: '',
        typed: 'a',
        keep: (next: string) => next.toUpperCase(),
      },
      {
        name: 'a parent that refuses the value',
        initialValue: 'abc',
        typed: 'abcd',
        keep: () => 'abc',
      },
    ])(
      'ignores a change event that has the value that Vue or the part wrote, for $name',
      async ({ initialValue, typed, keep }) => {
        const handleValueChange = vi.fn();

        const App = defineComponent(() => {
          const value = shallowRef(initialValue);
          return () => (
            <Field.Root>
              <Field.Control
                value={value.value}
                onValueChange={(next) => {
                  handleValueChange(next);
                  value.value = keep(next);
                }}
              />
            </Field.Root>
          );
        });

        await render(<App />);

        const input = screen.getByRole<HTMLInputElement>('textbox');
        await fireEvent.input(input, { target: { value: typed } });
        // A browser sends one `change` event when the input loses focus after real typing.
        await fireEvent.change(input);

        expect(handleValueChange).toHaveBeenCalledTimes(1);
        expect(handleValueChange).toHaveBeenCalledWith(typed);
      },
    );

    it('handles a change event that has the last typed value after the parent cleared the value', async () => {
      const handleValueChange = vi.fn();

      const App = defineComponent(() => {
        const value = shallowRef('');
        return () => (
          <Field.Root data-testid="root">
            <Field.Control
              value={value.value}
              onValueChange={(next) => {
                handleValueChange(next);
                value.value = next;
              }}
            />
            <button
              type="button"
              onClick={() => {
                value.value = '';
              }}
            >
              clear
            </button>
          </Field.Root>
        );
      });

      await render(<App />);

      const input = screen.getByRole<HTMLInputElement>('textbox');
      await fireEvent.input(input, { target: { value: 'a' } });
      await fireEvent.click(screen.getByRole('button'));

      expect(input).toHaveValue('');
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-filled');

      // A program that fills a form can send only `change`, with the value that the user typed last.
      await fireEvent.change(input, { target: { value: 'a' } });

      expect(handleValueChange).toHaveBeenCalledTimes(2);
      expect(handleValueChange).toHaveBeenLastCalledWith('a');
      expect(screen.getByTestId('root')).toHaveAttribute('data-filled', '');
    });

    it('handles a change event that has a value that the parent refused', async () => {
      const handleValueChange = vi.fn();

      const App = defineComponent(() => {
        const invalid = shallowRef(false);
        return () => (
          <Field.Root invalid={invalid.value}>
            <Field.Control
              value="abc"
              onValueChange={(next) => {
                handleValueChange(next);
                // The control renders in the same flush as the event, and Vue writes the prop.
                invalid.value = true;
              }}
            />
          </Field.Root>
        );
      });

      await render(<App />);

      const input = screen.getByRole<HTMLInputElement>('textbox');
      await fireEvent.input(input, { target: { value: 'abcd' } });

      expect(input).toHaveValue('abc');

      await fireEvent.change(input, { target: { value: 'abcd' } });

      expect(handleValueChange).toHaveBeenCalledTimes(2);
      expect(handleValueChange).toHaveBeenLastCalledWith('abcd');
    });
  });

  describe('native reset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function settle() {
      vi.advanceTimersByTime(0);
      await flushMicrotasks();
    }

    it.each([
      { name: 'a call of form.reset()', defaultValue: 'a', typed: '', reset: 'method' },
      { name: 'a click on a reset button', defaultValue: 'a', typed: '', reset: 'button' },
      { name: 'an empty default value', defaultValue: '', typed: 'typed', reset: 'method' },
    ] as const)(
      'BUG-6206: follows a native reset of its form with $name',
      async ({ defaultValue, typed, reset }) => {
        await render(
          <form data-testid="form">
            <Field.Root data-testid="root">
              <Field.Control defaultValue={defaultValue} />
            </Field.Root>
            <button type="reset">reset</button>
          </form>,
        );

        const root = screen.getByTestId('root');
        const input = screen.getByRole<HTMLInputElement>('textbox');

        await fireEvent.input(input, { target: { value: typed } });
        expect(root.hasAttribute('data-filled')).toBe(typed !== '');
        expect(root).toHaveAttribute('data-dirty', '');

        if (reset === 'method') {
          screen.getByTestId<HTMLFormElement>('form').reset();
        } else {
          await fireEvent.click(screen.getByText('reset'));
        }
        await settle();

        expect(input).toHaveValue(defaultValue);
        expect(root.hasAttribute('data-filled')).toBe(defaultValue !== '');
        expect(root).not.toHaveAttribute('data-dirty');
      },
    );

    it('BUG-6206: handles a change event that has the last typed value after a native reset', async () => {
      const handleValueChange = vi.fn();

      await render(
        <form data-testid="form">
          <Field.Root data-testid="root">
            <Field.Control onValueChange={handleValueChange} />
          </Field.Root>
        </form>,
      );

      const root = screen.getByTestId('root');
      const input = screen.getByRole<HTMLInputElement>('textbox');

      await fireEvent.input(input, { target: { value: 'a' } });
      screen.getByTestId<HTMLFormElement>('form').reset();
      await settle();

      expect(input).toHaveValue('');
      expect(root).not.toHaveAttribute('data-filled');

      // A program that fills a form can send only `change`, with the value that the user typed last.
      await fireEvent.change(input, { target: { value: 'a' } });

      expect(handleValueChange.mock.calls.map(([value]) => value)).toEqual(['a', 'a']);
      expect(root).toHaveAttribute('data-filled', '');
    });

    it('BUG-6206: keeps its state when a listener prevents the reset', async () => {
      await render(
        <form data-testid="form">
          <Field.Root data-testid="root">
            <Field.Control />
          </Field.Root>
        </form>,
      );

      const root = screen.getByTestId('root');
      const form = screen.getByTestId<HTMLFormElement>('form');
      const input = screen.getByRole<HTMLInputElement>('textbox');

      // A script that writes the value sends no event, so the state of the field does not change.
      input.value = 'written';
      form.addEventListener('reset', (event) => event.preventDefault(), { once: true });
      form.reset();
      await settle();

      expect(input).toHaveValue('written');
      expect(root).not.toHaveAttribute('data-filled');
      expect(root).not.toHaveAttribute('data-dirty');
    });

    it('BUG-6206: ignores the reset of another form', async () => {
      await render(
        <div>
          <form>
            <Field.Root data-testid="root">
              <Field.Control />
            </Field.Root>
          </form>
          <form data-testid="other-form" />
        </div>,
      );

      const root = screen.getByTestId('root');
      const input = screen.getByRole<HTMLInputElement>('textbox');

      // A script that writes the value sends no event, so only a reset can change the state.
      input.value = 'written';
      expect(root).not.toHaveAttribute('data-filled');

      screen.getByTestId<HTMLFormElement>('other-form').reset();
      await settle();

      expect(input).toHaveValue('written');
      expect(root).not.toHaveAttribute('data-filled');
      expect(root).not.toHaveAttribute('data-dirty');
    });

    it('VUE-21: clears the error of the field after a native reset', async () => {
      await render(
        <form data-testid="form">
          <Field.Root
            data-testid="root"
            validationMode="onChange"
            validate={(value) => (value === 'bad' ? 'custom error' : null)}
          >
            <Field.Control data-testid="control" defaultValue="good" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </form>,
      );

      const root = screen.getByTestId('root');
      const control = screen.getByTestId<HTMLInputElement>('control');

      await fireEvent.input(control, { target: { value: 'bad' } });
      expect(root).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('error')).toHaveTextContent('custom error');

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settle();

      expect(control).toHaveValue('good');
      expect(root).not.toHaveAttribute('data-invalid');
      expect(root).not.toHaveAttribute('data-valid');
      expect(control).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('VUE-21: removes the message that the field put on the input after a native reset', async () => {
      await render(
        <form data-testid="form">
          <Field.Root
            validationMode="onChange"
            validate={(value) => (value === 'bad' ? 'custom error' : null)}
          >
            <Field.Control data-testid="control" defaultValue="good" />
          </Field.Root>
        </form>,
      );

      const control = screen.getByTestId<HTMLInputElement>('control');

      await fireEvent.input(control, { target: { value: 'bad' } });
      expect(control.validationMessage).toBe('custom error');

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settle();

      expect(control.validity.customError).toBe(false);
      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(true);
    });

    it('VUE-21: clears the error of a form after a native reset', async () => {
      await render(
        <Form data-testid="form" errors={{ name: 'Server error' }}>
          <Field.Root name="name">
            <Field.Control data-testid="control" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('Server error');

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settle();

      expect(screen.getByTestId('control')).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it.each([
      { name: 'a validator in flight', validationDebounceTime: 0, wait: 0 },
      { name: 'a debounce that waits', validationDebounceTime: 100, wait: 100 },
    ])('VUE-21: drops the validation of $name at a native reset', async (row) => {
      let resolveValidate: ((value: string | null) => void) | undefined;
      const validate = vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            resolveValidate = resolve;
          }),
      );

      await render(
        <form data-testid="form">
          <Field.Root
            data-testid="root"
            validationMode="onChange"
            validationDebounceTime={row.validationDebounceTime}
            validate={validate}
          >
            <Field.Control />
            <Field.Error data-testid="error" />
          </Field.Root>
        </form>,
      );

      await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'taken' } });
      expect(validate).toHaveBeenCalledTimes(row.validationDebounceTime === 0 ? 1 : 0);

      screen.getByTestId<HTMLFormElement>('form').reset();
      await settle();
      vi.advanceTimersByTime(row.wait);
      resolveValidate?.('late error');
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(row.validationDebounceTime === 0 ? 1 : 0);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('BUG-6206: follows a native reset of a form in a shadow root', async () => {
      const host = document.createElement('div');
      document.body.append(host);
      onTestFinished(() => host.remove());
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const target = document.createElement('div');
      shadowRoot.append(target);

      await render(
        <Teleport to={target}>
          <form>
            <Field.Root data-testid="root">
              <Field.Control data-testid="control" />
            </Field.Root>
          </form>
        </Teleport>,
      );

      const root = shadowRoot.querySelector('[data-testid="root"]')!;
      const input = shadowRoot.querySelector<HTMLInputElement>('[data-testid="control"]')!;

      await fireEvent.input(input, { target: { value: 'typed' } });
      expect(root).toHaveAttribute('data-filled', '');

      shadowRoot.querySelector('form')!.reset();
      await settle();

      expect(input).toHaveValue('');
      expect(root).not.toHaveAttribute('data-filled');
    });
  });

  describe('replacing the control', () => {
    it('uses a control that mounts before the old control unmounts as the input of the field', async () => {
      const swapped = shallowRef(false);

      await render(() => <FieldControlReplace swapped={swapped.value} />);

      swapped.value = true;
      await flushMicrotasks();

      const control = screen.getByTestId('new');
      expect(screen.queryByTestId('old')).toBe(null);

      await fireEvent.input(control, { target: { value: 'x' } });
      await fireEvent.input(control, { target: { value: '' } });

      expect(control).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('label and id', () => {
    it('has the id of the provider and the id of a registered label in aria-labelledby', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Name</Field.Label>
          <Field.Control data-testid="control" />
        </Field.Root>,
      );

      const label = screen.getByTestId('label');
      const control = screen.getByTestId('control');

      expect(control.id).not.toBe('');
      expect(label).toHaveAttribute('for', control.id);
      expect(label.id).not.toBe('');
      expect(control).toHaveAttribute('aria-labelledby', label.id);
    });
  });

  describe('native form', () => {
    it('submits its name and value, and nothing when it is disabled or in another form', async () => {
      await render(
        <form data-testid="form">
          <Field.Root name="enabled">
            <Field.Control defaultValue="one" />
          </Field.Root>
          <Field.Root name="disabled" disabled>
            <Field.Control defaultValue="two" />
          </Field.Root>
          <Field.Root>
            <Field.Control name="other" defaultValue="three" form="other-form" />
          </Field.Root>
          <Field.Root>
            <Field.Control name="named" defaultValue="four" />
          </Field.Root>
        </form>,
      );

      const form = screen.getByTestId<HTMLFormElement>('form');

      expect(Object.fromEntries(new FormData(form))).toEqual({ enabled: 'one', named: 'four' });
    });

    it('fails the native validity of its form when it is required and empty', async () => {
      await render(
        <form data-testid="form">
          <Field.Root>
            <Field.Control name="required" required />
          </Field.Root>
        </form>,
      );

      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(false);
    });
  });

  describe('hydration', () => {
    it.each([
      {
        name: 'the label and the messages first',
        parts: ['label', 'description', 'error', 'control'],
      },
      {
        name: 'the label first, the messages last',
        parts: ['label', 'control', 'description', 'error'],
      },
      { name: 'the control first', parts: ['control', 'label', 'description', 'error'] },
      {
        name: 'the messages first, the label last',
        parts: ['description', 'error', 'control', 'label'],
      },
    ])('VUE-17: hydrates with the ids of the server: $name', async ({ parts }) => {
      const props = { parts };
      const serverHtml = await renderOnServer(ORDER_FIXTURE, props);

      // A `<template>` element parses the HTML with no side effect.
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverControl = template.content.querySelector('[data-testid="control"]');
      const serverId = (testId: string) =>
        template.content.querySelector(`[data-testid="${testId}"]`)?.id;
      expect(serverControl?.getAttribute('aria-labelledby')).toBe(serverId('label'));
      expect(serverControl?.getAttribute('aria-describedby')).toBe(
        `${serverId('description')} ${serverId('error')}`,
      );

      const { container } = await hydrate(FieldPartOrder, { serverHtml, props });

      const control = within(container).getByTestId('control');
      expect(control).toHaveAttribute('aria-labelledby', serverId('label'));
      expect(control).toHaveAttribute(
        'aria-describedby',
        `${serverId('description')} ${serverId('error')}`,
      );
    });

    it.each([
      { name: 'a default value', props: { defaultValue: 'foo' }, value: 'foo' },
      { name: 'a controlled value', props: { value: 'foo' }, value: 'foo' },
      { name: 'a disabled root', props: { disabled: true, defaultValue: 'foo' }, value: 'foo' },
      { name: 'an invalid root', props: { invalid: true }, value: '' },
      {
        name: 'a textarea with a default value',
        props: { as: 'textarea', defaultValue: 'foo' },
        value: 'foo',
      },
    ])('hydrates $name with no message', async ({ props, value }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(FieldControlHydration, { serverHtml, props });

      expect(within(container).getByTestId('control')).toHaveValue(value);
    });

    it('keeps the text that the user typed before the hydration, and the focus', async () => {
      const props = { defaultValue: 'foo', autofocus: true };
      const container = await insertServerHtml(props);
      const input = within(container).getByTestId('control') as HTMLInputElement;

      // The page is interactive before the hydration.
      input.focus();
      input.value = 'typed before';

      await mountByHand(container, props);

      expect(input).toHaveValue('typed before');
      expect(within(container).getByTestId('control')).toBe(input);
      expect(within(container).getByTestId('root')).toHaveAttribute('data-focused', '');
      expect(takeReportedMessages()).toEqual([]);
    });
  });
});
