import { expect, describe, it } from 'vitest';
import { defineComponent, provide } from 'vue';
import { createRenderer, hydrate, renderOnServer, screen, takeReportedMessages } from '#test-utils';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import { DEFAULT_VALIDITY_STATE } from '../field-constants/constants';
import {
  DEFAULT_FIELD_ROOT_CONTEXT,
  FieldRootContext,
  useFieldRootContext,
} from './FieldRootContext';
import FieldStateHydration from './FieldStateHydration.test.vue';

describe('FieldRootContext', () => {
  const { render } = createRenderer();

  function defineProbe(optional = true) {
    let field: FieldRootContext | undefined;
    const Probe = defineComponent(() => {
      field = useFieldRootContext(optional);
      return () => null;
    });
    return { Probe, getField: () => field! };
  }

  const MaskField = defineComponent((_props, { slots }) => {
    provide(FieldRootContext, null);
    return () => slots.default?.();
  });

  function readValues(field: FieldRootContext) {
    return {
      invalid: field.invalid.value,
      name: field.name.value,
      disabled: field.disabled.value,
      validityData: field.validityData.value,
      validationMode: field.validationMode.value,
      shouldValidateOnChange: field.shouldValidateOnChange(),
      state: field.state.value,
      inputRef: field.validation.inputRef.value,
      registeredInputs: field.validation.registeredInputs.size,
    };
  }

  it('gives a part with no field the default value of each member', async () => {
    const { Probe, getField } = defineProbe();
    await render(<Probe />);

    const field = getField();
    expect(field.invalid.value).toBeUndefined();
    expect(field.name.value).toBeUndefined();
    expect(field.disabled.value).toBeUndefined();
    expect(field.validityData.value).toEqual({
      state: DEFAULT_VALIDITY_STATE,
      errors: [],
      error: '',
      value: '',
      initialValue: null,
    });
    expect(field.validationMode.value).toBe('onSubmit');
    expect(field.state.value).toEqual({
      disabled: false,
      touched: false,
      dirty: false,
      valid: null,
      filled: false,
      focused: false,
    });
    expect(field.setFocusOwner(Symbol(), true)).toBe(false);
    expect(field.shouldValidateOnChange()).toBe(false);
  });

  it('does nothing when a part calls a function of the default context', async () => {
    const { Probe, getField } = defineProbe();
    await render(<Probe />);
    const field = getField();
    const before = structuredClone(readValues(field));
    const input = document.createElement('input');
    const props = { id: 'control' };

    field.setValidityData({ ...field.validityData.value, error: 'error', value: 'value' });
    field.setTouched(true);
    field.setDirty(true);
    field.setFilled(true);
    field.setFocused(true);
    field.registerFieldControl(Symbol(), () => ({ controlRef: input, id: 'control', value: 'x' }));
    field.validation.setFieldInput(Symbol(), input);
    field.validation.registerInput(input, { controlRef: input, value: 'x' });
    field.validation.change('x');

    expect(readValues(field)).toEqual(before);
    expect(field.validation.inputRef.value).toBeNull();
    expect(field.validation.registeredInputs.size).toBe(0);
    expect(field.validation.getValidationProps(false, props)).toBe(props);
    expect(field.validation.getInputControl()).toBeNull();
    await expect(field.validation.commit('x')).resolves.toBeUndefined();
  });

  it('gives a part in a field the context of that field', async () => {
    const { Probe, getField } = defineProbe(false);
    const field = { ...DEFAULT_FIELD_ROOT_CONTEXT };
    const Provider = defineComponent(() => {
      provide(FieldRootContext, field);
      return () => <Probe />;
    });

    await render(<Provider />);

    expect(getField()).toBe(field);
  });

  it('gives a part the default context when a nearer provider masks the field', async () => {
    const { Probe, getField } = defineProbe();
    await render(
      <FieldScope>
        <MaskField>
          <Probe />
        </MaskField>
      </FieldScope>,
    );

    expect(getField()).toBe(DEFAULT_FIELD_ROOT_CONTEXT);
  });

  it('renders the parts before a control again when the control writes the state in `setup`', async () => {
    await render(<FieldStateHydration value="x" />);

    expect(screen.getByTestId('root')).toHaveAttribute('data-filled');
    expect(screen.getByTestId('before')).toHaveAttribute('data-filled');
    expect(screen.getByTestId('after')).toHaveAttribute('data-filled');
  });

  describe('server HTML and hydration', () => {
    const FILE = 'src/internals/field-root-context/FieldStateHydration.test.vue';

    // A `<template>` element parses the HTML with no side effect.
    function parse(html: string) {
      const template = document.createElement('template');
      template.innerHTML = html;
      return template.content;
    }

    function readStateAttributes(root: ParentNode) {
      return Object.fromEntries(
        ['root', 'before', 'after'].map((testId) => {
          const element = root.querySelector(`[data-testid="${testId}"]`);
          const names = Array.from(element?.attributes ?? [], ({ name }) => name);
          return [testId, names.filter((name) => name !== 'data-testid').sort()];
        }),
      );
    }

    it.each([
      {
        name: 'a control that has a value',
        props: { value: 'x' },
        server: { root: [], before: [], after: ['data-filled'] },
        hydrated: { root: ['data-filled'], before: ['data-filled'], after: ['data-filled'] },
      },
      {
        name: 'the `invalid` prop',
        props: { invalid: true },
        server: { root: ['data-invalid'], before: ['data-invalid'], after: ['data-invalid'] },
        hydrated: { root: ['data-invalid'], before: ['data-invalid'], after: ['data-invalid'] },
      },
      {
        name: 'no state',
        props: {},
        server: { root: [], before: [], after: [] },
        hydrated: { root: [], before: [], after: [] },
      },
    ])(
      'renders the state attributes of a field with $name in the server HTML and after the hydration',
      async ({ props, server, hydrated }) => {
        const serverHtml = await renderOnServer(FILE, props);

        expect(readStateAttributes(parse(serverHtml))).toEqual(server);

        const { container } = await hydrate(FieldStateHydration, { serverHtml, props });

        expect(readStateAttributes(container)).toEqual(hydrated);
      },
    );
  });

  // These cases are the last ones of the file. In Vue 3.5.12, a `setup` that throws leaves the
  // current instance set, and a later case of the file can then get a warning about a slot. So
  // the case with slots comes first.
  describe('useFieldRootContext(false)', () => {
    const message =
      'Vase UI: A part of Field must be inside <Field.Root>. Without a root the part has no field state to read. Put the part inside <Field.Root>.';

    it('throws when a nearer provider masks the field', async () => {
      const { Probe } = defineProbe(false);

      await expect(
        render(
          <FieldScope>
            <MaskField>
              <Probe />
            </MaskField>
          </FieldScope>,
        ),
      ).rejects.toThrow(message);

      // Vue also warns about the error of `setup`.
      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('Unhandled error during execution of setup function'),
      ]);
    });

    it('throws when there is no field', async () => {
      const { Probe } = defineProbe(false);

      await expect(render(<Probe />)).rejects.toThrow(message);

      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('Unhandled error during execution of setup function'),
      ]);
    });
  });
});
