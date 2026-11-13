import { expect, describe, it } from 'vitest';
import { computed, defineComponent, provide, shallowRef } from 'vue';
import { createRenderer } from '#test-utils';
import { DEFAULT_VALIDITY_STATE } from '../field-constants/constants';
import { FormContext, useFormContext } from './FormContext';
import type { FormField } from './FormContext';

describe('FormContext', () => {
  const { render } = createRenderer();

  async function renderForm() {
    let form!: FormContext;
    const Probe = defineComponent(() => {
      form = useFormContext();
      return () => null;
    });
    await render(<Probe />);
    return form;
  }

  it('gives a part with no form the default value of each member', async () => {
    const form = await renderForm();

    expect(form.errors.value).toEqual({});
    expect(form.fields.value).toEqual([]);
    expect(form.elementRef.value).toBeNull();
    expect(form.validationMode.value).toBe('onSubmit');
    expect(form.submitCountRef.value).toBe(0);
  });

  it('keeps the default values when a part calls a function of the default context', async () => {
    const form = await renderForm();
    const field: FormField = {
      name: 'name',
      validate() {},
      validityData: {
        state: DEFAULT_VALIDITY_STATE,
        error: '',
        errors: [],
        value: '',
        initialValue: null,
      },
      controlRef: null,
      getValue: () => 'value',
    };

    form.clearErrors('name');
    form.registerField(Symbol(), () => field);

    expect(form.errors.value).toEqual({});
    expect(form.fields.value).toEqual([]);
  });

  it('gives a part below a provider the context of that provider', async () => {
    const provided: FormContext = {
      errors: computed(() => ({ name: 'taken' })),
      clearErrors() {},
      elementRef: shallowRef<HTMLFormElement | null>(null),
      fields: computed(() => []),
      registerField() {},
      validationMode: computed(() => 'onBlur'),
      submitCountRef: shallowRef(1),
    };
    let received!: FormContext;
    const Probe = defineComponent(() => {
      received = useFormContext();
      return () => null;
    });
    const Provider = defineComponent((_props, { slots }) => {
      provide(FormContext, provided);
      return () => slots.default?.();
    });

    await render(
      <Provider>
        <Probe />
      </Provider>,
    );

    expect(received).toBe(provided);
  });
});
