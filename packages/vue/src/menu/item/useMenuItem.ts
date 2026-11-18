import type { MaybeRefOrGetter, Ref } from 'vue';
import { useButton } from '../../internals/use-button/useButton';
import { useMenuItemCommonProps } from './useMenuItemCommonProps';
import type { UseMenuItemCommonPropsParameters } from './useMenuItemCommonProps';

export function useMenuItem(
  element: Readonly<Ref<HTMLElement | null>>,
  params: UseMenuItemParameters,
) {
  const commonProps = useMenuItemCommonProps(element, params);

  return {
    commonProps,
    button: () =>
      useButton(element, {
        disabled: params.disabled,
        focusableWhenDisabled: true,
        native: params.nativeButton,
        composite: true,
      }),
  };
}

interface UseMenuItemParameters extends UseMenuItemCommonPropsParameters {
  disabled: MaybeRefOrGetter<boolean>;
  nativeButton: MaybeRefOrGetter<boolean>;
}
