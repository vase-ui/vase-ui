import { computed, provide, toRaw, watch } from 'vue';
import type { Ref } from 'vue';
import { useControlled } from '../../common/useControlled';
import { useFilterDropdownRoot } from '../../filter-dropdown/root/FilterDropdownRoot';
import type { FilterDropdownFilter } from '../../filter-dropdown/root/FilterDropdownRootContext';
import { useFilterDropdownCloseQuery } from '../../filter-dropdown/root/useFilterDropdownCloseQuery';
import { useMenubarContext } from '../../internals/menubar-context/MenubarContext';
import { REASONS } from '../../internals/reasons';
import type { VaseUIEvent } from '../../internals/types';
import { isVirtualPointerEvent } from '../../utils/popups/event';
import type { MenuFilterProviderChangeEventDetails } from '../filter-provider/MenuFilterProvider.vue';
import type { MenuRootContext } from '../root/MenuRootContext';
import { MenuFilterImplContext } from './MenuFilterContext';
import { MENU_FILTER_IMPL } from './MenuFilterImpl';
import { useMenuFilterKeyDown } from './useMenuFilterKeyDown';

export interface MenuFilterDropdownParameters {
  /** The filter query. `undefined` when the query is not controlled. */
  value: () => string | undefined;
  /** The query when the menu mounts and the query is not controlled. */
  defaultValue: () => string | undefined;
  /** Emits `valueChange`, and then `update:value` when `details.isCanceled` is `false`. */
  onValueChange: (value: string, eventDetails: MenuFilterProviderChangeEventDetails) => void;
  filter: () => FilterDropdownFilter | null | undefined;
  autoHighlight: () => boolean | 'always' | undefined;
  locale: () => Intl.LocalesArgument | undefined;
  /** The element that holds real focus. The input of the menu writes it. */
  focusOwnerRef: Ref<HTMLElement | null>;
}

function isTypeaheadKey(event: KeyboardEvent) {
  return (
    event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

/**
 * Gives the filter engine the list that the menu navigates and the command that moves its
 * highlight, and provides the filter to the parts of the menu. The root owns the query. The open
 * state stays with the menu root.
 *
 * Call it in the `setup` of `Menu.Root`, with the context that `useMenuRoot` returned. A component
 * cannot inject the context that it provides.
 */
export function provideMenuFilterDropdown(
  context: MenuRootContext,
  params: MenuFilterDropdownParameters,
) {
  const { store } = context;

  const open = computed(() => store.select('open'));
  const mounted = computed(() => store.select('mounted'));
  const keyboardOpen = computed(() => store.select('keyboardOpen'));
  const disabled = computed(() => store.select('disabled'));

  const [value, setValue] = useControlled({
    controlled: params.value,
    default: () => params.defaultValue() ?? '',
    name: 'MenuFilterProvider',
    state: 'value',
  });

  function handleValueChange(
    nextValue: string,
    eventDetails: MenuFilterProviderChangeEventDetails,
  ) {
    params.onValueChange(nextValue, eventDetails);
    if (!eventDetails.isCanceled) {
      setValue(nextValue);
    }
  }

  const query = useFilterDropdownCloseQuery({
    open,
    mounted,
    value,
    onValueChange: handleValueChange,
  });

  const isInMenubar = useMenubarContext(true) !== undefined;
  const handleInputKeydown = useMenuFilterKeyDown(context, () => value.value !== '');

  // The props of the triggers of a filterable menu: dialog semantics, screen reader press
  // tracking, and a relay of list navigation typed on the trigger to the input, since the input
  // holds real focus while the popup is open. They read the query when a key comes, so they never
  // change. They are written before the triggers render.
  store.set('filterTriggerProps', {
    'aria-haspopup': 'dialog',
    onPointerdown(event: PointerEvent) {
      store.context.virtualPress = isVirtualPointerEvent(event);
    },
    onKeydown(event: KeyboardEvent) {
      const focusOwner = store.context.virtualFocusRef?.value;
      if (!store.select('open') || !focusOwner || isInMenubar) {
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        focusOwner.focus({ preventScroll: true });
        handleInputKeydown(event);
        event.preventDefault();
        (event as VaseUIEvent<KeyboardEvent>).preventVaseUIHandler();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Cross-axis keys drive submenu open/close, which the trigger must not relay.
        (event as VaseUIEvent<KeyboardEvent>).preventVaseUIHandler();
      } else if (isTypeaheadKey(event)) {
        focusOwner.focus({ preventScroll: true });
      }
    },
  });

  // Only `setOpen` records a keyboard open, so a controlled close that bypasses it must not leave
  // the next programmatic open looking like one.
  watch(open, (isOpen) => {
    if (!isOpen) {
      store.set('keyboardOpen', false);
    }
  });

  // Trust the rendered element's id once it exists: an explicitly empty id must not fall back to a
  // registered id that no element carries.
  const triggerId = computed(() => {
    const activeTriggerElement = store.select('activeTriggerElement');
    return activeTriggerElement ? activeTriggerElement.id || null : store.select('activeTriggerId');
  });

  provide(MenuFilterImplContext, MENU_FILTER_IMPL);

  useFilterDropdownRoot({
    open,
    openedByKeyboard: keyboardOpen,
    disabled,
    value,
    query,
    onValueChange: handleValueChange,
    triggerId,
    listRef: store.context.itemDomElements,
    getActiveIndex: () => toRaw(store.state).activeIndex,
    setActiveIndex(index) {
      store.setActiveIndex(index, REASONS.none);
    },
    focusOwnerRef: params.focusOwnerRef,
    filter: params.filter,
    autoHighlight: params.autoHighlight,
    locale: params.locale,
  });
}
