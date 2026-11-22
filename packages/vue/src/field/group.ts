import { inject, provide, watch, type Ref } from 'vue';
import { fieldsetKey } from '../fieldset/part';
import { fieldKey, type NativeControl } from './control';

/** A group that is the control of its field: a checkbox group or a radio group. */
export function useFieldGroup(group: {
  element: Readonly<Ref<HTMLElement | null>>;
  /** The group is disabled, by each cause. */
  disabled: () => boolean;
  /** The group is disabled by its own prop or by a fieldset, not by its field. */
  ownDisabled: () => boolean;
  readOnly: () => boolean;
  inputs: () => readonly NativeControl[];
  focusElement?: () => HTMLElement | undefined;
  /** The `name` of the group, for a field with no name. */
  name?: () => string | undefined;
  /** The value in the values of `form`, when it is not the value that the group gives the field. */
  formValue?: (form: HTMLFormElement) => unknown;
  /** In `blur` mode, a leave counts a missing value. */
  countsMissingAtLeave?: boolean;
}) {
  const field = inject(fieldKey, null);
  const fieldset = inject(fieldsetKey, null);

  watch(
    group.element,
    (el, _, onCleanup) => {
      if (!el || !field) return;
      onCleanup(
        field.setControl({
          element: el,
          get id() {
            return el.id;
          },
          get name() {
            return group.name?.();
          },
          get disabled() {
            return group.ownDisabled();
          },
          get readOnly() {
            return group.readOnly();
          },
          get inputs() {
            return group.inputs();
          },
          get focusElement() {
            return group.focusElement?.();
          },
          ...(group.formValue && { formValue: group.formValue }),
          countsMissingAtLeave: group.countsMissingAtLeave,
        }),
      );
    },
    { flush: 'post' },
  );

  // The items of the group show the state of the field. The group is the control of the field,
  // so it gives them no part in it.
  if (field) {
    provide(fieldKey, {
      get disabled() {
        return group.disabled();
      },
      get name() {
        return field.name;
      },
      controlId: undefined,
      labelId: undefined,
      labelledBy: undefined,
      get describedBy() {
        return field.describedBy;
      },
      get state() {
        return field.state;
      },
      setControl: () => () => {},
      setValue() {},
      onEdit() {},
      onLeave() {},
      onReset() {},
    });
  }

  return {
    field,
    /** The `aria-labelledby` of the group, when no attribute of the developer names it. */
    labelledBy(attrs: Record<string, unknown>) {
      if ('aria-label' in attrs || 'aria-labelledby' in attrs) return undefined;
      return field?.labelId ?? fieldset?.legendId;
    },
    onFocusout(event: FocusEvent) {
      // A move of the focus between two items of the group is not a leave.
      if (!group.element.value?.contains(event.relatedTarget as Node | null)) {
        field?.onLeave(event.target as Element);
      }
    },
  };
}
