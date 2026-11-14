import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useButton } from '../../internals/use-button';
import type { UseRenderElementParameters } from '../../internals/useRenderElement';
import {
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from '../root/FilterDropdownRootContext';

/**
 * The button that clears the query of a filter dropdown. The part that calls it renders its
 * element only while `visible` is `true`, and gives `state`, `ref` and `props` to
 * `useRenderElement` with the default tag `button`.
 *
 * Call it in `setup`.
 *
 * @internal
 */
export function useFilterDropdownClear(
  params: UseFilterDropdownClearParameters = {},
): UseFilterDropdownClearReturnValue {
  const context = useFilterDropdownRootContext();
  const value = useFilterDropdownValueContext();

  const disabled = computed(() => context.disabled.value || Boolean(toValue(params.disabled)));
  const visible = computed(() => value.value !== '');

  const { buttonRef, getButtonProps } = useButton({
    disabled,
    native: () => toValue(params.nativeButton) ?? true,
  });

  // `visible` is deliberately absent from the state: the component renders nothing when it is
  // false, so a `data-visible` attribute would be present on every rendered instance.
  const state = computed<FilterDropdownClearState>(() => ({ disabled: disabled.value }));

  const ownProps = {
    tabindex: -1,
    'aria-hidden': true,
    onMousedown(event: MouseEvent) {
      // Avoid stealing focus from the input on pointer interaction.
      event.preventDefault();
    },
    onClick(event: MouseEvent) {
      const eventDetails = createChangeEventDetails(REASONS.clearPress, event);
      context.onValueChange('', eventDetails);
      context.focusOwnerRef.value?.focus({ preventScroll: true });
    },
  };

  return {
    visible,
    state,
    ref: buttonRef,
    props: (attrs) => [ownProps, attrs, getButtonProps],
  };
}

export interface FilterDropdownClearState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface UseFilterDropdownClearParameters {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: MaybeRefOrGetter<boolean | undefined> | undefined;
  /**
   * Whether the element is a native `<button>`.
   * @default true
   */
  nativeButton?: MaybeRefOrGetter<boolean | undefined> | undefined;
}

export interface UseFilterDropdownClearReturnValue {
  /** Whether the button renders: the query is not empty. */
  visible: ComputedRef<boolean>;
  state: ComputedRef<FilterDropdownClearState>;
  /** The function ref of the button element. */
  ref: (element: HTMLElement | null) => void;
  props: NonNullable<UseRenderElementParameters<FilterDropdownClearState>['props']>;
}
