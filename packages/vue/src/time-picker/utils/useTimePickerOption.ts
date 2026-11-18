import type { ComputedRef, Ref } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { useCompositeItem } from '../../internals/composite/root/useCompositeRoot';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
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

/** Supplies the tab stop and activation of a time option. */
export function useTimePickerOption(
  element: Readonly<Ref<HTMLElement | null>>,
  parameters: UseTimePickerOptionParameters,
) {
  const { picker, selected, disabled } = parameters;
  const popup = usePickerPopup();
  const isHydrating = useIsHydrating();
  const item = useCompositeItem(element, {
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
      item.attributes.value,
      item.events,
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

  return optionProps;
}
