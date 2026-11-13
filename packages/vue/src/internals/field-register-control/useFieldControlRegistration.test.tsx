import { expect, describe, it, onTestFinished, vi } from 'vitest';
import {
  computed,
  createSSRApp,
  defineComponent,
  KeepAlive,
  provide,
  shallowRef,
  watch,
} from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import FieldControlPart from '../../../test/fixtures/FieldControlPart.vue';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import FormScope from '../../../test/fixtures/FormScope.vue';
import { useFieldRootContext } from '../field-root-context/FieldRootContext';
import { FormContext } from '../form-context/FormContext';
import type { Errors } from '../form-context/FormContext';
import FieldControlSwap from './FieldControlSwap.test.vue';
import FieldRegistrationHydration from './FieldRegistrationHydration.test.vue';
import LazyFieldControlHydration from './LazyFieldControlHydration.test.vue';
import TwoFieldControlsHydration from './TwoFieldControlsHydration.test.vue';
import { useRegisterFieldControl } from './useRegisterFieldControl';

interface SubmittedField {
  name: string | undefined;
  value: unknown;
  valid: boolean | null;
}

interface FieldConfig {
  name: string;
  id?: string | undefined;
}

type FieldScopeInstance = InstanceType<typeof FieldScope>;

describe('useFieldControlRegistration', () => {
  const { render } = createRenderer();

  function createSubmitSpy() {
    return vi.fn<(fields: SubmittedField[]) => void>();
  }

  // The form validates its fields, so the emit has the values of the moment of the submit.
  function submit(onSubmit: ReturnType<typeof createSubmitSpy>) {
    screen.getByTestId<HTMLFormElement>('form').requestSubmit();
    return onSubmit.mock.lastCall?.[0];
  }

  // The spy takes the place of the registry of a form.
  function defineFormWithSpy() {
    const registerField = vi.fn();
    const context: FormContext = {
      errors: computed(() => ({})),
      clearErrors() {},
      elementRef: shallowRef(null),
      fields: computed(() => []),
      registerField,
      validationMode: computed(() => 'onSubmit'),
      submitCountRef: shallowRef(0),
    };
    const Form = defineComponent((_props, { slots }) => {
      provide(FormContext, context);
      return () => slots.default?.();
    });
    return { Form, registerField };
  }

  // Each field has one control. The value of the control is the name of the field.
  const Fields = defineComponent(
    (props: { fields: FieldConfig[]; onSubmit?: (fields: SubmittedField[]) => void }) => () => (
      <FormScope data-testid="form" onSubmit={props.onSubmit}>
        {props.fields.map(({ name, id }) => (
          <FieldScope key={name} name={name}>
            <FieldControlPart id={id} value={name} />
          </FieldScope>
        ))}
      </FormScope>
    ),
    { props: ['fields', 'onSubmit'] },
  );

  // A user and a developer get the active control of a field in three ways. The field commits its
  // value, the form submits its entry, and the form lists its name.
  function createActiveControlReader() {
    const field = shallowRef<FieldScopeInstance | null>(null);
    const onValidationCommit = vi.fn();
    const onSubmit = createSubmitSpy();

    function read() {
      field.value!.validate();
      return {
        committed: onValidationCommit.mock.lastCall?.[0],
        submitted: submit(onSubmit),
        fields: screen.getByTestId('form').getAttribute('data-fields'),
      };
    }

    return { field, onValidationCommit, onSubmit, read };
  }

  function active(name: string, value = name) {
    return { committed: value, submitted: [{ name, value, valid: true }], fields: name };
  }

  // `validate` commits the last value of the validity data when the field has no control. The read
  // of that state does not include the commit.
  const NO_ACTIVE = { submitted: [], fields: '' };

  describe('the name of the control', () => {
    it('gives the field the name of its control, so a form error for that name makes the field invalid', async () => {
      await render(
        <FormScope errors={{ a: 'taken' }}>
          <FieldScope data-testid="root">
            <FieldControlPart id="control" name="a" />
          </FieldScope>
        </FormScope>,
      );

      expect(screen.getByTestId('root')).toHaveAttribute('data-invalid');
    });

    it('gives the field the name of the root, and not the name of the control, when both have one', async () => {
      const field = shallowRef<FieldScopeInstance | null>(null);
      const Test = defineComponent(
        (props: { errors: Errors }) => () => (
          <FormScope data-testid="form" errors={props.errors}>
            <FieldScope ref={field} name="root-name" data-testid="root">
              <FieldControlPart id="control" name="control-name" />
            </FieldScope>
          </FormScope>
        ),
        { props: ['errors'] },
      );
      const { rerender } = await render(<Test errors={{ 'control-name': 'taken' }} />);

      expect(field.value!.registeredFieldName).toBeUndefined();
      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'root-name');
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');

      await rerender(<Test errors={{ 'root-name': 'taken' }} />);

      expect(screen.getByTestId('root')).toHaveAttribute('data-invalid');
    });

    it('removes the name of the control from the field when the control goes away', async () => {
      const shown = shallowRef(true);
      const Test = defineComponent(() => () => (
        <FormScope errors={{ a: 'taken' }}>
          <FieldScope data-testid="root">
            {shown.value && <FieldControlPart id="control" name="a" />}
          </FieldScope>
        </FormScope>
      ));
      await render(<Test />);
      expect(screen.getByTestId('root')).toHaveAttribute('data-invalid');

      shown.value = false;
      await flushMicrotasks();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
    });
  });

  describe('validate', () => {
    const ControlWithGetValue = defineComponent(
      (props: { value?: string }) => {
        const element = shallowRef<HTMLElement | null>(null);
        useRegisterFieldControl(
          element,
          () => 'control',
          () => props.value,
          () => 'from getValue',
        );
        return () => <input ref={element} />;
      },
      { props: ['value'] },
    );

    it('commits the value of the control', async () => {
      const onValidationCommit = vi.fn();
      const field = shallowRef<FieldScopeInstance | null>(null);
      await render(() => (
        <FieldScope ref={field} onValidationCommit={onValidationCommit}>
          <FieldControlPart id="control" value="x" />
        </FieldScope>
      ));

      field.value!.validate();

      expect(onValidationCommit).toHaveBeenCalledTimes(1);
      expect(onValidationCommit).toHaveBeenCalledWith('x');
    });

    it('marks the field dirty, so an empty value is invalid', async () => {
      const field = shallowRef<FieldScopeInstance | null>(null);
      await render(() => (
        <FieldScope ref={field} data-testid="root">
          <FieldControlPart id="control" value="" />
        </FieldScope>
      ));
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');

      field.value!.validate();
      await flushMicrotasks();

      expect(screen.getByTestId('root')).toHaveAttribute('data-invalid');
    });

    it('commits the result of `getValue` when the control has no value', async () => {
      const onValidationCommit = vi.fn();
      const field = shallowRef<FieldScopeInstance | null>(null);
      await render(() => (
        <FieldScope ref={field} onValidationCommit={onValidationCommit}>
          <ControlWithGetValue />
        </FieldScope>
      ));

      field.value!.validate();

      expect(onValidationCommit).toHaveBeenCalledWith('from getValue');
    });

    it('uses the result of `getValue` for the form, and the value for `validate` and for the initial value, when the control has a value and `getValue`', async () => {
      const onSubmit = createSubmitSpy();
      const onValidationCommit = vi.fn();
      const field = shallowRef<FieldScopeInstance | null>(null);
      await render(
        <FormScope data-testid="form" onSubmit={onSubmit}>
          <FieldScope ref={field} name="a" onValidationCommit={onValidationCommit}>
            <ControlWithGetValue value="raw" />
          </FieldScope>
        </FormScope>,
      );
      expect(field.value!.validityData.initialValue).toBe('raw');

      expect(submit(onSubmit)).toEqual([{ name: 'a', value: 'from getValue', valid: true }]);
      expect(onValidationCommit).toHaveBeenCalledTimes(1);
      expect(onValidationCommit).toHaveBeenCalledWith('raw');
    });

    it('commits the value of the validity data when the field has no control', async () => {
      const onValidationCommit = vi.fn();
      const field = shallowRef<FieldScopeInstance | null>(null);
      const shown = shallowRef(true);
      await render(() => (
        <FieldScope ref={field} onValidationCommit={onValidationCommit}>
          {shown.value && <FieldControlPart id="control" value="x" />}
        </FieldScope>
      ));
      field.value!.validate();
      onValidationCommit.mockClear();

      shown.value = false;
      await flushMicrotasks();
      field.value!.validate();

      expect(onValidationCommit).toHaveBeenCalledTimes(1);
      expect(onValidationCommit).toHaveBeenCalledWith('x');
    });
  });

  describe('the initial value', () => {
    function setup() {
      const state = shallowRef({ shown: true, replaced: false, value: 'a' });
      const field = shallowRef<FieldScopeInstance | null>(null);
      const Test = defineComponent(() => () => (
        <FieldScope ref={field}>
          {state.value.shown &&
            (state.value.replaced ? (
              <FieldControlPart key="second" id="second" value={state.value.value} />
            ) : (
              <FieldControlPart key="first" id="first" value={state.value.value} />
            ))}
        </FieldScope>
      ));
      return { state, field, Test };
    }

    it('is the value of the control at its first registration', async () => {
      const { field, Test } = setup();

      await render(<Test />);

      expect(field.value!.validityData.initialValue).toBe('a');
    });

    it('stays when the value of the control changes', async () => {
      const { state, field, Test } = setup();
      await render(<Test />);

      state.value = { ...state.value, value: 'b' };
      await flushMicrotasks();

      expect(field.value!.validityData.initialValue).toBe('a');
    });

    it('stays when another control replaces the control', async () => {
      const { state, field, Test } = setup();
      await render(<Test />);

      state.value = { ...state.value, replaced: true, value: 'b' };
      await flushMicrotasks();

      expect(field.value!.validityData.initialValue).toBe('a');
    });

    it('stays when the control mounts again', async () => {
      const { state, field, Test } = setup();
      await render(<Test />);

      state.value = { ...state.value, shown: false };
      await flushMicrotasks();
      state.value = { ...state.value, shown: true, value: 'b' };
      await flushMicrotasks();

      expect(field.value!.validityData.initialValue).toBe('a');
    });
  });

  describe('the work of a replaced control', () => {
    function setup() {
      const state = shallowRef({ shown: true, disabled: false, other: false });
      const onValidationChange = vi.fn();
      const Test = defineComponent(() => () => (
        <FieldScope onValidationChange={onValidationChange}>
          {state.value.shown && (
            <FieldControlPart id="first" value="first" disabled={state.value.disabled} />
          )}
          {state.value.other && <FieldControlPart id="other" value="other" />}
        </FieldScope>
      ));
      return { state, onValidationChange, Test };
    }

    it('is not dropped at the first registration', async () => {
      const { onValidationChange, Test } = setup();

      await render(<Test />);

      expect(onValidationChange).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'goes away', change: { shown: false } },
      { name: 'gets disabled', change: { disabled: true } },
      { name: 'is replaced by another control', change: { other: true } },
    ])('is dropped when the active control $name', async ({ change }) => {
      const { state, onValidationChange, Test } = setup();
      await render(<Test />);

      state.value = { ...state.value, ...change };
      await flushMicrotasks();

      expect(onValidationChange).toHaveBeenCalledTimes(1);
      expect(onValidationChange).toHaveBeenCalledWith(undefined, true);
    });

    it('is dropped before the control that becomes active starts its work', async () => {
      const onValidationChange = vi.fn();
      // The control starts its work after the DOM update of its change.
      const ControlWithWork = defineComponent(
        (props: { id: string; value: string }) => {
          const { validation } = useFieldRootContext();
          const element = shallowRef<HTMLElement | null>(null);
          useRegisterFieldControl(
            element,
            () => props.id,
            () => props.value,
          );
          watch(
            () => props.value,
            (value) => validation.change(value),
            { flush: 'post' },
          );
          return () => <input ref={element} />;
        },
        { props: ['id', 'value'] },
      );
      const Test = defineComponent(
        (props: { first: string }) => () => (
          <FieldScope onValidationChange={onValidationChange}>
            <ControlWithWork id="first" value={props.first} />
            <ControlWithWork id="second" value="second" />
          </FieldScope>
        ),
        { props: ['first'] },
      );
      const { rerender } = await render(<Test first="first" />);
      expect(onValidationChange).not.toHaveBeenCalled();

      await rerender(<Test first="first changed" />);

      expect(onValidationChange.mock.calls).toEqual([
        [undefined, true],
        ['first changed', false],
      ]);
    });
  });

  describe('more than one control in one field', () => {
    interface ControlState {
      value: string;
      disabled: boolean;
      shown: boolean;
    }

    // The field has no name, so it takes the name of its active control. Each control has its `id`
    // as its name and as its first value.
    function setup(ids: string[], initial: Record<string, Partial<ControlState>> = {}) {
      const state = shallowRef<Record<string, ControlState>>(
        Object.fromEntries(
          ids.map((id) => [id, { value: id, disabled: false, shown: true, ...initial[id] }]),
        ),
      );
      const { field, onValidationCommit, onSubmit, read } = createActiveControlReader();
      const Test = defineComponent(() => () => (
        <FormScope data-testid="form" onSubmit={onSubmit}>
          <FieldScope ref={field} onValidationCommit={onValidationCommit}>
            {ids.map(
              (id) =>
                state.value[id].shown && (
                  <FieldControlPart
                    key={id}
                    id={id}
                    name={id}
                    value={state.value[id].value}
                    disabled={state.value[id].disabled}
                  />
                ),
            )}
          </FieldScope>
        </FormScope>
      ));

      async function update(id: string, change: Partial<ControlState>) {
        state.value = { ...state.value, [id]: { ...state.value[id], ...change } };
        await flushMicrotasks();
      }

      return { Test, update, read };
    }

    it('has the control that mounts last as the active control', async () => {
      const { Test, read } = setup(['first', 'second']);

      await render(<Test />);

      expect(read()).toEqual(active('second'));
    });

    it('has the control that changes last as the active control', async () => {
      const { Test, update, read } = setup(['first', 'second']);
      await render(<Test />);

      await update('first', { value: 'first changed' });
      expect(read()).toEqual(active('first', 'first changed'));

      await update('second', { value: 'second changed' });
      expect(read()).toEqual(active('second', 'second changed'));
    });

    it('does not use a disabled control, and uses it again when it is enabled', async () => {
      const { Test, update, read } = setup(['first', 'second']);
      await render(<Test />);

      await update('second', { disabled: true });
      expect(read()).toEqual(active('first'));

      // The change of `first` shows that the change of `enabled` makes `second` active again.
      await update('first', { value: 'first changed' });
      await update('second', { disabled: false });
      expect(read()).toEqual(active('second'));
    });

    it('does not use a control that mounts disabled', async () => {
      const { Test, read } = setup(['first', 'second'], { second: { disabled: true } });

      await render(<Test />);

      expect(read()).toEqual(active('first'));
    });

    describe('VUE-10: the control that was active before', () => {
      it.each([
        { name: 'goes away', change: { shown: false } },
        { name: 'gets `enabled` false', change: { disabled: true } },
      ])(
        'uses the control that was active before when the active control $name',
        async ({ change }) => {
          const { Test, update, read } = setup(['first', 'second']);
          await render(<Test />);
          expect(read()).toEqual(active('second'));

          await update('second', change);
          expect(read()).toEqual(active('first'));

          await update('first', change);
          expect(read()).toMatchObject(NO_ACTIVE);
        },
      );

      it('uses the control that registered last among the controls that are there, with three controls', async () => {
        const { Test, update, read } = setup(['a', 'b', 'c']);
        await render(<Test />);
        expect(read()).toEqual(active('c'));

        await update('a', { value: 'a changed' });
        expect(read()).toEqual(active('a', 'a changed'));

        await update('b', { value: 'b changed' });
        expect(read()).toEqual(active('b', 'b changed'));

        await update('b', { shown: false });
        expect(read()).toEqual(active('a', 'a changed'));

        await update('a', { disabled: true });
        expect(read()).toEqual(active('c'));

        await update('c', { shown: false });
        expect(read()).toMatchObject(NO_ACTIVE);

        await update('a', { disabled: false });
        expect(read()).toEqual(active('a', 'a changed'));
      });
    });
  });

  describe('the form', () => {
    it('lists a field with its name and its value after the mount', async () => {
      const onSubmit = createSubmitSpy();
      await render(<Fields fields={[{ name: 'a', id: 'a' }]} onSubmit={onSubmit} />);

      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'a');
      expect(submit(onSubmit)).toEqual([{ name: 'a', value: 'a', valid: true }]);
    });

    it('does not list a field whose control has no `id`', async () => {
      await render(<Fields fields={[{ name: 'a', id: undefined }]} />);

      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', '');
    });

    it('does not list a field whose control goes away', async () => {
      const shown = shallowRef(true);
      const Test = defineComponent(() => () => (
        <FormScope data-testid="form">
          <FieldScope name="a">{shown.value && <FieldControlPart id="a" value="a" />}</FieldScope>
        </FormScope>
      ));
      await render(<Test />);
      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'a');

      shown.value = false;
      await flushMicrotasks();

      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', '');
    });

    it('removes the entry of a field that goes away', async () => {
      const { Form, registerField } = defineFormWithSpy();
      const shown = shallowRef(true);
      const Test = defineComponent(() => () => (
        <Form>
          {shown.value && (
            <FieldScope name="a">
              <FieldControlPart id="a" value="a" />
            </FieldScope>
          )}
        </Form>
      ));
      await render(<Test />);
      expect(registerField).toHaveBeenCalledTimes(1);
      const source = registerField.mock.calls[0][0];

      shown.value = false;
      await flushMicrotasks();

      expect(registerField).toHaveBeenCalledTimes(2);
      expect(registerField).toHaveBeenLastCalledWith(source, undefined);
    });

    it('works with no form around the field', async () => {
      await render(
        <FieldScope name="a" data-testid="root">
          <FieldControlPart id="a" value="a" />
        </FieldScope>,
      );

      expect(screen.getByTestId('root')).toBeInTheDocument();
      expect(takeReportedMessages()).toEqual([]);
    });
  });

  describe('the order of the fields', () => {
    const abc = [
      { name: 'a', id: 'a' },
      { name: 'b', id: 'b' },
      { name: 'c', id: 'c' },
    ];

    it('is the order of the document', async () => {
      await render(<Fields fields={abc} />);

      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'a b c');
    });

    it('has a field that mounts later last', async () => {
      const { rerender } = await render(<Fields fields={abc} />);

      await rerender(<Fields fields={[{ name: 'first', id: 'first' }, ...abc]} />);

      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'a b c first');
    });

    it('keeps the place of a field when the `id` of its control changes', async () => {
      const { rerender } = await render(<Fields fields={abc} />);

      await rerender(<Fields fields={[abc[0], { name: 'b', id: 'other' }, abc[2]]} />);

      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'a b c');
    });

    it('keeps the place of a field when a control that comes before the old control replaces it, and submits the value of the new control', async () => {
      const onSubmit = createSubmitSpy();
      const { rerender } = await render(<FieldControlSwap swapped={false} onSubmit={onSubmit} />);
      expect(submit(onSubmit)?.map(({ value }) => value)).toEqual(['first', 'old', 'last']);

      await rerender(<FieldControlSwap swapped onSubmit={onSubmit} />);

      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'a b c');
      expect(submit(onSubmit)?.map(({ value }) => value)).toEqual(['first', 'new', 'last']);
    });
  });

  describe('an entry of the form', () => {
    it('has `valid` false when the field has the `invalid` prop', async () => {
      const onSubmit = createSubmitSpy();
      await render(
        <FormScope data-testid="form" onSubmit={onSubmit}>
          <FieldScope name="a" invalid>
            <FieldControlPart id="a" value="x" />
          </FieldScope>
        </FormScope>,
      );

      expect(submit(onSubmit)).toEqual([{ name: 'a', value: 'x', valid: false }]);
    });

    it.each([
      { name: 'an empty value', value: '', valid: false },
      { name: 'a value', value: 'x', valid: true },
    ])('has `valid` $valid after a submit with $name', async ({ value, valid }) => {
      const onSubmit = createSubmitSpy();
      await render(
        <FormScope data-testid="form" onSubmit={onSubmit}>
          <FieldScope name="a">
            <FieldControlPart id="a" value={value} />
          </FieldScope>
        </FormScope>,
      );

      expect(submit(onSubmit)).toEqual([{ name: 'a', value, valid }]);
    });
  });

  describe('under `KeepAlive`', () => {
    it('does not list, validate or submit the fields of a hidden branch, and lists them in their first order after the show', async () => {
      const commits = { a: vi.fn(), b: vi.fn(), c: vi.fn(), d: vi.fn() };
      const onSubmit = createSubmitSpy();
      // The branch has two fields, and a field that stays comes before and after it.
      const Branch = defineComponent(() => () => (
        <>
          <FieldScope name="b" onValidationCommit={commits.b}>
            <FieldControlPart id="b" value="b" />
          </FieldScope>
          <FieldScope name="c" onValidationCommit={commits.c}>
            <FieldControlPart id="c" value="c" />
          </FieldScope>
        </>
      ));
      const Test = defineComponent(
        (props: { shown: boolean }) => () => (
          <FormScope data-testid="form" onSubmit={onSubmit}>
            <FieldScope name="a" onValidationCommit={commits.a}>
              <FieldControlPart id="a" value="a" />
            </FieldScope>
            <KeepAlive>{props.shown ? <Branch /> : null}</KeepAlive>
            <FieldScope name="d" onValidationCommit={commits.d}>
              <FieldControlPart id="d" value="d" />
            </FieldScope>
          </FormScope>
        ),
        { props: ['shown'] },
      );
      const { rerender } = await render(<Test shown />);
      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'a b c d');

      await rerender(<Test shown={false} />);

      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'a d');
      expect(submit(onSubmit)).toEqual([
        { name: 'a', value: 'a', valid: true },
        { name: 'd', value: 'd', valid: true },
      ]);
      expect(commits.a).toHaveBeenCalledTimes(1);
      expect(commits.d).toHaveBeenCalledTimes(1);
      expect(commits.b).not.toHaveBeenCalled();
      expect(commits.c).not.toHaveBeenCalled();

      await rerender(<Test shown />);

      expect(screen.getByTestId('form')).toHaveAttribute('data-fields', 'a b c d');
    });

    function setupFirstControlInKeepAlive() {
      const { field, onValidationCommit, onSubmit, read } = createActiveControlReader();
      const Test = defineComponent(
        (props: { shown: boolean; first: string; second: string }) => () => (
          <FormScope data-testid="form" onSubmit={onSubmit}>
            <FieldScope ref={field} onValidationCommit={onValidationCommit}>
              <KeepAlive>
                {props.shown ? (
                  <FieldControlPart key="first" id="first" name="first" value={props.first} />
                ) : null}
              </KeepAlive>
              <FieldControlPart id="second" name="second" value={props.second} />
            </FieldScope>
          </FormScope>
        ),
        { props: ['shown', 'first', 'second'] },
      );
      return { Test, read };
    }

    it('VUE-10: uses the other control while `KeepAlive` has the active control, and the same control again when it comes back', async () => {
      const { Test, read } = setupFirstControlInKeepAlive();
      const { rerender } = await render(<Test shown first="first" second="second" />);

      await rerender(<Test shown first="first changed" second="second" />);
      expect(read()).toEqual(active('first', 'first changed'));

      await rerender(<Test shown={false} first="first changed" second="second" />);
      expect(read()).toEqual(active('second'));

      await rerender(<Test shown first="first changed" second="second" />);
      expect(read()).toEqual(active('first', 'first changed'));
    });

    it('keeps the other control active when it changes while `KeepAlive` has the control that was active', async () => {
      const { Test, read } = setupFirstControlInKeepAlive();
      const { rerender } = await render(<Test shown first="first" second="second" />);
      await rerender(<Test shown first="first changed" second="second" />);
      await rerender(<Test shown={false} first="first changed" second="second" />);

      await rerender(<Test shown={false} first="first changed" second="second changed" />);
      expect(read()).toEqual(active('second', 'second changed'));

      await rerender(<Test shown first="first changed" second="second changed" />);
      expect(read()).toEqual(active('second', 'second changed'));
    });

    it.each([
      {
        name: 'the first control',
        firstValue: 'first changed',
        expected: active('first', 'first changed'),
      },
      { name: 'the second control', firstValue: 'first', expected: active('second') },
    ])(
      'keeps $name active when `KeepAlive` hides the two controls of a field and shows them again',
      async ({ firstValue, expected }) => {
        const { field, onValidationCommit, onSubmit, read } = createActiveControlReader();
        const Controls = defineComponent(
          (props: { first: string }) => () => (
            <>
              <FieldControlPart id="first" name="first" value={props.first} />
              <FieldControlPart id="second" name="second" value="second" />
            </>
          ),
          { props: ['first'] },
        );
        const Test = defineComponent(
          (props: { shown: boolean; first: string }) => () => (
            <FormScope data-testid="form" onSubmit={onSubmit}>
              <FieldScope ref={field} onValidationCommit={onValidationCommit}>
                <KeepAlive>{props.shown ? <Controls first={props.first} /> : null}</KeepAlive>
              </FieldScope>
            </FormScope>
          ),
          { props: ['shown', 'first'] },
        );
        const { rerender } = await render(<Test shown first="first" />);
        await rerender(<Test shown first={firstValue} />);
        expect(read()).toEqual(expected);

        await rerender(<Test shown={false} first={firstValue} />);
        expect(read()).toMatchObject(NO_ACTIVE);

        await rerender(<Test shown first={firstValue} />);
        expect(read()).toEqual(expected);
      },
    );

    it('has the control that `KeepAlive` shows as the active control, and the first control again after the swap back', async () => {
      const onSubmit = createSubmitSpy();
      // Each control has its own key, so `KeepAlive` keeps both controls and deactivates the one
      // that the other control replaces.
      const Test = defineComponent(
        (props: { swapped: boolean }) => () => (
          <FormScope data-testid="form" onSubmit={onSubmit}>
            <FieldScope name="a">
              <KeepAlive>
                {props.swapped ? (
                  <FieldControlPart key="second" id="second" value="second" />
                ) : (
                  <FieldControlPart key="first" id="first" value="first" />
                )}
              </KeepAlive>
            </FieldScope>
          </FormScope>
        ),
        { props: ['swapped'] },
      );
      const { rerender } = await render(<Test swapped={false} />);
      expect(submit(onSubmit)?.[0].value).toBe('first');

      await rerender(<Test swapped />);
      expect(submit(onSubmit)?.[0].value).toBe('second');

      await rerender(<Test swapped={false} />);

      expect(submit(onSubmit)?.[0].value).toBe('first');
    });

    it('drops the work of the active control when `KeepAlive` deactivates the control', async () => {
      const onValidationChange = vi.fn();
      const Test = defineComponent(
        (props: { shown: boolean }) => () => (
          <FieldScope onValidationChange={onValidationChange}>
            <KeepAlive>{props.shown ? <FieldControlPart id="a" value="a" /> : null}</KeepAlive>
          </FieldScope>
        ),
        { props: ['shown'] },
      );
      const { rerender } = await render(<Test shown />);
      expect(onValidationChange).not.toHaveBeenCalled();

      await rerender(<Test shown={false} />);

      expect(onValidationChange).toHaveBeenCalledTimes(1);
      expect(onValidationChange).toHaveBeenCalledWith(undefined, true);

      await rerender(<Test shown />);

      expect(onValidationChange).toHaveBeenCalledTimes(1);
    });

    it('removes the entry of a field that `KeepAlive` drops while the field is hidden', async () => {
      const { Form, registerField } = defineFormWithSpy();
      const key = shallowRef('first');
      const Field = defineComponent(() => () => (
        <FieldScope name="a">
          <FieldControlPart id="a" value="a" />
        </FieldScope>
      ));
      // Each field has its own key, so `KeepAlive` keeps the field that the next field replaces.
      const Test = defineComponent(() => () => (
        <Form>
          <KeepAlive max={2}>
            <Field key={key.value} />
          </KeepAlive>
        </Form>
      ));
      await render(<Test />);
      const firstSource = registerField.mock.calls[0][0];

      key.value = 'second';
      await flushMicrotasks();
      key.value = 'third';
      await flushMicrotasks();

      // `KeepAlive` keeps two fields. It drops the oldest field, which is hidden.
      const removals = registerField.mock.calls.filter(([, getField]) => getField === undefined);
      expect(removals).toEqual([[firstSource, undefined]]);
    });
  });

  describe('server HTML and hydration', () => {
    const FILE = 'src/internals/field-register-control/FieldRegistrationHydration.test.vue';
    const LAZY_FILE = 'src/internals/field-register-control/LazyFieldControlHydration.test.vue';
    const TWO_CONTROLS_FILE =
      'src/internals/field-register-control/TwoFieldControlsHydration.test.vue';
    const ALL_INVALID = { root: true, before: true, after: true };
    const NONE_INVALID = { root: false, before: false, after: false };

    // A `<template>` element parses the HTML with no side effect.
    function parse(html: string) {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content;
    }

    function read(root: ParentNode) {
      const has = (testId: string, attribute: string) =>
        root.querySelector(`[data-testid="${testId}"]`)?.hasAttribute(attribute);
      return {
        invalid: {
          root: has('root', 'data-invalid'),
          before: has('before', 'data-invalid'),
          after: has('after', 'data-invalid'),
        },
        error: root.querySelector('[data-testid="error"]') !== null,
        fields: root.querySelector('[data-testid="form"]')?.getAttribute('data-fields'),
      };
    }

    it.each([
      {
        name: 'the name of a control',
        props: { controlName: 'a', errors: { a: 'taken' } },
        server: { invalid: NONE_INVALID, error: false, fields: '' },
        hydrated: { invalid: ALL_INVALID, error: true, fields: 'a' },
      },
      {
        name: 'the name of a root',
        props: { rootName: 'a', errors: { a: 'taken' } },
        server: { invalid: ALL_INVALID, error: true, fields: '' },
        hydrated: { invalid: ALL_INVALID, error: true, fields: 'a' },
      },
    ])(
      'renders the state of a form error for $name in the server HTML and after the hydration',
      async ({ props, server, hydrated }) => {
        const serverHtml = await renderOnServer(FILE, props);

        expect(read(parse(serverHtml))).toEqual(server);

        const { container } = await hydrate(FieldRegistrationHydration, { serverHtml, props });

        expect(read(container)).toEqual(hydrated);
      },
    );

    it.each([
      {
        name: 'an error for the name of the second control',
        errors: { b: 'taken' },
        hydrated: { invalid: { root: true }, error: true, fields: 'b' },
      },
      {
        name: 'an error for the name of the first control',
        errors: { a: 'taken' },
        hydrated: { invalid: { root: false }, error: false, fields: 'b' },
      },
    ])(
      'has no active control in the server HTML, and the control that mounts last after the hydration: $name',
      async ({ errors, hydrated }) => {
        const props = { errors };
        const serverHtml = await renderOnServer(TWO_CONTROLS_FILE, props);

        expect(read(parse(serverHtml))).toMatchObject({
          invalid: { root: false },
          error: false,
          fields: '',
        });

        const { container } = await hydrate(TwoFieldControlsHydration, { serverHtml, props });

        expect(read(container)).toMatchObject(hydrated);
      },
    );

    // The browser loads the lazy control one time for each page, so this is the only case of the
    // file that uses `LazyFieldControlHydration`.
    it('hydrates a lazy control with no mismatch, then gives the field the name of the control', async () => {
      const props = { controlName: 'a', errors: { a: 'taken' } };
      // A server has the module of a lazy component after its first render. A browser loads the
      // module later, so only a later render of the server shows what a browser does.
      await renderOnServer(LAZY_FILE, props);
      const serverHtml = await renderOnServer(LAZY_FILE, props);
      // The `hydrate` helper waits two ticks. A control in `<Suspense>` hydrates later than that,
      // so the test hydrates by hand and waits for the error.
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;
      const root = within(container).getByTestId('root');

      const app = createSSRApp(LazyFieldControlHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitFor(() => {
        expect(within(container).getByTestId('error')).toBeInTheDocument();
      });
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(within(container).getByTestId('root')).toBe(root);
      expect(read(container)).toEqual({ invalid: ALL_INVALID, error: true, fields: 'a' });
      expect(takeReportedMessages()).toEqual([]);
    });
  });
});
