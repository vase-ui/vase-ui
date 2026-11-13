import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { createSSRApp, defineComponent, nextTick, shallowRef, Teleport } from 'vue';
import { Field } from '@vase-ui/vue/field';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  within,
} from '#test-utils';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import FieldControlHydration from './FieldControlHydration.test.vue';
import FieldControlReplace from './FieldControlReplace.test.vue';

const HYDRATION_FIXTURE = 'src/field/control/FieldControlHydration.test.vue';

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

  describe('[data-focused]', () => {
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
          <LabelableLabel data-testid="label">Name</LabelableLabel>
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
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const input = within(container).getByTestId('control') as HTMLInputElement;

      // The page is interactive before the hydration.
      input.focus();
      input.value = 'typed before';

      const app = createSSRApp(FieldControlHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await nextTick();
      await nextTick();

      expect(input).toHaveValue('typed before');
      expect(within(container).getByTestId('control')).toBe(input);
      expect(within(container).getByTestId('root')).toHaveAttribute('data-focused', '');
      expect(takeReportedMessages()).toEqual([]);
    });
  });
});
