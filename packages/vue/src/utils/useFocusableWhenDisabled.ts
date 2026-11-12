import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

export function useFocusableWhenDisabled(
  parameters: UseFocusableWhenDisabledParameters,
): UseFocusableWhenDisabledReturnValue {
  const props = computed(() => {
    const focusableWhenDisabled = toValue(parameters.focusableWhenDisabled);
    const disabled = toValue(parameters.disabled);
    const composite = toValue(parameters.composite) ?? false;
    const tabIndexProp = toValue(parameters.tabIndex) ?? 0;
    const isNativeButton = toValue(parameters.isNativeButton);

    const isFocusableComposite = composite && focusableWhenDisabled !== false;
    const isNonFocusableComposite = composite && focusableWhenDisabled === false;

    // The code adds a key only when it has a value. A key with the value `undefined` replaces
    // the value of an earlier set in `mergeProps`.
    const additionalProps: FocusableWhenDisabledProps = {
      // Tab must still move focus away from an element that is disabled and focusable.
      onKeydown(event) {
        if (disabled && focusableWhenDisabled && event.key !== 'Tab') {
          event.preventDefault();
        }
      },
    };

    if (!composite) {
      additionalProps.tabindex = tabIndexProp;

      // A `<span>` has no `disabled` attribute that takes it out of the tab order.
      if (!isNativeButton && disabled) {
        additionalProps.tabindex = focusableWhenDisabled ? tabIndexProp : -1;
      }
    }

    if (
      (isNativeButton && (focusableWhenDisabled || isFocusableComposite)) ||
      (!isNativeButton && disabled)
    ) {
      additionalProps['aria-disabled'] = disabled;
    }

    if (isNativeButton && (!focusableWhenDisabled || isNonFocusableComposite)) {
      additionalProps.disabled = disabled;
    }

    return additionalProps;
  });

  return { props };
}

interface FocusableWhenDisabledProps {
  'aria-disabled'?: boolean | undefined;
  disabled?: boolean | undefined;
  onKeydown: (event: KeyboardEvent) => void;
  tabindex?: number | undefined;
}

export interface UseFocusableWhenDisabledParameters {
  /**
   * Whether the component is focusable when it is disabled.
   * When `undefined`, composite items are focusable when disabled by default.
   */
  focusableWhenDisabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * The disabled state of the component.
   */
  disabled: MaybeRefOrGetter<boolean>;
  /**
   * Whether this is a composite item.
   * @default false
   */
  composite?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * @default 0
   */
  tabIndex?: MaybeRefOrGetter<number | undefined> | undefined;
  /**
   * Whether the component renders a native `<button>` element.
   */
  isNativeButton: MaybeRefOrGetter<boolean>;
}

export interface UseFocusableWhenDisabledReturnValue {
  props: ComputedRef<FocusableWhenDisabledProps>;
}
