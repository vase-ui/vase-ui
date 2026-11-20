import { inject } from 'vue';
import { useValueInputs } from '../common/valueInputs';
import { fieldKey } from '../field/control';
import { isSelectedValueDirty } from '../internals/itemEquality';
import type { ComboboxRootContext } from './root';
import { createComboboxDetails } from './root';

/** The form inputs of a root (`useValueInputs`): the control is the control of the field. */
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

  /** The form text of the value, or of each value with `multiple`. */
  function formValue() {
    if (context.mode === 'none') return context.text;
    if (context.mode === 'multiple') {
      return (context.value as unknown[]).map((value) => context.formTextOf(value));
    }
    return context.value == null ? '' : context.formTextOf(context.value);
  }

  // A fill of the browser: the item whose form text or label is the text.
  function fill(filled: string, event: Event) {
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

  const inputs = useValueInputs(field, {
    name: () => (options.rendersInputs() ? context.name : undefined),
    values: () => [formValue()].flat(),
    text: () =>
      context.mode === 'multiple' || context.value == null
        ? ''
        : context.mode === 'none'
          ? String(context.value)
          : context.formTextOf(context.value),
    // The control has its id after its mount, so the server HTML and the first render agree.
    id: () => `${context.control?.id || context.controlId}-hidden-input`,
    form: () => context.form,
    autocomplete: options.autocomplete,
    required: () => context.required,
    multipleValues: () => context.mode === 'multiple' && context.hasValue,
    readonly: () => context.readonly,
    disabled: () => context.disabled,
    control: () => context.control,
    textInput: () => context.textInput.value,
    input: options.formElement,
    fill,
    reset() {
      options.reset();
      field?.onReset(context.value);
    },
    fieldControl: {
      get name() {
        return context.name;
      },
      get disabled() {
        return context.disabled;
      },
      formValue,
      sameValue: (a, b) =>
        context.mode === 'none' ? a === b : !isSelectedValueDirty(a, b, options.isEqual()),
      // The user picks the value of a trigger, so it cannot become dirty before it has one.
      get countsMissingAtLeave() {
        return context.mode !== 'none' && !context.inputIsControl;
      },
    },
  });

  return { ...inputs, rendersInputs: options.rendersInputs };
}
