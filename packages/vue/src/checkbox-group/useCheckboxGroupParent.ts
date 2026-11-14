import { shallowReactive, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { EMPTY_ARRAY } from '../common/empty';
import type { VaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { VaseUIEventReasons } from '../internals/reasons';

type ChangeEventDetails = VaseUIChangeEventDetails<VaseUIEventReasons['none']>;

export function useCheckboxGroupParent(
  params: UseCheckboxGroupParentParameters,
): UseCheckboxGroupParentReturnValue {
  const { allValues, value, onValueChange } = params;

  // The value that the user made with the children. The third click on the parent puts it back.
  let childrenValue = toValue(value);
  let status: 'on' | 'off' | 'mixed' = 'mixed';
  const disabledStates = new Map<string, boolean>();
  // A `Map` rather than an object: checkbox values are consumer data, and a value like
  // `constructor` would otherwise read straight off `Object.prototype`.
  const childIds = shallowReactive(new Map<string, readonly string[]>());

  function registerChildId(childValue: string, childId: string) {
    childIds.set(childValue, (childIds.get(childValue) ?? EMPTY_ARRAY).concat(childId));

    return () => {
      const nextIds = (childIds.get(childValue) ?? EMPTY_ARRAY).filter((id) => id !== childId);
      if (nextIds.length === 0) {
        childIds.delete(childValue);
      } else {
        childIds.set(childValue, nextIds);
      }
    };
  }

  function getParentProps() {
    const currentValue = toValue(value);
    const values = toValue(allValues) ?? EMPTY_ARRAY;

    return {
      indeterminate: currentValue.length !== values.length && currentValue.length > 0,
      checked: currentValue.length === values.length,
      // Children report their own rendered id, so a custom `id` survives and no unmounted
      // element is named.
      'aria-controls':
        values.flatMap((childValue) => childIds.get(childValue) ?? EMPTY_ARRAY).join(' ') ||
        undefined,
      onCheckedChange(_checked: boolean, eventDetails: ChangeEventDetails) {
        // None except the disabled ones that are checked, which can't be changed.
        const none = values.filter(
          (childValue) => disabledStates.get(childValue) && childrenValue.includes(childValue),
        );
        // "All" that are valid:
        // - any that aren't disabled
        // - disabled ones that are checked
        const all = values.filter(
          (childValue) => !disabledStates.get(childValue) || childrenValue.includes(childValue),
        );

        const allOnOrOff = childrenValue.length === all.length || childrenValue.length === 0;

        if (allOnOrOff) {
          onValueChange?.(currentValue.length === all.length ? none : all, eventDetails);
          return;
        }

        let nextStatus: 'on' | 'off' | 'mixed' = 'mixed';
        let nextValue = childrenValue;

        if (status === 'mixed') {
          nextStatus = 'on';
          nextValue = all;
        } else if (status === 'on') {
          nextStatus = 'off';
          nextValue = none;
        }

        onValueChange?.(nextValue, eventDetails);

        if (!eventDetails.isCanceled) {
          status = nextStatus;
        }
      },
    };
  }

  function getChildProps(childValue: string) {
    return {
      checked: toValue(value).includes(childValue),
      onCheckedChange(nextChecked: boolean, eventDetails: ChangeEventDetails) {
        const newValue = toValue(value).slice();
        if (nextChecked) {
          newValue.push(childValue);
        } else {
          newValue.splice(newValue.indexOf(childValue), 1);
        }

        onValueChange?.(newValue, eventDetails);

        if (!eventDetails.isCanceled) {
          childrenValue = newValue;
          status = 'mixed';
        }
      },
    };
  }

  // A reset gives the parent its state at the mount: the default value is the value that the
  // children made, and the next click on the parent starts a new cycle.
  function reset(resetValue: string[]) {
    childrenValue = resetValue;
    status = 'mixed';
  }

  return { getParentProps, getChildProps, registerChildId, disabledStates, reset };
}

export interface UseCheckboxGroupParentParameters {
  /**
   * The names of all checkboxes in the group.
   */
  allValues?: MaybeRefOrGetter<string[] | undefined> | undefined;
  value: MaybeRefOrGetter<string[]>;
  onValueChange?: ((value: string[], eventDetails: ChangeEventDetails) => void) | undefined;
}

export interface UseCheckboxGroupParentReturnValue {
  /**
   * Whether each child is disabled, by value. A child writes its own entry.
   */
  disabledStates: Map<string, boolean>;
  /**
   * Reports the `id` of the element a child checkbox exposes.
   */
  registerChildId: (value: string, id: string) => () => void;
  getParentProps: () => {
    indeterminate: boolean;
    checked: boolean;
    'aria-controls': string | undefined;
    onCheckedChange: (checked: boolean, eventDetails: ChangeEventDetails) => void;
  };
  getChildProps: (value: string) => {
    checked: boolean;
    onCheckedChange: (checked: boolean, eventDetails: ChangeEventDetails) => void;
  };
  /**
   * Puts the parent back to its state at the mount, after the group took `value` as its value.
   */
  reset: (value: string[]) => void;
}
