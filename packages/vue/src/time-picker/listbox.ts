import {
  computed,
  inject,
  onScopeDispose,
  shallowReactive,
  type InjectionKey,
  type Ref,
} from 'vue';
import { arrowKeyTarget } from '../common/arrowKeyTarget';
import { byDocumentOrder } from '../common/element';
import { addPopupFocusTarget, injectPopupElement } from '../common/picker/popup';
import type { TimePickerColumnUnit, TimePickerColumnValue } from './columns';

/** An item of a list or a column, while it is mounted. The properties are reactive. */
export interface ListboxItem {
  readonly key: string;
  readonly element: HTMLElement;
  /** The developer disabled the item. */
  readonly disabled: boolean;
}

/** What `TimePicker.List` and `TimePicker.Column` give to their items. The properties are reactive. */
export interface ListboxForItem {
  /** The key of the item that has the tab stop. */
  readonly tabStop: string | undefined;
  /** A press on an item closes the popup. */
  readonly closes: boolean;
  addItem(item: ListboxItem): () => void;
}

export const listKey: InjectionKey<ListboxForItem> = Symbol('time picker list');

/** What `TimePicker.Column` gives to its items. The properties are reactive. */
export interface ColumnForItem extends ListboxForItem {
  readonly unit: TimePickerColumnUnit;
  /** No time with the value is in `min` and `max`. */
  outOfLimits(value: TimePickerColumnValue): boolean;
}

export const columnKey: InjectionKey<ColumnForItem> = Symbol('time picker column');

export function injectListbox<Listbox>(key: InjectionKey<Listbox>, part: string, parent: string) {
  const listbox = inject(key, null);
  if (!listbox) {
    throw new Error(
      `Vase UI: <TimePicker.${part}> must be inside <TimePicker.${parent}>. Without it the item has no time to give. Put the item inside <TimePicker.${parent}>.`,
    );
  }
  return listbox;
}

/**
 * The tab stop, the keys and the scroll of a listbox of a time picker. The tab stop is the selected
 * item when it is enabled, else the first enabled item, from the keys of the values in their order,
 * so the server HTML has it.
 */
export function useListbox(options: {
  element: Readonly<Ref<HTMLElement | null>>;
  keys: () => readonly string[];
  selected: () => string | undefined;
  /** The listbox disables the item of the key. */
  disabled?: (key: string) => boolean;
}) {
  const items = shallowReactive<ListboxItem[]>([]);
  const enabled = (key: string) =>
    !options.disabled?.(key) && !items.some((item) => item.key === key && item.disabled);
  const tabStop = computed(() => {
    const keys = options.keys();
    const selected = options.selected();
    return selected !== undefined && keys.includes(selected) && enabled(selected)
      ? selected
      : keys.find(enabled);
  });
  const popupElement = injectPopupElement();

  onScopeDispose(
    addPopupFocusTarget(() => items.find((item) => item.key === tabStop.value)?.element),
  );

  function onKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const elements = items
      .filter((item) => enabled(item.key))
      .map((item) => item.element)
      .sort(byDocumentOrder);
    const target =
      event.key === 'Home'
        ? elements[0]
        : event.key === 'End'
          ? elements.at(-1)
          : arrowKeyTarget(event.key, event.target as HTMLElement, elements, {
              orientation: 'vertical',
              rtl: false,
              loop: true,
            });
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
  }

  // A focus with `preventScroll`, as the first focus of a popup, shows no item
  // (test/measurements/picker.test.ts). Each element that scrolls, up to the popup, shows the
  // focused item by the least distance. The page does not scroll.
  function onFocusin(event: FocusEvent) {
    const item = event.target as HTMLElement;
    const boundary = [popupElement(), options.element.value].find((element) =>
      element?.contains(item),
    );
    for (let box = item.parentElement; box && boundary; box = box.parentElement) {
      if (box.scrollHeight > box.clientHeight) {
        const shown = item.getBoundingClientRect();
        const top = box.getBoundingClientRect().top + box.clientTop;
        const bottom = top + box.clientHeight;
        if (shown.top < top) box.scrollTop -= top - shown.top;
        else if (shown.bottom > bottom) box.scrollTop += shown.bottom - bottom;
      }
      if (box === boundary) break;
    }
  }

  return {
    onKeydown,
    onFocusin,
    forItem: {
      get tabStop() {
        return tabStop.value;
      },
      addItem(item: ListboxItem) {
        items.push(item);
        return () => items.splice(items.indexOf(item), 1);
      },
    },
  };
}
