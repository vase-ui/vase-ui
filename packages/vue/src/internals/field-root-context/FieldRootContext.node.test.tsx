import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { DEFAULT_VALIDITY_STATE } from '../field-constants/constants';
import { useFormContext } from '../form-context/FormContext';
import type { FormContext } from '../form-context/FormContext';
import { DEFAULT_FIELD_ROOT_CONTEXT, useFieldRootContext } from './FieldRootContext';
import type { FieldRootContext } from './FieldRootContext';
import FieldStateHydration from './FieldStateHydration.test.vue';
import { useSetFieldFocused } from './useSetFieldFocused';

describe('field and form contexts on a server', () => {
  const DEFAULT_FIELD_VALUES = {
    validityData: {
      state: DEFAULT_VALIDITY_STATE,
      errors: [],
      error: '',
      value: '',
      initialValue: null,
    },
    validationMode: 'onSubmit',
    shouldValidateOnChange: false,
    state: {
      disabled: false,
      touched: false,
      dirty: false,
      valid: null,
      filled: false,
      focused: false,
    },
    focusOwnerRef: null,
    inputRef: null,
    registeredInputs: 0,
  };

  const DEFAULT_FORM_VALUES = {
    errors: {},
    fields: [],
    elementRef: null,
    validationMode: 'onSubmit',
    submitCountRef: 0,
  };

  function readFieldValues(field: FieldRootContext) {
    return {
      invalid: field.invalid.value,
      name: field.name.value,
      disabled: field.disabled.value,
      validityData: field.validityData.value,
      validationMode: field.validationMode.value,
      shouldValidateOnChange: field.shouldValidateOnChange(),
      state: field.state.value,
      focusOwnerRef: field.focusOwnerRef,
      inputRef: field.validation.inputRef.value,
      registeredInputs: field.validation.registeredInputs.size,
    };
  }

  function readFormValues(form: FormContext) {
    return {
      errors: form.errors.value,
      fields: form.fields.value,
      elementRef: form.elementRef.value,
      validationMode: form.validationMode.value,
      submitCountRef: form.submitCountRef.value,
    };
  }

  // The part gives each function of the two contexts a call, as a part with no field and no form
  // does in `setup`. Then it renders the values that it reads.
  const Part = defineComponent(() => {
    const field = useFieldRootContext();
    const form = useFormContext();
    const input = {} as HTMLInputElement;
    const setFocused = useSetFieldFocused(false, null);

    field.setValidityData({ ...field.validityData.value, error: 'error', value: 'value' });
    field.setTouched(true);
    field.setDirty(true);
    field.setFilled(true);
    field.setFocused(true);
    field.registerFieldControl(Symbol(), () => ({ controlRef: input, id: 'control', value: 'x' }));
    field.validation.inputRef.value = input;
    field.validation.registerInput(input, { controlRef: input, value: 'x' });
    field.validation.change('x');
    form.clearErrors('name');
    form.registerField(Symbol(), () => undefined);
    setFocused(true);

    return () => (
      <i>{JSON.stringify({ field: readFieldValues(field), form: readFormValues(form) })}</i>
    );
  });

  // Vue escapes the quotes of the text of the part.
  function parseValues(html: string) {
    const text = /^<i>(.*)<\/i>$/.exec(html)?.[1] ?? '';
    return JSON.parse(text.replaceAll('&quot;', '"')) as unknown;
  }

  it('writes no state to the default contexts when a part with no field and no form calls their functions', async () => {
    const first = await renderToString(<Part />);
    const second = await renderToString(<Part />);

    expect(parseValues(first)).toEqual({ field: DEFAULT_FIELD_VALUES, form: DEFAULT_FORM_VALUES });
    expect(second).toBe(first);
    expect(readFieldValues(DEFAULT_FIELD_ROOT_CONTEXT)).toEqual(DEFAULT_FIELD_VALUES);
  });

  it('does not share the state of a field between two renders', async () => {
    const first = await renderToString(<FieldStateHydration value="x" />);
    const second = await renderToString(<FieldStateHydration />);
    const third = await renderToString(<FieldStateHydration value="x" />);

    expect(first).toContain('data-filled');
    expect(second).not.toContain('data-filled');
    expect(third).toBe(first);
  });
});
