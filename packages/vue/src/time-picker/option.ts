import { computed, useAttrs, watch } from 'vue';
import { useButton } from '../common/button';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { withTime } from '../common/date-time/temporal';
import { useAsTag, useElement } from '../common/element';
import { usePickerPopup } from '../common/picker/popup';
import type { ListboxForItem } from './listbox';
import type { TimePickerForPart } from './root';
import type { TimePickerItemState } from './types';

/**
 * What `TimePicker.Item` and `TimePicker.ColumnItem` share: a `<button type="button">` with the
 * role `option`. A press gives the time of the item to the picker.
 */
export function useOption(
  picker: TimePickerForPart,
  listbox: ListboxForItem,
  options: {
    part: string;
    key: () => string;
    selected: () => boolean;
    /** The `disabled` prop of the item. */
    ownDisabled: () => boolean;
    /** Disabled by the item or by its listbox, not by the picker. */
    disabled: () => boolean;
    /** The time that a press gives. */
    time: () => Temporal.PlainTime;
    as: () => unknown;
  },
) {
  const popup = usePickerPopup(options.part);
  const attrs = useAttrs();
  const { element, setElement } = useElement<HTMLElement>();
  const button = useButton({
    element,
    disabled: () => options.disabled() || picker.disabled,
    type: 'button',
    tag: useAsTag(options.as, 'button'),
  });

  watch(
    element,
    (el, _, onCleanup) => {
      if (!el) return;
      onCleanup(
        listbox.addItem({
          get key() {
            return options.key();
          },
          element: el,
          get disabled() {
            return options.ownDisabled();
          },
        }),
      );
    },
    { flush: 'post' },
  );

  const state = computed<TimePickerItemState>(() => ({
    selected: options.selected(),
    disabled: button.disabled.value,
  }));

  // A press on the selected item changes no value, and still closes the popup.
  function onClick(event: MouseEvent) {
    if (picker.readonly) return;
    if (!options.selected()) {
      const details = createChangeEventDetails('item-press', event);
      if (!picker.commit(withTime(picker.template, options.time()), details)) return;
    }
    if (listbox.closes) popup.closeAfterPick(event);
  }

  return {
    element,
    setElement,
    state,
    elementProps() {
      return button.mergeAttributes(
        {
          role: 'option',
          'aria-selected': options.selected() ? 'true' : 'false',
          tabindex: listbox.tabStop === options.key() ? 0 : -1,
          // A server with other `Intl` data has another text.
          'data-allow-mismatch': 'text',
          onClick,
        },
        attrs,
      );
    },
  };
}
