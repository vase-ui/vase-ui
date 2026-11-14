import { shallowRef } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { useButton } from '../../internals/use-button';
import { mergeProps } from '../../merge-props';
import type { MenuStore } from '../store/MenuStore';
import { useMenuItemCommonProps } from './useMenuItemCommonProps';

export const REGULAR_ITEM = {
  type: 'regular-item' as const,
};

export function useMenuItem(params: UseMenuItemParameters): UseMenuItemReturnValue {
  const {
    closeOnClick,
    disabled,
    highlighted,
    id,
    store,
    typingRef = store.context.typingRef,
    nativeButton,
    itemMetadata,
    nodeId,
  } = params;

  const itemElement = shallowRef<HTMLElement | null>(null);

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
    composite: true,
  });

  const commonProps = useMenuItemCommonProps({
    closeOnClick,
    highlighted,
    id,
    nodeId,
    store,
    typingRef,
    itemElement,
    itemMetadata,
  });

  function getItemProps(externalProps?: Record<string, any>) {
    return mergeProps<'div'>(
      commonProps.value,
      {
        onMouseenter(event: MouseEvent) {
          if (itemMetadata.type !== 'submenu-trigger') {
            return;
          }

          itemMetadata.setActive(event);
        },
      },
      externalProps ?? {},
      getButtonProps,
    );
  }

  function itemRef(element: HTMLElement | null) {
    itemElement.value = element;
    buttonRef(element);
  }

  return { getItemProps, itemRef };
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
   * Whether the component renders a native `<button>` element when replacing it
   * via the `as` prop or the `#render` slot.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default false
   */
  nativeButton: MaybeRefOrGetter<boolean>;
  /**
   * Additional data specific to the item type.
   */
  itemMetadata: UseMenuItemMetadata;
  /**
   * The node id of the menu positioner.
   */
  nodeId: MaybeRefOrGetter<string | undefined>;
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

export interface UseMenuItemReturnValue {
  /**
   * Resolver for the root slot's props. It reads reactive state, so the part calls it in the
   * function that it gives to `useRenderElement` as `props`.
   * @param externalProps The props that come before the props of the item.
   * @returns The props that the part gives to its element.
   */
  getItemProps: (externalProps?: Record<string, any>) => Record<string, any>;
  /**
   * The ref to the component's root DOM element.
   */
  itemRef: (element: HTMLElement | null) => void;
}
