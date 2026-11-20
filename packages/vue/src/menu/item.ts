import { computed, mergeProps, onUnmounted, useId, watch, type Ref } from 'vue';
import { useButton } from '../common/button';
import { givenId } from '../common/id';
import { platform } from '../common/platform';
import { useListItem } from '../list/list';
import { dispatchClickWithModifiers } from '../utils/dispatchClickWithModifiers';
import { useFilteredItem } from './filter';
import { injectMenu, registerMenuItem, type MenuContext } from './root';

/**
 * An item of a menu: a button with its role, an item of the list of the menu, and an item that
 * the filter can hide. A link item is a native link with no button rule.
 */
export function useMenuItem(options: {
  part: string;
  element: Readonly<Ref<HTMLElement | null>>;
  id: () => string | undefined;
  label: () => string | undefined;
  /** Disabled by the part. */
  disabled: () => boolean;
  /** The tag of the element before the mount (a tag in `as`). */
  tag: () => string | undefined;
  role: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';
  link?: boolean;
  /** The menu whose list has the item: the parent of a submenu trigger. */
  menu?: MenuContext;
}) {
  const menu = options.menu ?? injectMenu(options.part);
  const generatedId = useId();
  const id = computed(() => givenId(options.id()) ?? generatedId);
  const disabled = computed(() => !options.link && (options.disabled() || menu.disabled));
  const button = options.link
    ? null
    : useButton({
        element: options.element,
        disabled: () => disabled.value,
        focusableWhenDisabled: () => true,
        tag: options.tag,
      });
  const { highlighted, attributes } = useListItem(menu.list, options.element, {
    label: options.label,
    disabled: () => disabled.value,
  });
  const text = () => {
    const label = options.label();
    if (label !== undefined) return label.trim();
    return options.element.value?.textContent?.trim() ?? '';
  };
  const filtered = useFilteredItem(menu, text);
  onUnmounted(filtered.remove);
  watch(
    options.element,
    (element, _, onCleanup) => {
      if (element) onCleanup(registerMenuItem(element, { disabled: () => disabled.value }));
    },
    { immediate: true },
  );

  // A link gives no click for Space (test/measurements/menu.test.ts).
  let spaceDown = false;
  function onKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    // While the user types a string, Space is a character of it, and the button rule then gives no
    // click.
    if (event.key === ' ' && menu.typeahead.typing) {
      menu.typeahead.onKeydown(event);
      return;
    }
    if (options.link && event.key === ' ' && !event.defaultPrevented) {
      event.preventDefault();
      spaceDown = true;
    }
  }
  function onKeyup(event: KeyboardEvent) {
    if (!options.link || event.key !== ' ' || !spaceDown) return;
    spaceDown = false;
    if (!event.defaultPrevented) dispatchClickWithModifiers(event.currentTarget as Element, event);
  }

  // The button rule clicks an element that is no native button at the `keydown` of Enter. The
  // focus can then go back to the trigger, and the activation of that `keydown` would press it.
  function endEnter(event: KeyboardEvent) {
    const element = event.currentTarget as Element;
    if (event.key !== 'Enter' || event.target !== element) return;
    if (element.localName !== 'button' && element.localName !== 'input') event.preventDefault();
  }

  return {
    menu,
    id,
    disabled,
    highlighted,
    shown: filtered.shown,
    /** The attributes of the element. The values of the developer (`attrs`) win. */
    mergeAttributes(own: Record<string, unknown>, attrs: Record<string, unknown>) {
      const filter = menu.filter;
      const selected =
        platform.engine.webkit && !!filter?.inputFocused && highlighted.value ? 'true' : undefined;
      const base = mergeProps(attributes.value, {
        role: options.role,
        id: id.value,
        // `aria-selected` is invalid on a menu item, but VoiceOver in Safari needs it to read the
        // item of `aria-activedescendant` at an arrow key. Only WebKit with the focus in the input
        // gets it.
        'aria-selected': selected,
        hidden: filtered.shown.value ? undefined : true,
        onKeydown,
        onKeyup,
      });
      const merged = mergeProps(base, own);
      if (!button) return mergeProps(merged, attrs);
      return mergeProps(button.mergeAttributes(merged, attrs), { onKeydown: endEnter });
    },
  };
}
