import { computed, nextTick, watch } from 'vue';
import type { FieldControl, FieldForControl } from '../field/control';
import { useFormReset } from './formEvents';
import { visuallyHiddenInput } from './visuallyHidden';

/**
 * The form inputs of a part that picks values: the values in `type="hidden"` inputs with the
 * name, and one visually hidden text input with no name that the browser validates and fills. A
 * text input removes each line break of its value, and a hidden input has no constraint validation
 * (test/measurements/select.test.ts). The control of the part is the control of the field.
 */
export function useValueInputs(
  field: FieldForControl | null,
  options: {
    /** The name of the hidden inputs. With no name, the part renders no hidden input. */
    name(): string | undefined;
    /** The form text of each value: one hidden input for each. */
    values(): string[];
    /** The text of the text input: the form text of one value, else empty. */
    text(): string;
    /** The `id` of the text input. */
    id(): string;
    form(): string | undefined;
    autocomplete(): string | undefined;
    /** The `required` prop of the part. */
    required(): boolean;
    /** The part has values of `multiple`, which the text input does not hold. */
    multipleValues(): boolean;
    readonly(): boolean;
    disabled(): boolean;
    /** The element that takes the focus for the inputs: the control of the field. */
    control(): HTMLElement | null;
    /** The text input of `textProps`. */
    textInput(): HTMLInputElement | null;
    /** The input whose form owns the part, and whose validation stands for the control. */
    input(): HTMLInputElement | null;
    /** A fill of the browser gave the text input this text. */
    fill(text: string, event: Event): void;
    /** A native reset of the form. */
    reset(): void;
    /** The parts of the field control that the family gives. */
    fieldControl: Pick<
      FieldControl,
      'name' | 'disabled' | 'formValue' | 'sameValue' | 'countsMissingAtLeave'
    >;
  },
) {
  const name = computed(() => options.name());
  const values = computed(() => (name.value ? options.values() : []));

  function showText(input: HTMLInputElement | null) {
    // Vue writes the value only when it changes, and the fill or the reset gave another text.
    const shown = options.text();
    if (input && input.value !== shown) input.value = shown;
  }

  function textProps(): Record<string, unknown> {
    // With no field, no name, no autofill and no constraint, the text input has no work. It is then
    // `type="hidden"`, so that a password tool skips it (Base UI).
    const works = !!field || !!name.value || !!options.autocomplete() || options.required();
    return {
      type: works ? 'text' : 'hidden',
      id: options.id(),
      form: options.form(),
      autocomplete: options.autocomplete(),
      required: options.required() && !options.multipleValues(),
      readonly: options.readonly(),
      disabled: options.disabled(),
      value: options.text(),
      'aria-hidden': 'true',
      tabindex: -1,
      style: visuallyHiddenInput,
      onInput(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        options.fill(input.value, event);
        void nextTick(() => showText(input));
      },
      // The browser gives the focus to an invalid input at a submit. `focusVisible` gives the
      // control its focus ring in each browser (test/measurements/select.test.ts).
      onFocus() {
        options.control()?.focus({ focusVisible: true });
      },
    };
  }

  useFormReset(
    computed(() => options.input()),
    () => {
      options.reset();
      void nextTick(() => showText(options.textInput()));
    },
  );

  watch(
    () => options.control(),
    (element, _, onCleanup) => {
      if (!element || !field) return;
      const { fieldControl } = options;
      onCleanup(
        field.setControl({
          element,
          get id() {
            return element.id;
          },
          get name() {
            return fieldControl.name;
          },
          get disabled() {
            return fieldControl.disabled;
          },
          get readOnly() {
            return options.readonly();
          },
          get inputs() {
            const input = options.input();
            return input ? [input] : [];
          },
          focusElement: element,
          formValue: fieldControl.formValue,
          sameValue: fieldControl.sameValue,
          get countsMissingAtLeave() {
            return fieldControl.countsMissingAtLeave;
          },
        }),
      );
    },
    { flush: 'post' },
  );

  return { name, values, textProps };
}
