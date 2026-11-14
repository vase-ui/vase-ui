import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import type { PropType, VNode } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import { Form } from '@vase-ui/vue/form';
import { NumberField } from '@vase-ui/vue/number-field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Switch } from '@vase-ui/vue/switch';
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
import { useFieldRootContext } from '../../internals/field-root-context';
import * as Select from '../../select/index.parts';
import SelectInFieldHydration from './SelectInFieldHydration.test.vue';

type FieldRootInstance = InstanceType<typeof Field.Root>;
type FieldControlInstance = InstanceType<typeof Field.Control>;

function preventDefault(event: Event) {
  event.preventDefault();
}

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

  it('updates label association when replacing one control with another', async () => {
    const TestCase = defineComponent(() => {
      const showB = shallowRef(false);

      return () => (
        <>
          <Field.Root>
            <Field.Label>Label</Field.Label>
            {showB.value ? (
              <Field.Control key="b" id="control-b" />
            ) : (
              <Field.Control key="a" id="control-a" />
            )}
          </Field.Root>
          <button
            type="button"
            onClick={() => {
              showB.value = true;
            }}
          >
            Toggle
          </button>
        </>
      );
    });

    await render(<TestCase />);

    const label = screen.getByText('Label');
    expect(label).toHaveAttribute('for', 'control-a');

    await fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    await waitFor(() => {
      expect(label).toHaveAttribute('for', 'control-b');
    });
  });

  it('drops a stale explicit id when an id-less control replaces the control that owned it', async () => {
    const TestCase = defineComponent(
      (props: { swapped: boolean }) => () => (
        <Field.Root>
          <Field.Label>Label</Field.Label>
          {props.swapped ? (
            <Field.Control key="b" data-testid="control" />
          ) : (
            <Field.Control key="a" id="control" data-testid="control" />
          )}
        </Field.Root>
      ),
      { props: ['swapped'] },
    );

    const { rerender } = await render(<TestCase swapped={false} />);

    const label = screen.getByText('Label');
    expect(label).toHaveAttribute('for', 'control');

    await rerender(<TestCase swapped />);

    const control = screen.getByTestId('control');
    expect(control.id).not.toBe('control');
    expect(label).toHaveAttribute('for', control.id);
  });

  it('re-associates the label when a CheckboxGroup is replaced by another control', async () => {
    const TestCase = defineComponent(
      (props: { multi: boolean }) => () => (
        <Field.Root>
          <Field.Label>Answer</Field.Label>
          {props.multi ? (
            <CheckboxGroup allValues={['a']}>
              <Checkbox.Root value="a" />
            </CheckboxGroup>
          ) : (
            <Field.Control data-testid="control" />
          )}
        </Field.Root>
      ),
      { props: ['multi'] },
    );

    const { rerender } = await render(<TestCase multi />);

    // The group is named through `aria-labelledby`, so it suppresses `for` entirely.
    expect(screen.getByText('Answer')).not.toHaveAttribute('for');

    await rerender(<TestCase multi={false} />);

    expect(screen.getByText('Answer')).toHaveAttribute('for', screen.getByTestId('control').id);
  });

  it('updates label associations when the control id changes', async () => {
    const TestCase = defineComponent(() => {
      const controlId = shallowRef('control-a');

      return () => (
        <>
          <Field.Root>
            <Field.Label>Label</Field.Label>
            <Field.Control id={controlId.value} />
          </Field.Root>
          <button
            type="button"
            onClick={() => {
              controlId.value = 'control-b';
            }}
          >
            Change
          </button>
        </>
      );
    });

    await render(<TestCase />);

    const label = screen.getByText('Label');

    expect(label).toHaveAttribute('for', 'control-a');

    await fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(label).toHaveAttribute('for', 'control-b');
    });
  });

  it('falls back to a generated id when the control id is removed', async () => {
    const TestCase = defineComponent(() => {
      const controlId = shallowRef<string | undefined>('control-a');

      return () => (
        <>
          <Field.Root>
            <Field.Label>Label</Field.Label>
            <Field.Control id={controlId.value} />
          </Field.Root>
          <button
            type="button"
            onClick={() => {
              controlId.value = undefined;
            }}
          >
            Clear
          </button>
        </>
      );
    });

    await render(<TestCase />);

    const label = screen.getByText('Label');
    const control = screen.getByRole('textbox');

    expect(label).toHaveAttribute('for', 'control-a');
    expect(control).toHaveAttribute('id', 'control-a');

    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    const updatedId = screen.getByRole('textbox').id;

    expect(updatedId).not.toBe('');
    expect(updatedId).not.toBe('control-a');
    expect(label).toHaveAttribute('for', updatedId);
  });

  it('keeps an explicit control id while the subtree is hidden', async () => {
    const visible = shallowRef(true);

    await render(() => (
      <>
        <Field.Root>
          <Field.Label data-testid="label">Email</Field.Label>
          <KeepAlive>
            {visible.value ? <Field.Control id="email" data-testid="control" /> : null}
          </KeepAlive>
        </Field.Root>
        <button
          type="button"
          onClick={() => {
            visible.value = false;
          }}
        >
          hide
        </button>
      </>
    ));

    const control = screen.getByTestId('control');
    expect(control).toHaveAttribute('id', 'email');
    expect(screen.getByTestId('label')).toHaveAttribute('for', 'email');

    await fireEvent.click(screen.getByRole('button', { name: 'hide' }));

    // `KeepAlive` takes the control out of the document and keeps its DOM, so the association must
    // hold.
    expect(control.isConnected).toBe(false);
    expect(control).toHaveAttribute('id', 'email');
    expect(screen.getByTestId('label')).toHaveAttribute('for', 'email');
  });

  it('keeps the group label suppressed while its subtree is hidden', async () => {
    const visible = shallowRef(true);

    await render(() => (
      <>
        <Field.Root>
          <Field.Label data-testid="label">Apples</Field.Label>
          <KeepAlive>
            {visible.value ? (
              <CheckboxGroup allValues={['fuji', 'gala']} defaultValue={[]} data-testid="group">
                <Checkbox.Root parent />
                <Checkbox.Root value="fuji" />
                <Checkbox.Root value="gala" />
              </CheckboxGroup>
            ) : null}
          </KeepAlive>
        </Field.Root>
        <button
          type="button"
          onClick={() => {
            visible.value = false;
          }}
        >
          hide
        </button>
      </>
    ));

    const label = screen.getByTestId('label');
    const group = screen.getByTestId('group');

    expect(label).not.toHaveAttribute('for');
    expect(group).toHaveAttribute('aria-labelledby', label.id);

    await fireEvent.click(screen.getByRole('button', { name: 'hide' }));

    expect(label).not.toHaveAttribute('for');
    expect(group).toHaveAttribute('aria-labelledby', label.id);
  });

  it.skipIf(isJSDOM)(
    'keeps `aria-labelledby` valid when toggling from Checkbox.Root to Select.Root after hydration',
    async () => {
      const serverHtml = await renderOnServer('src/field/root/SelectInFieldHydration.test.vue');
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverLabelId = template.content.querySelector('[data-testid="label"]')?.id;

      expect(serverLabelId).toMatch(/^vase-ui-./);
      expect(
        template.content.querySelector('[data-testid="checkbox"]')?.getAttribute('aria-labelledby'),
      ).toBe(serverLabelId);

      const { container } = await hydrate(SelectInFieldHydration, { serverHtml });
      const label = container.querySelector('[data-testid="label"]')!;
      await waitFor(() => {
        expect(container.querySelector('[data-testid="checkbox"]')).toHaveAttribute(
          'aria-labelledby',
          label.id,
        );
      });
      await fireEvent.click(within(container).getByRole('button', { name: 'Toggle' }));

      const trigger = container.querySelector('[data-testid="trigger"]');
      expect(trigger).toHaveAttribute('aria-labelledby', label.id);

      await fireEvent.click(within(container).getByRole('button', { name: 'Toggle' }));

      const checkboxAfterToggle = container.querySelector('[data-testid="checkbox"]');
      expect(checkboxAfterToggle).toHaveAttribute('aria-labelledby', label.id);
    },
  );

  it.skipIf(isJSDOM)(
    'removes `aria-labelledby` when Field.Label is removed after hydration',
    async () => {
      const props = { control: 'select' };
      const serverHtml = await renderOnServer(
        'src/field/root/SelectInFieldHydration.test.vue',
        props,
      );
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const serverLabelId = template.content.querySelector('[data-testid="label"]')?.id;

      expect(serverLabelId).toMatch(/^vase-ui-./);
      expect(
        template.content.querySelector('[data-testid="trigger"]')?.getAttribute('aria-labelledby'),
      ).toBe(serverLabelId);

      const { container } = await hydrate(SelectInFieldHydration, { serverHtml, props });
      const label = container.querySelector('[data-testid="label"]')!;
      await waitFor(() => {
        expect(container.querySelector('[data-testid="trigger"]')).toHaveAttribute(
          'aria-labelledby',
          label.id,
        );
      });
      await fireEvent.click(within(container).getByRole('button', { name: 'Remove Label' }));

      expect(container.querySelector('[data-testid="label"]')).toBe(null);
      expect(container.querySelector('[data-testid="trigger"]')).not.toHaveAttribute(
        'aria-labelledby',
      );
    },
  );

  it('preserves a non-native label association when a control is unmounted and remounted', async () => {
    const showSelect = shallowRef(true);

    await render(() => (
      <>
        <Field.Root>
          <Field.Label nativeLabel={false} as="div" data-testid="label">
            Label
          </Field.Label>
          <KeepAlive>
            {showSelect.value ? (
              <Select.Root key="select">
                <Select.Trigger data-testid="trigger">
                  <Select.Value placeholder="Select a model" />
                </Select.Trigger>
              </Select.Root>
            ) : null}
          </KeepAlive>
        </Field.Root>
        <Checkbox.Root
          checked={!showSelect.value}
          onCheckedChange={(checked: boolean) => {
            showSelect.value = !checked;
          }}
        />
      </>
    ));

    const checkbox = screen.getByRole('checkbox');
    const labelId = screen.getByTestId('label').id;
    const trigger = screen.getByTestId('trigger');

    expect(trigger).toHaveAttribute('aria-labelledby', labelId);

    await fireEvent.click(checkbox);

    // `KeepAlive` takes the trigger out of the document and keeps its DOM.
    expect(trigger.isConnected).toBe(false);
    expect(trigger).toHaveAttribute('aria-labelledby', labelId);

    await fireEvent.click(checkbox);

    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-labelledby', labelId);
  });

  describe('prop: disabled', () => {
    it('should add data-disabled style hook to all components', async () => {
      await render(
        <Field.Root data-testid="field" disabled>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="message" />
        </Field.Root>,
      );

      const field = screen.getByTestId('field');
      const control = screen.getByTestId('control');
      const label = screen.getByTestId('label');
      const message = screen.getByTestId('message');

      expect(field).toHaveAttribute('data-disabled', '');
      expect(control).toHaveAttribute('data-disabled', '');
      expect(label).toHaveAttribute('data-disabled', '');
      expect(message).toHaveAttribute('data-disabled', '');
    });

    it('keeps an explicitly invalid field marked invalid while disabled', async () => {
      await render(
        <Field.Root data-testid="field" disabled invalid>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      const field = screen.getByTestId('field');
      const control = screen.getByTestId('control');
      const label = screen.getByTestId('label');
      const description = screen.getByTestId('description');

      expect(field).toHaveAttribute('data-invalid', '');
      expect(control).toHaveAttribute('data-invalid', '');
      expect(label).toHaveAttribute('data-invalid', '');
      expect(description).toHaveAttribute('data-invalid', '');

      // It does not participate in native constraint validation.
      expect(control).not.toHaveAttribute('aria-invalid');
    });

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
    it('when not in <Form> the function does not run by default', async () => {
      const validateSpy = vi.fn(() => 'error');
      await render(
        <Field.Root validate={validateSpy}>
          <Field.Control />
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole('textbox');
      const message = screen.queryByText('error');

      expect(message).toBe(null);

      await fireEvent.focusIn(control);
      await fireEvent.input(control, { target: { value: 'abc' } });
      expect(validateSpy.mock.calls.length).toBe(0);
      expect(screen.queryByText('error')).toBe(null);

      await fireEvent.focusOut(control);
      expect(validateSpy.mock.calls.length).toBe(0);
      expect(screen.queryByText('error')).toBe(null);
    });

    it('runs after native validations', async () => {
      await render(
        <Form>
          <Field.Root validate={(val) => (val === 'ab' ? 'custom error' : null)}>
            <Field.Control required />
            <Field.Error match="valueMissing">value missing</Field.Error>
            <Field.Error match="customError" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      expect(screen.queryByText('value missing')).toBe(null);
      expect(screen.queryByText('custom error')).toBe(null);

      const input = screen.getByRole<HTMLInputElement>('textbox');

      // submit
      await fireEvent.click(screen.getByText('submit'));
      expect(screen.queryByText('value missing')).not.toBe(null);
      expect(screen.queryByText('custom error')).toBe(null);

      await fireEvent.focusIn(input);
      // revalidate
      await fireEvent.input(input, { target: { value: 'ab' } });
      expect(screen.queryByText('value missing')).toBe(null);
      expect(screen.queryByText('custom error')).not.toBe(null);

      await fireEvent.input(input, { target: { value: '' } });
      expect(screen.queryByText('value missing')).not.toBe(null);
      // expect(screen.queryByText('custom error')).toBe(null);
    });

    it.each([
      { label: 'an empty array', validate: () => [] },
      { label: 'an undefined', validate: () => undefined },
      { label: 'an empty string', validate: () => '' },
      { label: 'an array of empty strings', validate: () => ['', ''] },
    ])('treats $label result as valid', async ({ validate }) => {
      const onSubmit = vi.fn(preventDefault);

      await render(
        <Form onSubmit={onSubmit}>
          <Field.Root name="field" validationMode="onChange" validate={validate}>
            <Field.Control data-testid="control" />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const control = screen.getByTestId('control');

      await fireEvent.input(control, { target: { value: 'abc' } });

      expect(control).not.toHaveAttribute('aria-invalid');
      expect(control).not.toHaveAttribute('data-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
      expect(control).toHaveProperty('validationMessage', '');

      await fireEvent.click(screen.getByText('submit'));

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    describe('async validation pending state', () => {
      it.each(['onSubmit', 'onChange', 'onBlur'] as const)(
        'publishes neutral validity while a validator is in flight in %s mode',
        async (validationMode) => {
          let resolveValidate: ((value: string | null) => void) | undefined;
          const validate = vi.fn(
            () =>
              new Promise<string | null>((resolve) => {
                resolveValidate = resolve;
              }),
          );

          await render(
            <Form onSubmit={preventDefault}>
              <Field.Root
                data-testid="root"
                name="username"
                validationMode={validationMode}
                validate={validate}
              >
                <Field.Control data-testid="control" />
                <Field.Error data-testid="error" />
              </Field.Root>
              <button type="submit">submit</button>
            </Form>,
          );

          const root = screen.getByTestId('root');
          const control = screen.getByTestId('control');

          await fireEvent.input(control, { target: { value: 'taken' } });
          if (validationMode === 'onBlur') {
            await fireEvent.focusOut(control);
          } else if (validationMode === 'onSubmit') {
            await fireEvent.click(screen.getByText('submit'));
          }

          expect(validate).toHaveBeenCalledTimes(1);
          expect(root).not.toHaveAttribute('data-valid');
          expect(root).not.toHaveAttribute('data-invalid');
          expect(control).not.toHaveAttribute('aria-invalid');
          expect(screen.queryByTestId('error')).toBe(null);

          resolveValidate?.('Username is taken');
          await flushMicrotasks();

          expect(root).toHaveAttribute('data-invalid', '');
          expect(control).toHaveAttribute('aria-invalid', 'true');
          expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');
        },
      );

      it.each(['onChange', 'onBlur'] as const)(
        'retires a previously valid result to neutral while revalidating in %s mode',
        async (validationMode) => {
          const resolvers: Array<(value: string | null) => void> = [];
          const validate = vi.fn(
            () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve);
              }),
          );

          await render(
            <Field.Root data-testid="root" validationMode={validationMode} validate={validate}>
              <Field.Control data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>,
          );

          const root = screen.getByTestId('root');
          const control = screen.getByTestId('control');

          await fireEvent.input(control, { target: { value: 'good' } });
          if (validationMode === 'onBlur') {
            await fireEvent.focusOut(control);
          }

          resolvers[0](null);
          await flushMicrotasks();

          expect(root).toHaveAttribute('data-valid', '');

          if (validationMode === 'onBlur') {
            await fireEvent.focusIn(control);
            await fireEvent.focusOut(control);
          } else {
            await fireEvent.input(control, { target: { value: 'taken' } });
          }

          // A valid result never blocks submission, so it retires to neutral mid-flight.
          expect(root).not.toHaveAttribute('data-valid');
          expect(root).not.toHaveAttribute('data-invalid');

          resolvers[1]('Username is taken');
          await flushMicrotasks();

          expect(root).toHaveAttribute('data-invalid', '');
          expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');
        },
      );

      it.each(['onChange', 'onBlur'] as const)(
        'keeps a previously resolved error while revalidating in %s mode',
        async (validationMode) => {
          const resolvers: Array<(value: string | null) => void> = [];
          const validate = vi.fn(
            () =>
              new Promise<string | null>((resolve) => {
                resolvers.push(resolve);
              }),
          );

          const onSubmit = vi.fn(preventDefault);

          await render(
            <Form onSubmit={onSubmit}>
              <Field.Root
                data-testid="root"
                name="username"
                validationMode={validationMode}
                validate={validate}
              >
                <Field.Control data-testid="control" />
                <Field.Error data-testid="error" />
              </Field.Root>
              <button type="submit">submit</button>
            </Form>,
          );

          const root = screen.getByTestId('root');
          const control = screen.getByTestId('control');

          await fireEvent.input(control, { target: { value: 'taken' } });
          if (validationMode === 'onBlur') {
            await fireEvent.focusOut(control);
          }

          resolvers[0]('Username is taken');
          await flushMicrotasks();

          expect(root).toHaveAttribute('data-invalid', '');

          // A keystroke would optimistically clear the error through the revalidate path, so
          // re-trigger validation without changing the value.
          if (validationMode === 'onBlur') {
            await fireEvent.focusIn(control);
            await fireEvent.focusOut(control);
          } else {
            await fireEvent.input(control, { target: { value: 'taken2' } });
          }

          // The resolved error stays published mid-flight so it keeps blocking submission.
          expect(root).toHaveAttribute('data-invalid', '');
          expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');

          await fireEvent.click(screen.getByText('submit'));

          expect(onSubmit).not.toHaveBeenCalled();

          resolvers[resolvers.length - 1](null);
          await flushMicrotasks();

          expect(root).not.toHaveAttribute('data-invalid');
          expect(screen.queryByTestId('error')).toBe(null);
        },
      );

      it('retires a stale native error to neutral once the constraint passes again', async () => {
        const onSubmit = vi.fn(preventDefault);
        const resolvers: Array<(value: string | null) => void> = [];
        const validate = vi.fn(
          () =>
            new Promise<string | null>((resolve) => {
              resolvers.push(resolve);
            }),
        );

        await render(
          <Form onSubmit={onSubmit}>
            <Field.Root
              data-testid="root"
              name="email"
              validationMode="onChange"
              validate={validate}
            >
              <Field.Control data-testid="control" type="email" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        await fireEvent.input(control, { target: { value: 'nope' } });

        resolvers[resolvers.length - 1](null);
        await flushMicrotasks();

        expect(root).toHaveAttribute('data-invalid', '');

        await fireEvent.input(control, { target: { value: 'name@example.com' } });

        // `nextState` already carries the fresh native verdict, so the previous native error must
        // not survive the pending window and keep blocking submission.
        expect(root).not.toHaveAttribute('data-invalid');
        expect(root).not.toHaveAttribute('data-valid');
        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.click(screen.getByText('submit'));

        expect(onSubmit).toHaveBeenCalledTimes(1);

        resolvers[resolvers.length - 1](null);
        await flushMicrotasks();

        expect(root).toHaveAttribute('data-valid', '');
      });

      it.each(['onSubmit', 'onChange', 'onBlur'] as const)(
        'keeps a native constraint failure published while the validator is in flight in %s mode',
        async (validationMode) => {
          const onSubmit = vi.fn(preventDefault);
          const validate = vi.fn(() => new Promise<string | null>(() => {}));

          await render(
            <Form onSubmit={onSubmit}>
              <Field.Root
                data-testid="root"
                name="username"
                validationMode={validationMode}
                validate={validate}
              >
                <Field.Control data-testid="control" required />
                <Field.Error data-testid="error" />
              </Field.Root>
              <button type="submit">submit</button>
            </Form>,
          );

          await fireEvent.click(screen.getByText('submit'));

          // In `onBlur` mode a native failure short-circuits the validator, so nothing is in
          // flight and the failure is published by the regular end-of-commit path instead.
          expect(validate).toHaveBeenCalledTimes(validationMode === 'onBlur' ? 0 : 1);
          expect(onSubmit).not.toHaveBeenCalled();
          expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');
          expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true');

          await flushMicrotasks();
        },
      );

      it('retires a resolved async error to neutral while revalidating in onSubmit mode', async () => {
        const onSubmit = vi.fn(preventDefault);
        const resolvers: Array<(value: string | null) => void> = [];
        const validate = vi.fn(
          () =>
            new Promise<string | null>((resolve) => {
              resolvers.push(resolve);
            }),
        );

        await render(
          <Form onSubmit={onSubmit}>
            <Field.Root data-testid="root" name="username" validate={validate}>
              <Field.Control data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        await fireEvent.click(screen.getByText('submit'));

        resolvers[0]('Username is taken');
        await flushMicrotasks();

        expect(root).toHaveAttribute('data-invalid', '');

        await fireEvent.click(screen.getByText('submit'));

        // An async result can't block submission in `onSubmit` mode, so the neutral state lets
        // the second submit through.
        expect(onSubmit).toHaveBeenCalledTimes(2);
        expect(root).not.toHaveAttribute('data-valid');
        expect(root).not.toHaveAttribute('data-invalid');
        expect(control).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        resolvers[1](null);
        await flushMicrotasks();

        expect(root).toHaveAttribute('data-valid', '');
        expect(screen.queryByTestId('error')).toBe(null);
      });
    });

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

    it('should apply aria-invalid prop to control once validation finishes', async () => {
      await render(
        <Form>
          <Field.Root validate={() => 'error'}>
            <Field.Control />
            <Field.Error />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const control = screen.getByRole('textbox');
      expect(control).not.toHaveAttribute('aria-invalid');

      await fireEvent.click(screen.getByText('submit'));
      expect(control).toHaveAttribute('aria-invalid', 'true');
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

    it('excludes registration-gated controls from onFormSubmit when their field name is removed', async () => {
      const handleSubmit = vi.fn();

      const App = defineComponent(() => {
        const name = shallowRef<string | undefined>('fruits');

        return () => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name={name.value}>
              <CheckboxGroup defaultValue={['apple']}>
                <Field.Item>
                  <Checkbox.Root value="apple" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="banana" />
                </Field.Item>
              </CheckboxGroup>
            </Field.Root>
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

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });

      await fireEvent.click(screen.getByText('Clear name'));
      await fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(2);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
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

    it('uses the Field.Control name fallback when the Field.Root name is removed', async () => {
      const App = defineComponent(() => {
        const rootName = shallowRef<string | undefined>('rootEmail');

        return () => (
          <Form errors={{ email: 'Email is already taken' }}>
            <Field.Root name={rootName.value}>
              <Field.Control name="email" />
              <Field.Error data-testid="default-error" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                rootName.value = undefined;
              }}
            >
              Clear root name
            </button>
          </Form>
        );
      });

      await render(<App />);

      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('default-error')).toBe(null);

      await fireEvent.click(screen.getByText('Clear root name'));

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('default-error')).toHaveTextContent('Email is already taken');
    });

    it('updates field-aware control name fallbacks when the name changes', async () => {
      const handleSubmit = vi.fn();

      const App = defineComponent(() => {
        const name = shallowRef<string | undefined>('quantity');

        return () => (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root>
              <NumberField.Root name={name.value} defaultValue={13}>
                <NumberField.Input />
              </NumberField.Root>
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                name.value = 'amount';
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
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ quantity: 13 });

      await fireEvent.click(screen.getByText('Change name'));
      await fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ amount: 13 });

      await fireEvent.click(screen.getByText('Clear name'));
      await fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
    });
  });

  describe('prop: validationMode', () => {
    describe('onSubmit', () => {
      it('should validate the field on submit', async () => {
        await render(
          <Form>
            <Field.Root validate={() => 'error'}>
              <Field.Control />
              <Field.Error />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const message = screen.queryByText('error');

        expect(message).toBe(null);

        await fireEvent.click(screen.getByText('submit'));

        expect(screen.queryByText('error')).not.toBe(null);
      });

      it('revalidates on change', async () => {
        await render(
          <Form>
            <Field.Root>
              <Field.Control type="url" required defaultValue="" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const control = screen.getByRole<HTMLInputElement>('textbox');

        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.click(screen.getByText('submit'));
        expect(screen.queryByTestId('error')).not.toBe(null);

        await fireEvent.input(control, { target: { value: 'http://example' } });
        expect(screen.queryByTestId('error')).toBe(null);
      });
    });

    describe('onChange', () => {
      it('validates the field on change', async () => {
        await render(
          <Field.Root
            validationMode="onChange"
            validate={(value) => {
              const str = value as string;
              return str.length < 3 ? 'error' : null;
            }}
          >
            <Field.Control />
            <Field.Error />
          </Field.Root>,
        );

        const control = screen.getByRole<HTMLInputElement>('textbox');
        const message = screen.queryByText('error');

        expect(message).toBe(null);

        await fireEvent.input(control, { target: { value: 't' } });

        expect(control).toHaveAttribute('data-invalid', '');
        expect(control).toHaveAttribute('aria-invalid', 'true');
      });
    });

    describe('onBlur', () => {
      it('validates the field on blur', async () => {
        await render(
          <Field.Root
            validationMode="onBlur"
            validate={(value) => {
              const str = value as string;
              return str.length < 3 ? 'error' : null;
            }}
          >
            <Field.Control />
            <Field.Error />
          </Field.Root>,
        );

        const control = screen.getByRole<HTMLInputElement>('textbox');
        const message = screen.queryByText('error');

        expect(message).toBe(null);

        await fireEvent.input(control, { target: { value: 't' } });

        expect(control).not.toHaveAttribute('data-invalid');

        await fireEvent.focusOut(control);

        expect(control).toHaveAttribute('data-invalid', '');
        expect(control).toHaveAttribute('aria-invalid', 'true');
      });

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

      it('does not publish errors while `valueMissing` is suppressed', async () => {
        let latestValidity = null as Field.Validity.State | null;

        await render(
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
            <Field.Validity
              v-slots={{
                default: (validity: Field.Validity.State) => {
                  latestValidity = validity;
                  return null;
                },
              }}
            />
          </Field.Root>,
        );

        const control = screen.getByTestId('control');

        await fireEvent.focusIn(control);
        await fireEvent.focusOut(control);

        expect(latestValidity!.validity.valid).toBe(true);
        expect(latestValidity!.errors).toEqual([]);
        expect(latestValidity!.error).toBe('');
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

      it('supports async validation', async () => {
        await render(
          <Field.Root validationMode="onBlur" validate={() => Promise.resolve('error')}>
            <Field.Control />
            <Field.Error />
          </Field.Root>,
        );

        const control = screen.getByRole('textbox');
        const message = screen.queryByText('error');

        expect(message).toBe(null);

        await fireEvent.focusIn(control);
        await fireEvent.focusOut(control);

        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByText('error')).not.toBe(null);
        });
      });

      it('ignores stale async validation results', async () => {
        const resolvers: Record<string, (value: string | null) => void> = {};
        const validate = vi.fn((value) => {
          return new Promise<string | null>((resolve) => {
            resolvers[value as string] = resolve;
          });
        });

        await render(
          <Field.Root validationMode="onChange" validate={validate}>
            <Field.Control />
            <Field.Error />
          </Field.Root>,
        );

        const control = screen.getByRole<HTMLInputElement>('textbox');

        await fireEvent.input(control, { target: { value: 'old' } });
        await fireEvent.input(control, { target: { value: 'new' } });

        resolvers.new(null);
        await flushMicrotasks();

        expect(screen.queryByText('old error')).toBe(null);
        expect(control).not.toHaveAttribute('aria-invalid');

        resolvers.old('old error');
        await flushMicrotasks();

        expect(screen.queryByText('old error')).toBe(null);
        expect(control).not.toHaveAttribute('aria-invalid');
      });

      it('should apply [data-field] style hooks to field components', async () => {
        await render(
          <Field.Root validationMode="onBlur">
            <Field.Label data-testid="label">Label</Field.Label>
            <Field.Description data-testid="description">Description</Field.Description>
            <Field.Error data-testid="error" />
            <Field.Control data-testid="control" required />
          </Field.Root>,
        );

        const control = screen.getByTestId<HTMLInputElement>('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');
        let error = screen.queryByTestId('error');

        expect(control).not.toHaveAttribute('data-valid');
        expect(label).not.toHaveAttribute('data-valid');
        expect(description).not.toHaveAttribute('data-valid');
        expect(error).toBe(null);

        await fireEvent.focusIn(control);
        await fireEvent.input(control, { target: { value: 'a' } });
        await fireEvent.input(control, { target: { value: '' } });
        await fireEvent.focusOut(control);

        error = screen.getByTestId('error');

        expect(control).toHaveAttribute('data-invalid', '');
        expect(label).toHaveAttribute('data-invalid', '');
        expect(description).toHaveAttribute('data-invalid', '');
        expect(error).toHaveAttribute('data-invalid', '');

        control.value = 'value';
        control.focus();
        control.blur();
        await flushMicrotasks();

        error = screen.queryByTestId('error');

        expect(control).toHaveAttribute('data-valid', '');
        expect(label).toHaveAttribute('data-valid', '');
        expect(description).toHaveAttribute('data-valid', '');
        expect(error).toBe(null);
      });

      describe('revalidation', () => {
        it('revalidates on change for `valueMissing`', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control required />
              <Field.Error />
            </Field.Root>,
          );

          const control = screen.getByRole('textbox');
          const message = screen.queryByText('error');

          expect(message).toBe(null);

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: 't' } });
          await fireEvent.focusOut(control);

          expect(control).not.toHaveAttribute('aria-invalid', 'true');

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: '' } });
          await fireEvent.focusOut(control);

          expect(control).toHaveAttribute('aria-invalid');
        });

        it('handles both `required` and `typeMismatch`', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control type="email" required />
              <Field.Error data-testid="error" />
            </Field.Root>,
          );

          const control = screen.getByRole('textbox');
          const message = screen.queryByTestId('error');

          expect(message).toBe(null);

          await fireEvent.focusIn(control);
          await fireEvent.focusOut(control);

          expect(control).not.toHaveAttribute('aria-invalid');

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: 'tt' } });
          await fireEvent.focusOut(control);

          expect(control).toHaveAttribute('aria-invalid', 'true');

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: '' } });
          await fireEvent.focusOut(control);

          expect(control).toHaveAttribute('aria-invalid', 'true');

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: 'email@email.com' } });
          await fireEvent.focusOut(control);

          expect(control).not.toHaveAttribute('aria-invalid');
        });

        it('revalidates on change when clearing a type mismatch leaves only `valueMissing`', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control type="email" required data-testid="control" />
              <Field.Error match="typeMismatch" data-testid="type-error">
                Invalid email
              </Field.Error>
              <Field.Error match="valueMissing" data-testid="required-error">
                Required
              </Field.Error>
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: 'invalid' } });
          await fireEvent.focusOut(control);

          expect(screen.getByTestId('type-error')).not.toBe(null);
          expect(screen.queryByTestId('required-error')).toBe(null);

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: '' } });

          expect(screen.queryByTestId('type-error')).toBe(null);
          expect(screen.getByTestId('required-error')).not.toBe(null);
        });

        it('clears valueMissing on change but defers other native errors like typeMismatch until blur when both are active', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control type="email" required data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          await fireEvent.focusIn(control);
          await fireEvent.focusOut(control);
          expect(control).not.toHaveAttribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).toBe(null);

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: 'a' } });
          await fireEvent.input(control, { target: { value: '' } });
          await fireEvent.focusOut(control);

          expect(control).toHaveAttribute('aria-invalid', 'true');
          expect(screen.getByTestId('error')).not.toBe(null);

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: 't' } });

          // The field becomes temporarily valid because only 'valueMissing' is checked for immediate clearing.
          // Other errors like 'typeMismatch' are deferred to the next blur/submit.
          expect(control).not.toHaveAttribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).toBe(null);

          await fireEvent.focusOut(control);

          expect(control).toHaveAttribute('aria-invalid', 'true');
          expect(screen.getByTestId('error')).not.toBe(null);
          expect(screen.getByTestId('error').textContent).not.toBe('');

          await fireEvent.focusIn(control);
          await fireEvent.input(control, { target: { value: 'test@example.com' } });

          expect(control).not.toHaveAttribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).toBe(null);

          await fireEvent.focusOut(control);

          expect(control).not.toHaveAttribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).toBe(null);
        });
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

  describe('prop: validateDebounceTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function tick(milliseconds: number) {
      vi.advanceTimersByTime(milliseconds);
      await flushMicrotasks();
    }

    it('should debounce validation', async () => {
      await render(
        <Field.Root
          validationDebounceTime={100}
          validationMode="onChange"
          validate={(value) => {
            const str = value as string;
            return str.length < 3 ? 'error' : null;
          }}
        >
          <Field.Control />
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole<HTMLInputElement>('textbox');
      const message = screen.queryByText('error');

      expect(message).toBe(null);

      await fireEvent.input(control, { target: { value: 't' } });

      expect(control).not.toHaveAttribute('aria-invalid');

      await tick(99);

      await fireEvent.input(control, { target: { value: 'te' } });

      await tick(99);

      expect(control).not.toHaveAttribute('aria-invalid');

      await tick(1);

      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('error')).not.toBe(null);
    });

    it('should debounce validation for field-aware controls', async () => {
      const validate = vi.fn((value) => (value ? 'error' : null));

      await render(
        <Field.Root validationDebounceTime={100} validationMode="onChange" validate={validate}>
          <Checkbox.Root />
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole('checkbox');

      await fireEvent.click(control);

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      await tick(99);

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      await tick(1);

      expect(validate).toHaveBeenCalledTimes(1);
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('error')).not.toBe(null);
    });

    it('should debounce validation for radio groups', async () => {
      const validate = vi.fn((value) => (value === 'b' ? 'error' : null));

      await render(
        <Field.Root validationDebounceTime={100} validationMode="onChange" validate={validate}>
          <RadioGroup>
            <Radio.Root value="a" data-testid="item-a" />
            <Radio.Root value="b" data-testid="item-b" />
          </RadioGroup>
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole('radiogroup');

      await fireEvent.click(screen.getByTestId('item-b'));

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      await tick(99);

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      await tick(1);

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe('b');
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('error')).not.toBe(null);
    });

    it('drops a pending debounced validation when the control unmounts', async () => {
      const validate = vi.fn(() => 'error');

      const App = defineComponent(() => {
        const mounted = shallowRef(true);

        return () => (
          <div>
            <Field.Root
              data-testid="root"
              validationDebounceTime={100}
              validationMode="onChange"
              validate={validate}
            >
              {mounted.value && <Field.Control data-testid="control" />}
              <Field.Error data-testid="error" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                mounted.value = false;
              }}
            >
              unmount
            </button>
          </div>
        );
      });

      await render(<App />);

      await fireEvent.input(screen.getByTestId('control'), { target: { value: 'abc' } });

      await tick(99);

      await fireEvent.click(screen.getByText('unmount'));

      await tick(100);

      expect(validate).not.toHaveBeenCalled();
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
    });

    it('ignores async validation results superseded during debounce', async () => {
      const resolvers: Record<string, (value: string | null) => void> = {};
      const validate = vi.fn((value) => {
        return new Promise<string | null>((resolve) => {
          resolvers[value as string] = resolve;
        });
      });

      await render(
        <Field.Root validationDebounceTime={100} validationMode="onChange" validate={validate}>
          <Field.Control />
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole<HTMLInputElement>('textbox');

      await fireEvent.input(control, { target: { value: 'old' } });
      await tick(100);

      expect(validate.mock.lastCall?.[0]).toBe('old');

      await fireEvent.input(control, { target: { value: 'new' } });

      resolvers.old('old error');
      await flushMicrotasks();

      expect(screen.queryByText('old error')).toBe(null);
      expect(control).not.toHaveAttribute('aria-invalid');

      await tick(100);

      resolvers.new(null);
      await flushMicrotasks();

      expect(validate.mock.lastCall?.[0]).toBe('new');
      expect(screen.queryByText('old error')).toBe(null);
      expect(control).not.toHaveAttribute('aria-invalid');
    });

    it('drops an in-flight async validation when the control unmounts', async () => {
      let resolveValidate: ((value: string | null) => void) | undefined;
      const validate = vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            resolveValidate = resolve;
          }),
      );

      const App = defineComponent(() => {
        const mounted = shallowRef(true);

        return () => (
          <div>
            <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
              {mounted.value && <Field.Control data-testid="control" />}
              <Field.Error data-testid="error" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                mounted.value = false;
              }}
            >
              unmount
            </button>
          </div>
        );
      });

      await render(<App />);

      await fireEvent.input(screen.getByTestId('control'), { target: { value: 'abc' } });
      expect(validate).toHaveBeenCalledTimes(1);

      await fireEvent.click(screen.getByText('unmount'));

      resolveValidate?.('error');
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
    });

    it('keeps the published error when async validation rejects', async () => {
      const onSubmit = vi.fn(preventDefault);
      let commit: ((value: unknown) => Promise<void>) | undefined;

      const ReadCommit = defineComponent(() => {
        commit = useFieldRootContext().validation.commit;
        return () => null;
      });

      let calls = 0;
      const validate = async () => {
        calls += 1;
        if (calls === 2) {
          throw new Error('network');
        }
        return 'Username is taken';
      };

      await render(
        <Form onSubmit={onSubmit}>
          <Field.Root name="username" validationMode="onBlur" validate={validate}>
            <Field.Control data-testid="control" />
            <Field.Error data-testid="error" />
            <ReadCommit />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const control = screen.getByTestId('control');

      await fireEvent.focusIn(control);
      await fireEvent.input(control, { target: { value: 'taken' } });
      await fireEvent.focusOut(control);
      await flushMicrotasks();

      expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');

      await expect(commit?.('taken')).rejects.toThrow('network');

      expect(screen.getByTestId('error')).toHaveTextContent('Username is taken');
      expect(control).toHaveAttribute('aria-invalid', 'true');

      await fireEvent.click(screen.getByText('submit'));
      await flushMicrotasks();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('drops a pending validation when another field-aware control takes ownership', async () => {
      const validate = vi.fn(() => 'error');

      const App = defineComponent(() => {
        const showSwitch = shallowRef(false);

        return () => (
          <div>
            <Field.Root
              data-testid="root"
              validationDebounceTime={100}
              validationMode="onChange"
              validate={validate}
            >
              <Field.Control data-testid="control" />
              {showSwitch.value && <Switch.Root />}
              <Field.Error data-testid="error" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                showSwitch.value = true;
              }}
            >
              add switch
            </button>
          </div>
        );
      });

      await render(<App />);

      await fireEvent.input(screen.getByTestId('control'), { target: { value: 'abc' } });

      await tick(99);

      await fireEvent.click(screen.getByText('add switch'));

      await tick(100);

      expect(validate).not.toHaveBeenCalled();
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
    });

    it('keeps a pending debounce armed across the first registration', async () => {
      const validate = vi.fn(() => 'error');

      await render(
        <Field.Root
          data-testid="root"
          validationDebounceTime={100}
          validationMode="onChange"
          validate={validate}
        >
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      await fireEvent.input(screen.getByTestId('control'), { target: { value: 'abc' } });

      await tick(100);

      expect(validate).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('error')).toHaveTextContent('error');
    });
  });

  describe('custom validity ownership', () => {
    it('keeps a message set outside the field when submitting', async () => {
      const onFormSubmit = vi.fn();

      await render(
        <Form onFormSubmit={onFormSubmit}>
          <Field.Root name="external">
            <Field.Control data-testid="control" />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      await fireEvent.click(screen.getByText('submit'));

      expect(onFormSubmit).not.toHaveBeenCalled();
      expect(control.validationMessage).toBe('external error');
      expect(screen.getByTestId('error')).toHaveTextContent('external error');
    });

    it('keeps a message set outside the field when validating on change', async () => {
      await render(
        <Field.Root validationMode="onChange">
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      await fireEvent.input(control, { target: { value: 'abc' } });

      expect(control.validationMessage).toBe('external error');
      expect(control).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('error')).toHaveTextContent('external error');
    });

    it('keeps a message set outside the field when revalidating on change', async () => {
      await render(
        <Field.Root validationMode="onBlur">
          <Field.Control data-testid="control" required />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const control = screen.getByTestId<HTMLInputElement>('control');

      await fireEvent.focusIn(control);
      await fireEvent.input(control, { target: { value: 'a' } });
      await fireEvent.input(control, { target: { value: '' } });
      await fireEvent.focusOut(control);
      expect(control).toHaveAttribute('data-invalid', '');

      control.setCustomValidity('external error');
      await fireEvent.input(control, { target: { value: 'abc' } });

      expect(control.validationMessage).toBe('external error');
      expect(control).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('error')).toHaveTextContent('external error');
    });

    it('keeps other native errors deferred while a message set outside the field survives', async () => {
      const handleValidity = vi.fn();
      await render(
        <Field.Root name="field" validationMode="onBlur">
          <Field.Control type="email" required />
          <Field.Error match="typeMismatch" data-testid="type-mismatch">
            invalid email
          </Field.Error>
          <Field.Validity v-slots={{ default: handleValidity }} />
        </Field.Root>,
      );

      const control = screen.getByRole<HTMLInputElement>('textbox');

      await fireEvent.focusIn(control);
      await fireEvent.input(control, { target: { value: 'a' } });
      await fireEvent.input(control, { target: { value: '' } });
      await fireEvent.focusOut(control);
      expect(control).toHaveAttribute('data-invalid', '');

      control.setCustomValidity('external error');
      await fireEvent.input(control, { target: { value: 'abc' } });

      expect(screen.queryByTestId('type-mismatch')).toBe(null);
      expect(handleValidity.mock.lastCall?.[0].validity.typeMismatch).toBe(false);
      expect(handleValidity.mock.lastCall?.[0].validity.customError).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].validity.valid).toBe(false);
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(['external error']);
    });

    it('clears the message it set itself', async () => {
      await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => (value === 'bad' ? 'custom error\r\nmore' : null)}
        >
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const control = screen.getByTestId<HTMLInputElement>('control');

      await fireEvent.input(control, { target: { value: 'bad' } });

      expect(control.validationMessage).toBe('custom error\nmore');

      await fireEvent.input(control, { target: { value: 'good' } });

      expect(control.validationMessage).toBe('');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('restores a message its own one displaced', async () => {
      await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => (value === 'bad' ? 'custom error' : null)}
        >
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      await fireEvent.input(control, { target: { value: 'bad' } });

      expect(control.validationMessage).toBe('custom error');

      await fireEvent.input(control, { target: { value: 'good' } });

      expect(control.validationMessage).toBe('external error');
      expect(screen.getByTestId('error')).toHaveTextContent('external error');
    });

    it('does not restore a message that was withdrawn while its own one was installed', async () => {
      await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => (value === 'bad' ? 'custom error' : null)}
        >
          <Field.Control data-testid="control" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      await fireEvent.input(control, { target: { value: 'bad' } });

      expect(control.validationMessage).toBe('custom error');

      control.setCustomValidity('');

      await fireEvent.input(control, { target: { value: 'good' } });

      expect(control.validationMessage).toBe('');
      expect(screen.queryByTestId('error')).toBe(null);
    });

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

    it('keeps its own message on an input that was disabled and enabled again', async () => {
      const App = defineComponent(() => {
        const disabled = shallowRef(false);

        return () => (
          <form data-testid="form">
            <Field.Root
              validationMode="onChange"
              validate={(value) => (value === 'bad' ? 'custom error' : null)}
            >
              <Field.Control data-testid="control" disabled={disabled.value} />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                disabled.value = !disabled.value;
              }}
            >
              toggle disabled
            </button>
          </form>
        );
      });

      await render(<App />);

      const control = screen.getByTestId<HTMLInputElement>('control');

      await fireEvent.input(control, { target: { value: 'bad' } });
      expect(control.validationMessage).toBe('custom error');

      await fireEvent.click(screen.getByText('toggle disabled'));
      await fireEvent.click(screen.getByText('toggle disabled'));

      expect(screen.getByTestId('error')).toHaveTextContent('custom error');
      expect(control.validationMessage).toBe('custom error');
      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(false);
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

    it('keeps a message set outside the field on another input of the same field', async () => {
      const handleValidity = vi.fn();
      let root = null as FieldRootInstance | null;

      const App = defineComponent(() => () => (
        <div>
          <Field.Root
            ref={(instance) => {
              root = instance as FieldRootInstance | null;
            }}
            validationMode="onBlur"
            validate={(value) => (value === 'cats' ? 'custom error' : null)}
          >
            <RadioGroup defaultValue="cats">
              <Radio.Root value="cats" data-testid="cats" />
              <Radio.Root value="dogs" data-testid="dogs" />
            </RadioGroup>
            <Field.Validity v-slots={{ default: handleValidity }} />
          </Field.Root>
          <button type="button" onClick={() => root?.validate()}>
            validate
          </button>
        </div>
      ));

      await render(<App />);

      const [cats, dogs] = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');

      await fireEvent.click(screen.getByText('validate'));
      expect(cats.validationMessage).toBe('custom error');

      dogs.setCustomValidity('external error');
      await fireEvent.click(screen.getByTestId('dogs'));

      expect(cats.validationMessage).toBe('');
      expect(dogs.validationMessage).toBe('external error');
      expect(handleValidity.mock.lastCall?.[0].validity.customError).toBe(true);
      expect(handleValidity.mock.lastCall?.[0].errors).toEqual(['external error']);
    });

    it.skipIf(isJSDOM)(
      'ignores a message set outside the field on a control barred from validation',
      async () => {
        const onFormSubmit = vi.fn();

        await render(
          <Form onFormSubmit={onFormSubmit}>
            <Field.Root name="field" validationMode="onChange">
              <Field.Control data-testid="control" readonly />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const control = screen.getByTestId<HTMLInputElement>('control');
        expect(control.willValidate).toBe(false);
        control.setCustomValidity('external error');

        await fireEvent.input(control, { target: { value: 'abc' } });

        expect(control).not.toHaveAttribute('data-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        await fireEvent.click(screen.getByText('submit'));

        expect(onFormSubmit).toHaveBeenCalledTimes(1);
      },
    );

    it.skipIf(isJSDOM)('does not write its own message to a barred control', async () => {
      const App = defineComponent(() => {
        const readOnly = shallowRef(true);

        return () => (
          <div>
            <Field.Root validationMode="onChange" validate={() => 'custom error'}>
              <Field.Control data-testid="control" readonly={readOnly.value} />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button
              type="button"
              onClick={() => {
                readOnly.value = false;
              }}
            >
              make editable
            </button>
          </div>
        );
      });

      await render(<App />);

      const control = screen.getByTestId<HTMLInputElement>('control');
      control.setCustomValidity('external error');

      await fireEvent.input(control, { target: { value: 'abc' } });

      expect(screen.getByTestId('error')).toHaveTextContent('custom error');

      await fireEvent.click(screen.getByText('make editable'));

      expect(control.validationMessage).toBe('external error');
    });
  });

  describe('style hooks', () => {
    describe('touched', () => {
      it('should apply [data-touched] style hook to all components when touched', async () => {
        await render(
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');
        const error = screen.queryByTestId('error');

        expect(root).not.toHaveAttribute('data-touched');
        expect(control).not.toHaveAttribute('data-touched');
        expect(label).not.toHaveAttribute('data-touched');
        expect(description).not.toHaveAttribute('data-touched');
        expect(error).toBe(null);

        await fireEvent.focusIn(control);
        await fireEvent.focusOut(control);

        expect(root).toHaveAttribute('data-touched', '');
        expect(control).toHaveAttribute('data-touched', '');
        expect(label).toHaveAttribute('data-touched', '');
        expect(description).toHaveAttribute('data-touched', '');
        expect(error).toBe(null);
      });
    });

    describe('dirty', () => {
      it('should apply [data-dirty] style hook to all components when dirty', async () => {
        await render(
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.toHaveAttribute('data-dirty');
        expect(control).not.toHaveAttribute('data-dirty');
        expect(label).not.toHaveAttribute('data-dirty');
        expect(description).not.toHaveAttribute('data-dirty');

        await fireEvent.input(control, { target: { value: 'value' } });

        expect(root).toHaveAttribute('data-dirty', '');
        expect(control).toHaveAttribute('data-dirty', '');
        expect(label).toHaveAttribute('data-dirty', '');
        expect(description).toHaveAttribute('data-dirty', '');

        await fireEvent.input(control, { target: { value: '' } });

        expect(root).not.toHaveAttribute('data-dirty');
        expect(control).not.toHaveAttribute('data-dirty');
        expect(label).not.toHaveAttribute('data-dirty');
        expect(description).not.toHaveAttribute('data-dirty');
      });

      it('should clear [data-dirty] when a null-valued control returns to its empty initial value', async () => {
        await render(
          <Field.Root data-testid="root">
            <NumberField.Root>
              <NumberField.Input data-testid="control" />
            </NumberField.Root>
          </Field.Root>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        expect(root).not.toHaveAttribute('data-dirty');

        await fireEvent.input(control, { target: { value: '5' } });
        expect(root).toHaveAttribute('data-dirty', '');

        await fireEvent.input(control, { target: { value: '' } });
        expect(root).not.toHaveAttribute('data-dirty');
      });

      it('keeps [data-dirty] on a RadioGroup when returning to the first picked value', async () => {
        const App = defineComponent(() => {
          const value = shallowRef<string | null>(null);
          return () => (
            <div>
              <Field.Root data-testid="root">
                <RadioGroup
                  value={value.value}
                  onValueChange={(next: string | null) => {
                    value.value = next;
                  }}
                >
                  <Radio.Root value="a" />
                  <Radio.Root value="b" />
                </RadioGroup>
              </Field.Root>
              <button
                type="button"
                onClick={() => {
                  value.value = 'a';
                }}
              >
                a
              </button>
              <button
                type="button"
                onClick={() => {
                  value.value = 'b';
                }}
              >
                b
              </button>
            </div>
          );
        });

        await render(<App />);
        const root = screen.getByTestId('root');

        expect(root).not.toHaveAttribute('data-dirty');

        await fireEvent.click(screen.getByText('a'));
        await waitFor(() => {
          expect(root).toHaveAttribute('data-dirty', '');
        });

        await fireEvent.click(screen.getByText('b'));
        await fireEvent.click(screen.getByText('a'));

        await waitFor(() => {
          expect(root).toHaveAttribute('data-dirty', '');
        });
      });
    });

    describe('control remount', () => {
      it('clears dirty after an empty text control returns to empty following a null-valued control', async () => {
        await render(
          <SwappableField
            data-testid="root"
            firstControl={
              <NumberField.Root>
                <NumberField.Input />
              </NumberField.Root>
            }
            secondControl={<Field.Control data-testid="control" defaultValue="" />}
          />,
        );
        const root = screen.getByTestId('root');

        await fireEvent.click(screen.getByText('swap'));
        const control = screen.getByTestId('control');
        expect(root).not.toHaveAttribute('data-dirty');

        await fireEvent.input(control, { target: { value: 'x' } });
        expect(root).toHaveAttribute('data-dirty', '');

        await fireEvent.input(control, { target: { value: '' } });
        expect(root).not.toHaveAttribute('data-dirty');
      });

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

      it('captures the baseline only once in StrictMode', async () => {
        await render(
          <Field.Root data-testid="root">
            <NumberField.Root>
              <NumberField.Input data-testid="control" />
            </NumberField.Root>
          </Field.Root>,
        );
        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        await fireEvent.input(control, { target: { value: '5' } });
        expect(root).toHaveAttribute('data-dirty', '');

        await fireEvent.input(control, { target: { value: '' } });
        expect(root).not.toHaveAttribute('data-dirty');
      });
    });

    describe('filled', () => {
      it('should apply [data-filled] style hook to all components when filled', async () => {
        await render(
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.toHaveAttribute('data-filled');
        expect(control).not.toHaveAttribute('data-filled');
        expect(label).not.toHaveAttribute('data-filled');
        expect(description).not.toHaveAttribute('data-filled');

        await fireEvent.input(control, { target: { value: 'value' } });

        expect(root).toHaveAttribute('data-filled', '');
        expect(control).toHaveAttribute('data-filled', '');
        expect(label).toHaveAttribute('data-filled', '');
        expect(description).toHaveAttribute('data-filled', '');

        await fireEvent.input(control, { target: { value: '' } });

        expect(root).not.toHaveAttribute('data-filled');
        expect(control).not.toHaveAttribute('data-filled');
        expect(label).not.toHaveAttribute('data-filled');
        expect(description).not.toHaveAttribute('data-filled');
      });

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

    describe('focused', () => {
      it('should apply [data-focused] style hook to all components when focused', async () => {
        await render(
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.toHaveAttribute('data-focused');
        expect(control).not.toHaveAttribute('data-focused');
        expect(label).not.toHaveAttribute('data-focused');
        expect(description).not.toHaveAttribute('data-focused');

        await fireEvent.focusIn(control);

        expect(root).toHaveAttribute('data-focused', '');
        expect(control).toHaveAttribute('data-focused', '');
        expect(label).toHaveAttribute('data-focused', '');
        expect(description).toHaveAttribute('data-focused', '');

        await fireEvent.focusOut(control);

        expect(root).not.toHaveAttribute('data-focused');
        expect(control).not.toHaveAttribute('data-focused');
        expect(label).not.toHaveAttribute('data-focused');
        expect(description).not.toHaveAttribute('data-focused');
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
    it('controls the dirty state', async () => {
      await render(
        <Field.Root data-testid="root" dirty>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      ['root', 'control', 'label', 'description'].forEach((part) => {
        expect(screen.getByTestId(part)).toHaveAttribute('data-dirty');
      });
    });

    it('uses the controlled dirty state for required validation', async () => {
      await render(
        <Field.Root dirty validationMode="onBlur">
          <Field.Control data-testid="control" required />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const control = screen.getByTestId('control');

      await fireEvent.focusIn(control);
      await fireEvent.focusOut(control);

      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('error')).not.toBe(null);
    });

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
    it('controls the touched state', async () => {
      await render(
        <Field.Root data-testid="root" touched>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      ['root', 'control', 'label', 'description'].forEach((part) => {
        expect(screen.getByTestId(part)).toHaveAttribute('data-touched');
      });
    });

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

  describe('prop: actionsRef', () => {
    it('validates the field when the `validate` method is called', async () => {
      let root = null as FieldRootInstance | null;

      const { user } = await render(() => (
        <div>
          <Field.Root
            name="username"
            ref={(instance) => {
              root = instance as FieldRootInstance | null;
            }}
          >
            <Field.Control defaultValue="" required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="button" onClick={() => root?.validate()}>
            validate
          </button>
        </div>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('validate'));

      expect(screen.queryByTestId('error')).not.toBe(null);
    });

    it('validates a logical field without a mounted control', async () => {
      let root = null as FieldRootInstance | null;

      const { user } = await render(() => (
        <div>
          <Field.Root
            ref={(instance) => {
              root = instance as FieldRootInstance | null;
            }}
            validate={() => 'Logical field error'}
          >
            <Field.Error />
          </Field.Root>
          <button type="button" onClick={() => root?.validate()}>
            validate
          </button>
        </div>
      ));

      await user.click(screen.getByRole('button', { name: 'validate' }));

      expect(screen.getByText('Logical field error')).toBeVisible();
    });

    it('validates the current control value when the `validate` method is called', async () => {
      const validate = vi.fn((value) => (value === 'valid' ? null : 'error'));
      let root = null as FieldRootInstance | null;

      const { user } = await render(() => (
        <div>
          <Field.Root
            ref={(instance) => {
              root = instance as FieldRootInstance | null;
            }}
            validate={validate}
          >
            <Field.Control />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="button" onClick={() => root?.validate()}>
            validate
          </button>
        </div>
      ));
      const control = screen.getByRole('textbox');

      await fireEvent.input(control, { target: { value: 'valid' } });
      await user.click(screen.getByText('validate'));

      expect(validate.mock.lastCall?.[0]).toBe('valid');
      expect(screen.queryByTestId('error')).toBe(null);
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
