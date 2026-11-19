import { computed, mergeProps, nextTick, watch, type Ref } from 'vue';
import { controlAttributes, type FieldForControl } from '../field/control';
import { createChangeEventDetails, type ChangeEventDetails } from './changeEventDetails';
import { useFormReset } from './formReset';
import { useModel } from './model';

/** A group that holds the checked state of a checkbox. The properties are reactive. */
export interface CheckedOwner {
  readonly checked: boolean;
  /**
   * The checked state after a press, and the change that the press asks the group for. `pressed`
   * is the state that the browser gave the element.
   */
  press(pressed: boolean): {
    checked: boolean;
    change(details: ChangeEventDetails<'none'>): boolean;
  };
  /** The user changed the state. Called after the render of the change. */
  onEdit(): void;
  onReset(event: Event): void;
}

/**
 * The checked state of a native checkbox that a part renders: `Checkbox` and `Switch`. It gives
 * the model, a change that a listener can cancel, read-only, a native reset and the value of the
 * field.
 */
export function useChecked(options: {
  model: () => boolean | undefined;
  defaultChecked: () => boolean;
  readonly: () => boolean;
  element: Readonly<Ref<HTMLInputElement | null>>;
  field: FieldForControl | null;
  /** The group that holds the state, when there is one. */
  owner?: () => CheckedOwner | undefined;
  emitChange(checked: boolean, details: ChangeEventDetails<'none'>): void;
  emitModel(checked: boolean): void;
  /** Runs after a change that no listener cancelled. */
  onAccepted?(): void;
  /** Writes more state on the element after a change, such as `indeterminate`. */
  show?(element: HTMLInputElement): void;
}) {
  const { field } = options;
  // A controlled part goes back to the model of its mount at a reset.
  const firstModel = options.model();
  const own = useModel(options.model, firstModel ?? options.defaultChecked());
  const owner = () => options.owner?.();
  const checked = computed(() => owner()?.checked ?? own.value.value);

  watch(checked, (next) => field?.setValue(next, next), { immediate: true });

  useFormReset(options.element, (event) => {
    const group = owner();
    if (group) return group.onReset(event);
    const reset = firstModel ?? options.defaultChecked();
    field?.onReset(reset);
    if (checked.value === reset) return;
    own.setOwn(reset);
    options.emitModel(reset);
  });

  function onClick(event: Event) {
    // The browser keeps the state and fires no `change`.
    if (options.readonly()) event.preventDefault();
  }

  function onChange(event: Event) {
    const details = createChangeEventDetails('none', event);
    const group = owner();
    const pressed = (event.currentTarget as HTMLInputElement).checked;
    const press = group?.press(pressed);
    const next = press ? press.checked : pressed;
    options.emitChange(next, details);
    const accepted = !details.isCanceled && (!press || press.change(details));
    if (accepted) {
      own.setOwn(next);
      options.emitModel(next);
      options.onAccepted?.();
    }
    // Vue writes `checked` only when the state changes. The parent can refuse a controlled state,
    // and its answer arrives with its next render; then the element must show the state again.
    nextTick(() => {
      const el = options.element.value;
      if (el) {
        el.checked = checked.value;
        options.show?.(el);
      }
      if (!accepted) return;
      if (group) group.onEdit();
      else field?.onEdit();
    });
  }

  /** The attributes of the element that come from the state. */
  const attributes = computed(() => ({
    checked: checked.value,
    // HTML gives a checkbox no `readonly` attribute. CSS matches `[aria-readonly="true"]`.
    'aria-readonly': options.readonly() ? 'true' : undefined,
    ...(field && {
      ...controlAttributes(field),
      // `:checked` matches a filled checkbox.
      'data-filled': undefined,
    }),
    onClick,
    onChange,
    onBlur: () => field?.onLeave(),
  }));

  return {
    checked,
    attributes,
    /** Merges the attributes of the developer, which win. */
    mergeAttributes(own: Record<string, unknown>, attrs: Record<string, unknown>) {
      const merged = mergeProps(own, attrs);
      // HTML gives a checkbox no read-only state, so a required read-only checkbox would block
      // its form.
      if (options.readonly()) merged.required = false;
      return merged;
    },
  };
}
