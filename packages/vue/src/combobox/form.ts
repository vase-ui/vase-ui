import { inject, nextTick } from 'vue';
import { useIsHydrated } from '../common/hydration';
import { useValueInputs } from '../common/valueInputs';
import { fieldKey } from '../field/control';
import { isSelectedValueDirty } from '../common/itemEquality';
import type { ComboboxRootContext } from './root';
import { createComboboxDetails } from './root';
import type { ComboboxRootChangeEventDetails } from './types';

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
    /**
     * Puts back the value and the text of a native reset, and emits only the `update:*` events.
     * Returns the value of the field.
     */
    reset: () => unknown;
  },
) {
  const field = inject(fieldKey, null);
  const mounted = useIsHydrated();

  /** The form text of the value, or of each value with `multiple`. */
  function formValue() {
    if (context.mode === 'none') return context.text;
    if (context.mode === 'multiple') {
      return (context.value as unknown[]).map((value) => context.formTextOf(value));
    }
    return context.value == null ? '' : context.formTextOf(context.value);
  }

  function textOf(value: unknown) {
    return context.mode === 'none' ? String(value) : context.formTextOf(value);
  }

  // A fill of the browser: the item whose form text or label is the text.
  function fill(filled: string, event: Event) {
    if (context.disabled || context.readonly || context.mode === 'multiple') return;
    const details = createComboboxDetails('none', event);
    if (context.mode === 'none') {
      context.setText(filled, details);
      return;
    }
    // With no `items`, the labels are the text of the items, which mount with the kept popup.
    if (!context.data && context.mountedItems().length === 0) {
      context.keepPopup();
      void nextTick(() => selectFilled(filled, details));
      return;
    }
    selectFilled(filled, details);
  }

  // A match of the form text wins over a match of a label of an earlier item (Base UI).
  function selectFilled(filled: string, details: ComboboxRootChangeEventDetails) {
    const lower = filled.toLowerCase();
    const items = context.data
      ? context.dataValues.map((value) => ({ value, labels: [context.labelOf(value)] }))
      : context
          .mountedItems()
          .map(({ value, text }) => ({ value, labels: [context.labelOf(value), text] }));
    const match =
      items.find(({ value }) => context.formTextOf(value).toLowerCase() === lower) ??
      items.find(({ labels }) => labels.some((label) => label?.toLowerCase() === lower));
    if (match && !context.isSelected(match.value)) context.setValue(match.value, details);
  }

  const inputs = useValueInputs(field, {
    name: () => (options.rendersInputs() ? context.name : undefined),
    values: () => [formValue()].flat(),
    text: () => (context.mode === 'multiple' || context.value == null ? '' : textOf(context.value)),
    // The server has no control, so the id of the control applies only after the mount. A control
    // in Vapor mode sets its ref before the root hydrates this input.
    id: () => `${(mounted.value && context.control?.id) || context.controlId}-hidden-input`,
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
      const value = options.reset();
      field?.onReset(value);
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
