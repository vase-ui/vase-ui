import { computed, nextTick, watch, type Ref } from 'vue';
import { useFormReset } from '../common/formEvents';
import { visuallyHiddenInput } from '../common/visuallyHidden';
import { isSelectedValueDirty } from '../internals/itemEquality';
import { stringifyAsLabel, stringifyAsValue } from '../internals/resolveValueLabel';
import type { SelectContext } from './root';

/**
 * The form of a select: the values in `type="hidden"` inputs, and one visually hidden text input
 * that the browser validates and fills. A text input removes each line break of its value, and a
 * hidden input has no constraint validation (test/measurements/select.test.ts).
 */
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
  const name = computed(() => field?.name ?? props.name);
  const textOf = (value: unknown) => stringifyAsValue(value, props.itemToStringValue);
  /** The form text of the value, or of each value with `multiple`. */
  const formValue = computed(() =>
    context.multiple ? (context.value as unknown[]).map(textOf) : textOf(context.value),
  );
  const hiddenValues = computed(() => {
    if (!name.value) return [];
    return Array.isArray(formValue.value) ? formValue.value : [formValue.value];
  });

  watch(
    // The trigger is the element of `Select.Trigger`, which renders an HTML element.
    [() => context.root.activeTrigger as HTMLElement | null, input],
    ([trigger, text], _, onCleanup) => {
      if (!trigger || !text || !field) return;
      onCleanup(
        field.setControl({
          element: trigger,
          get id() {
            return trigger.id;
          },
          get name() {
            return props.name;
          },
          get disabled() {
            return props.ownDisabled;
          },
          get readOnly() {
            return context.readonly;
          },
          inputs: [text],
          focusElement: trigger,
          formValue: () => formValue.value,
          sameValue: (a, b) => !isSelectedValueDirty(a, b, props.isItemEqualToValue ?? Object.is),
          // The user picks the value, so a select with no value is never dirty (BUG-1425).
          countsMissingAtLeave: true,
        }),
      );
    },
    { flush: 'post' },
  );

  useFormReset(input, reset);

  /** A fill of the browser: the item whose form text, label or text is the text of the input. */
  function onInput(event: Event) {
    const element = event.currentTarget as HTMLInputElement;
    const text = element.value.toLowerCase();
    context.keep();
    // The items of a select that never had the focus mount in the next update.
    void nextTick(() => {
      if (!context.multiple && !context.disabled && !context.readonly) {
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
      }
      // Vue writes the value only when it changes, and the fill gave the input another text.
      const shown = Array.isArray(formValue.value) ? '' : formValue.value;
      if (element.value !== shown) element.value = shown;
    });
  }

  function textProps() {
    const multiple = context.multiple;
    // An input with no work is `type="hidden"`, so that a password tool skips it (Base UI).
    const works = !!field || !!name.value || !!props.autocomplete || context.required;
    return {
      type: works ? undefined : 'hidden',
      id: `${props.id}-hidden-input`,
      form: props.form,
      autocomplete: props.autocomplete,
      required: context.required && !(multiple && context.hasValue),
      readonly: context.readonly,
      disabled: context.disabled,
      value: multiple ? '' : formValue.value,
      'aria-hidden': 'true' as const,
      tabindex: -1,
      style: visuallyHiddenInput,
      onInput,
      // The browser gives the focus to an invalid input at a submit. `focusVisible` gives the
      // trigger its focus ring in each browser (test/measurements/select.test.ts).
      onFocus() {
        (context.root.activeTrigger as HTMLElement | null)?.focus({ focusVisible: true });
      },
    };
  }

  return { name, hiddenValues, textProps };
}
