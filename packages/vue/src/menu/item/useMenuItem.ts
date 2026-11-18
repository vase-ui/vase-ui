import type { MaybeRefOrGetter, Ref } from 'vue';
import { useButton } from '../../internals/use-button/useButton';
import type { MenuStore } from '../store/MenuStore';
import { useMenuItemCommonProps } from './useMenuItemCommonProps';

export const REGULAR_ITEM = {
  type: 'regular-item' as const,
};

/**
 * Gives a menu item its attributes, its listeners and the keyboard activation of a button.
 * Call it in `setup`, because it reads the contexts of the menu with `inject`.
 * Each parameter that can change is a value, a ref or a getter.
 */
export function useMenuItem(
  element: Readonly<Ref<HTMLElement | null>>,
  params: UseMenuItemParameters,
) {
  const { store, typingRef = store.context.typingRef, itemMetadata } = params;

  const commonProps = useMenuItemCommonProps({
    closeOnClick: params.closeOnClick,
    highlighted: params.highlighted,
    id: params.id,
    store,
    typingRef,
    getItemElement: () => element.value,
    itemMetadata,
  });

  const mouseEnterProps = {
    onMouseenter(event: MouseEvent) {
      if (itemMetadata.type !== 'submenu-trigger') {
        return;
      }

      itemMetadata.setActive(event);
    },
  };

  return {
    commonProps,
    mouseEnterProps,
    button: () =>
      useButton(element, {
        disabled: params.disabled,
        focusableWhenDisabled: true,
        native: params.nativeButton,
        composite: true,
      }),
  };
}

export interface UseMenuItemParameters {
  /**
   * Whether to close the menu when the item is clicked.
   */
  closeOnClick: MaybeRefOrGetter<boolean>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: MaybeRefOrGetter<boolean>;
  /**
   * Determines if the menu item is highlighted.
   */
  highlighted: MaybeRefOrGetter<boolean>;
  /**
   * The id of the menu item.
   */
  id: MaybeRefOrGetter<string | undefined>;
  /**
   * Whether the component renders a native `<button>` element when it is replaced with the `as`
   * prop or the `#render` slot.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default false
   */
  nativeButton: MaybeRefOrGetter<boolean>;
  /**
   * Additional data specific to the item type.
   */
  itemMetadata: UseMenuItemMetadata;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Whether a typeahead session is in progress.
   * @default store.context.typingRef
   */
  typingRef?: Readonly<Ref<boolean>> | undefined;
}

export type UseMenuItemMetadata =
  | typeof REGULAR_ITEM
  | {
      type: 'submenu-trigger';
      setActive: (event: MouseEvent) => void;
    };
