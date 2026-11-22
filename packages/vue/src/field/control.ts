import { computed, watch, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { useIsHydrated } from '../common/hydration';
import { givenId } from '../common/id';

export interface FieldState {
  /** The focus left the control one time or more. */
  touched: boolean;
  /** The value differs from the value at the mount or at the last native reset of the form. */
  dirty: boolean;
  /** `null` while the field has no validity. */
  valid: boolean | null;
  filled: boolean;
}

/** A native element with constraint validation. */
export type NativeControl = HTMLInputElement | HTMLTextAreaElement;

/** What a control tells its field about itself. The properties are reactive. */
export interface FieldControl {
  /** The element that has the role: the input, or the element of a group. */
  readonly element: HTMLElement;
  readonly id: string;
  /** The `name` of the control, for a field with no name. */
  readonly name: string | undefined;
  /** The control is disabled by its own prop or by a fieldset around it, not by its field. */
  readonly disabled: boolean;
  readonly readOnly: boolean;
  /** The native elements whose constraint validation stands for the control. */
  readonly inputs: readonly NativeControl[];
  /**
   * The element that gets the focus when a form finds the field invalid. With none, it is the
   * first element of `inputs` that fails, or else the first one.
   */
  readonly focusElement?: HTMLElement | undefined;
  /**
   * The value in the values of `form`, when it is not the value that `setValue` gave. A group
   * gives only what its inputs give that form.
   */
  formValue?(form: HTMLFormElement): unknown;
  /** Two values of the control are the same, when the control compares its values in its own way. */
  sameValue?(a: unknown, b: unknown): boolean;
  /**
   * In `blur` mode, a leave counts a missing value, as a submit does. The user picks the value of
   * such a control, so the control cannot become dirty before it has a value.
   */
  readonly countsMissingAtLeave?: boolean;
  /**
   * A failure that the control finds itself and sets as the custom validity of its first input. A
   * script can set no flag but `customError`, so the field shows `flag` in its place.
   */
  readonly customError?:
    | {
        readonly flag:
          'badInput' | 'rangeUnderflow' | 'rangeOverflow' | 'stepMismatch' | 'customError';
        readonly message: string;
      }
    | undefined;
}

/**
 * What a field gives to its control, and the calls that tell the field what happens to the
 * control. The properties are reactive.
 */
export interface FieldForControl {
  /** Wins over the `disabled` prop of the control. */
  readonly disabled: boolean;
  /** Wins over the `name` prop of the control. */
  readonly name: string | undefined;
  /** The id of a control that has no `id` prop. */
  readonly controlId: string | undefined;
  /**
   * A `Field.Label` that names the control by `for` rendered. In the `setup` of a control, that
   * label comes before the control in the document.
   */
  readonly hasLabel: boolean;
  /** Gives the `id` prop of the control, for a label that renders after the control. */
  setGivenId(id: () => string | undefined): void;
  /** The element of the control got a new `id`. A label reads the `id` again. */
  onIdChange(): void;
  /** The id of the label, for a group that a `<label for>` cannot name. */
  readonly labelId: string | undefined;
  /** The ids of the labels that are not a `<label>`, which name the control with no `for`. */
  readonly labelledBy: string | undefined;
  /** The ids of the descriptions and of the errors that show. */
  readonly describedBy: string | undefined;
  readonly state: Readonly<FieldState>;
  /** Makes the control the control of the field. Returns the function that removes it. */
  setControl(control: FieldControl): () => void;
  /** The value at the mount and after each change, and if it is not empty. */
  setValue(value: unknown, filled: boolean): void;
  /** The user changed the value. The control calls `setValue` first. */
  onEdit(): void;
  /** The focus left `element`, the element of the control or of an item of a group. */
  onLeave(element: Element): void;
  /**
   * A native reset of the form of the control, which gave the control `value`. The value is then
   * the first value of the field.
   */
  onReset(value: unknown): void;
}

/** A part that provides `null` cuts its content off from the field around it. */
export const fieldKey: InjectionKey<FieldForControl | null> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'field' : undefined,
);

/**
 * The data attributes of the state of a field, with an empty value for each one that is on. A
 * control gives no `disabled`, because `:disabled` matches its native element.
 */
export function fieldStateAttributes(state: FieldState, disabled?: boolean) {
  const on = (value: boolean | undefined) => (value ? '' : undefined);
  return {
    'data-disabled': on(disabled),
    'data-valid': on(state.valid === true),
    'data-invalid': on(state.valid === false),
    'data-touched': on(state.touched),
    'data-dirty': on(state.dirty),
    'data-filled': on(state.filled),
  };
}

/**
 * The attributes that a field gives to the element of its control. `aria-invalid` says the invalid
 * state, so the element has no `data-invalid`.
 */
export function controlAttributes(field: FieldForControl) {
  return {
    ...fieldStateAttributes(field.state),
    'data-invalid': undefined,
    ...controlAria(field),
  };
}

/**
 * The ARIA attributes that a field gives to the element of its control, but for
 * `aria-describedby`, which `joinDescribedBy` gives.
 */
export function controlAria(field: FieldForControl) {
  return {
    'aria-invalid': field.state.valid === false ? 'true' : undefined,
    'aria-labelledby': field.labelledBy,
  };
}

/**
 * The attributes of the developer for the element of a control, with the ids of the developer and
 * then the ids of the field in `aria-describedby`, so that the user gets both descriptions. `null`
 * of the developer removes the ids of the field.
 */
export function joinDescribedBy(attrs: Record<string, unknown>, field: FieldForControl | null) {
  if (!field) return attrs;
  const given = attrs['aria-describedby'];
  if (given === null) return attrs;
  // Each id one time. Chromium reads the text of an id again for each time that the list names it
  // (test/measurements/field.test.ts).
  const ids = new Set(
    `${typeof given === 'string' ? given : ''} ${field.describedBy ?? ''}`.split(/\s+/),
  );
  ids.delete('');
  return { ...attrs, 'aria-describedby': [...ids].join(' ') || undefined };
}

/**
 * The id of the element of a control: its `id` prop, else the id of its field, else `fallback`. A
 * label that rendered before the control names the id of the field in the server HTML. So then the
 * control takes its `id` prop only after its mount, and the label follows.
 */
export function useControlId(
  field: FieldForControl | null,
  id: () => string | undefined,
  fallback: () => string,
): ComputedRef<string> {
  if (!field?.hasLabel) {
    field?.setGivenId(() => givenId(id()));
    return computed(() => givenId(id()) ?? field?.controlId ?? fallback());
  }
  const mounted = useIsHydrated();
  // Some controls give the field the `id` of their element, which Vue does not track. So the label
  // reads it again after the render of the `id` prop.
  watch(mounted, () => field.onIdChange(), { flush: 'post' });
  return computed(() => {
    const given = givenId(id());
    return given && mounted.value ? given : (field.controlId ?? fallback());
  });
}

/** Makes the element the control of its field while the element is mounted. */
export function useFieldControl(
  field: FieldForControl | null,
  element: Readonly<Ref<NativeControl | null>>,
  control: {
    id(): string;
    name(): string | undefined;
    disabled(): boolean;
    readOnly(): boolean;
  },
) {
  watch(
    element,
    (el, _, onCleanup) => {
      if (!el || !field) return;
      onCleanup(
        field.setControl({
          element: el,
          get id() {
            return control.id();
          },
          get name() {
            return control.name();
          },
          get disabled() {
            return control.disabled();
          },
          get readOnly() {
            return control.readOnly();
          },
          inputs: [el],
        }),
      );
    },
    { flush: 'post' },
  );
}
