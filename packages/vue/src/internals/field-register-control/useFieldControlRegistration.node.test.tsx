import { expect, describe, it, vi } from 'vitest';
import { computed, defineComponent, provide, shallowRef } from 'vue';
import { renderToString } from 'vue/server-renderer';
import FieldControlPart from '../../../test/fixtures/FieldControlPart.vue';
import FieldScope from '../../../test/fixtures/FieldScope.vue';
import {
  DEFAULT_FIELD_ROOT_CONTEXT,
  FieldRootContext,
} from '../field-root-context/FieldRootContext';
import { FormContext } from '../form-context/FormContext';
import FieldRegistrationHydration from './FieldRegistrationHydration.test.vue';

describe('the registration of a field control on a server', () => {
  it('gives no getter to the registry of a form or to the registry of a field', async () => {
    const registerField = vi.fn();
    const registerFieldControl = vi.fn();
    const context: FormContext = {
      errors: computed(() => ({})),
      clearErrors() {},
      elementRef: shallowRef(null),
      fields: computed(() => []),
      registerField,
      validationMode: computed(() => 'onSubmit'),
      submitCountRef: shallowRef(0),
    };
    // The spies take the place of the two registries. A field in `FieldScope` uses the first
    // registry. A control that `FieldScope` holds uses the second registry.
    const Form = defineComponent((_props, { slots }) => {
      provide(FormContext, context);
      return () => slots.default?.();
    });
    const Field = defineComponent((_props, { slots }) => {
      provide(FieldRootContext, {
        ...DEFAULT_FIELD_ROOT_CONTEXT,
        setValidityData: vi.fn(),
        registerFieldControl,
      });
      return () => slots.default?.();
    });

    await renderToString(
      <Form>
        <FieldScope name="a">
          <Field>
            <FieldControlPart id="control" value="x" />
          </Field>
        </FieldScope>
      </Form>,
    );

    expect(registerField).not.toHaveBeenCalledWith(expect.anything(), expect.any(Function));
    expect(registerFieldControl).not.toHaveBeenCalledWith(expect.anything(), expect.any(Function));
  });

  it('does not share a field between two renders', async () => {
    const errors = { a: 'taken' };

    const first = await renderToString(
      <FieldRegistrationHydration controlName="a" errors={errors} />,
    );
    const second = await renderToString(
      <FieldRegistrationHydration rootName="a" errors={errors} />,
    );
    const third = await renderToString(
      <FieldRegistrationHydration controlName="a" errors={errors} />,
    );

    expect(first).not.toContain('data-invalid');
    expect(second).toContain('data-invalid');
    expect(third).toBe(first);
  });
});
