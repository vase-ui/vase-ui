import { nextTick, type Ref } from 'vue';
import { useValueInputs } from '../common/valueInputs';
import { isSelectedValueDirty } from '../internals/itemEquality';
import { stringifyAsLabel, stringifyAsValue } from '../internals/resolveValueLabel';
import type { SelectContext } from './root';

/** The form inputs of a select (`useValueInputs`): the trigger is the control. */
export function useSelectForm(
  context: SelectContext,
  props: {
    readonly id: string;
    readonly name: string | undefined;
    readonly form: string | undefined;
    readonly autocomplete: string | undefined;
    readonly itemToStringValue: ((value: any) => string) | undefined;
    readonly isItemEqualToValue: ((itemValue: any, value: any) => boolean) | undefined;
    /** Disabled by the root or a fieldset, not by the field. */
    readonly ownDisabled: boolean;
  },
  input: Readonly<Ref<HTMLInputElement | null>>,
  reset: () => void,
) {
  const { field } = context;
  const textOf = (value: unknown) => stringifyAsValue(value, props.itemToStringValue);
  /** The form text of the value, or of each value with `multiple`. */
  const formValue = () =>
    context.multiple ? (context.value as unknown[]).map(textOf) : textOf(context.value);
  // The trigger is the element of `Select.Trigger`, which renders an HTML element.
  const trigger = () => context.root.activeTrigger as HTMLElement | null;

  /** A fill of the browser: the item whose form text, label or text is the text of the input. */
  function fill(filled: string, event: Event) {
    const text = filled.toLowerCase();
    context.keep();
    // The items of a select that never had the focus mount in the next update.
    void nextTick(() => {
      if (context.multiple || context.disabled || context.readonly) return;
      const items = context.list.items({ hidden: true });
      const valueOf = (item: (typeof items)[number]) => context.itemValues.get(item.element);
      const match =
        items.find((item) => {
          const value = valueOf(item);
          return (
            textOf(value).toLowerCase() === text ||
            stringifyAsLabel(value, context.itemToStringLabel).toLowerCase() === text
          );
        }) ?? items.find((item) => context.list.text(item).toLowerCase() === text);
      if (match) context.change(valueOf(match), 'none', event);
    });
  }

  return useValueInputs(field, {
    name: () => field?.name ?? props.name,
    values: () => [formValue()].flat(),
    text: () => (context.multiple ? '' : textOf(context.value)),
    id: () => `${props.id}-hidden-input`,
    form: () => props.form,
    autocomplete: () => props.autocomplete,
    required: () => context.required,
    multipleValues: () => context.multiple && context.hasValue,
    readonly: () => context.readonly,
    disabled: () => context.disabled,
    control: trigger,
    textInput: () => input.value,
    input: () => input.value,
    fill,
    reset,
    fieldControl: {
      get name() {
        return props.name;
      },
      get disabled() {
        return props.ownDisabled;
      },
      formValue,
      sameValue: (a, b) => !isSelectedValueDirty(a, b, props.isItemEqualToValue ?? Object.is),
      // The user picks the value, so a select with no value is never dirty (BUG-1425).
      countsMissingAtLeave: true,
    },
  });
}
