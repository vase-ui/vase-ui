import { computed, inject, nextTick, watch, type CSSProperties } from 'vue';
import { useFormReset } from '../common/formEvents';
import { visuallyHiddenInput } from '../common/visuallyHidden';
import { fieldKey } from '../field/control';
import { isSelectedValueDirty } from '../internals/itemEquality';
import type { ComboboxRootContext } from './root';
import { createComboboxDetails } from './root';

/**
 * The form of a root (rule 8.11): the values in hidden inputs with the name, and one text input
 * with no name for the constraint validation and the autofill. The field of the control.
 */
export function useComboboxForm(
  context: ComboboxRootContext,
  options: {
    /** The autofill purpose of the text input. */
    autocomplete: () => string | undefined;
    /** The root renders its inputs. Autocomplete renders them only for an input in the popup. */
    rendersInputs: () => boolean;
    /** The element whose form owns the root: the text input, else the input of Autocomplete. */
    formElement: () => HTMLInputElement | null;
    isEqual: () => (itemValue: any, value: any) => boolean;
    /** Puts back the first value and the first text, and emits only the `update:*` events. */
    reset: () => void;
  },
) {
  const field = inject(fieldKey, null);

  /** The texts of the hidden inputs with the name. */
  const values = computed(() => {
    if (!context.name || !options.rendersInputs()) return [];
    if (context.mode === 'none') return [context.text];
    if (context.mode === 'multiple') {
      return (context.value as unknown[]).map((value) => context.formTextOf(value));
    }
    return [context.value == null ? '' : context.formTextOf(context.value)];
  });

  const required = computed(
    () => context.required && !(context.mode === 'multiple' && context.hasValue),
  );
  // With no field, no name, no autofill and no constraint, the text input has no work. A password
  // tool then skips it.
  const works = computed(
    () => !!field || !!context.name || !!options.autocomplete() || context.required,
  );

  function textInputProps(): Record<string, unknown> {
    const multiple = context.mode === 'multiple';
    return {
      type: works.value ? 'text' : 'hidden',
      id: `${context.controlId}-hidden-input`,
      value: multiple || context.value == null ? '' : textOf(context.value),
      form: context.form,
      autocomplete: options.autocomplete(),
      required: required.value,
      readonly: context.readonly,
      disabled: context.disabled,
      tabindex: -1,
      'aria-hidden': 'true',
      style: visuallyHiddenInput satisfies CSSProperties,
      // A blocked submit gives the focus to the input (test/measurements/combobox.test.ts, C11).
      onFocus: () => context.control?.focus(),
      onInput: onAutofill,
    };
  }

  function textOf(value: unknown) {
    return context.mode === 'none' ? String(value) : context.formTextOf(value);
  }

  function showText() {
    const input = context.textInput.value;
    if (input) input.value = textInputProps().value as string;
  }

  // An `input` event on the hidden input is an autofill.
  function onAutofill(event: Event) {
    const filled = (event.currentTarget as HTMLInputElement).value;
    void nextTick(showText);
    if (context.disabled || context.readonly || context.mode === 'multiple') return;
    const details = createComboboxDetails('none', event);
    if (context.mode === 'none') {
      context.setText(filled, details);
      return;
    }
    const lower = filled.toLowerCase();
    // The labels come from `items`, else from the mounted items of a kept popup.
    const values = context.data
      ? context.dataValues
      : context.mountedItems().map((item) => item.value);
    const match = values.find(
      (value) =>
        context.formTextOf(value).toLowerCase() === lower ||
        context.labelOf(value).toLowerCase() === lower,
    );
    if (match !== undefined && !context.isSelected(match)) context.setValue(match, details);
  }

  useFormReset(
    computed(() => options.formElement()),
    () => {
      options.reset();
      void nextTick(showText);
      field?.onReset(context.value);
    },
  );

  // The control is the control of the field while it is mounted.
  watch(
    () => context.control,
    (element, _, onCleanup) => {
      if (!element || !field) return;
      onCleanup(
        field.setControl({
          element,
          get id() {
            return element.id;
          },
          get name() {
            return context.name;
          },
          get disabled() {
            return context.disabled;
          },
          get readOnly() {
            return context.readonly;
          },
          get inputs() {
            const input = options.formElement();
            return input ? [input] : [];
          },
          focusElement: element,
          formValue: () =>
            context.mode === 'multiple'
              ? (context.value as unknown[]).map((value) => context.formTextOf(value))
              : context.mode === 'none'
                ? context.text
                : context.value == null
                  ? ''
                  : context.formTextOf(context.value),
          sameValue: (a, b) =>
            context.mode === 'none' ? a === b : !isSelectedValueDirty(a, b, options.isEqual()),
          // The user picks the value of a trigger, so it cannot become dirty before it has one.
          get countsMissingAtLeave() {
            return context.mode !== 'none' && !context.inputIsControl;
          },
        }),
      );
    },
    { flush: 'post' },
  );

  return { values, textInputProps, rendersInputs: options.rendersInputs };
}
