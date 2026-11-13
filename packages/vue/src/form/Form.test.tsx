import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, ref, shallowRef, Teleport } from 'vue';
import type { FormHTMLAttributes } from 'vue';
import { Form } from '@vase-ui/vue/form';
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
