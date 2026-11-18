import type { ComputedRef } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { usePickerPopup } from '../../internals/date-time/picker/usePickerPopup';
import { withTime } from '../../internals/date-time/temporal';
import { REASONS } from '../../internals/reasons';
import type { TimePickerRootContext } from '../root/TimePickerRootContext';

export interface UseTimePickerOptionParameters {
  picker: TimePickerRootContext;
  /** Whether the time of the picker has the value of the option. */
  selected: ComputedRef<boolean>;
  /** Whether the user cannot select the option. */
  disabled: ComputedRef<boolean>;
  /** Whether a selection of the option closes the popup. */
  closeOnSelect: ComputedRef<boolean>;
  /** The time that a press on the option gives to the picker. */
  time: () => Temporal.PlainTime;
}

/**
 * The role, the tab stop, the press and the keys of an option of a list or of a column of a time
 * picker. The part gives `compositeRef` first in `ref` and the result of `optionProps()` as the
 * first sets of `props` of `useRenderElement`.
 */
export function useTimePickerOption(parameters: UseTimePickerOptionParameters) {
  const { picker, selected, disabled } = parameters;
  const popup = usePickerPopup();
  const isHydrating = useIsHydrating();
  const { compositeProps, compositeRef } = useCompositeItem({
    active: selected,
    selected,
    disabled,
  });

  // A press on the selected option changes no value, and it still closes the popup when a
  // selection does.
  function select(event: MouseEvent | KeyboardEvent) {
    if (disabled.value || picker.readOnly.value) {
      return;
    }
    if (!selected.value) {
      const details = createChangeEventDetails(REASONS.itemPress, event);
      picker.commit(withTime(picker.template.value, parameters.time()), details);
      if (details.isCanceled) {
        return;
      }
    }
    if (parameters.closeOnSelect.value) {
      popup.closeAfterSelection(event);
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      select(event);
    }
  }

  function optionProps() {
    return [
      compositeProps.value,
      {
        role: 'option',
        'aria-selected': selected.value,
        'aria-disabled': disabled.value || undefined,
        // The text comes from the data of `Intl` in the engine, and a server and a browser can
        // differ.
        'data-allow-mismatch': isHydrating.value ? 'attribute,text' : undefined,
        onClick: select,
        onKeydown,
      },
    ];
  }

  return { compositeRef, optionProps };
}
