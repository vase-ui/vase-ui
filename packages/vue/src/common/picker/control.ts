import { inject, onScopeDispose, provide, type InjectionKey } from 'vue';

/** What a picker part gives to the calendar root or the clock root that it renders. */
export interface PickerForControl {
  /** Adds the element that takes the focus when the popup opens. Returns the function that removes it. */
  addFocusTarget(target: () => HTMLElement | null | undefined): () => void;
  /** The user completed a pick with a press or a drag, also when the value did not change. */
  onPick(event: Event): void;
  /** The control took an Escape for itself and prevented the key. */
  onCancel(event: KeyboardEvent): void;
}

export const pickerControlKey: InjectionKey<PickerForControl | null> = Symbol('picker control');

/**
 * The picker part around a calendar root or a clock root. The root provides `null`, so a calendar
 * in it has its own selection. `target` takes the focus when the popup opens.
 */
export function usePickerControl(target: () => HTMLElement | null | undefined) {
  const picker = inject(pickerControlKey, null);
  provide(pickerControlKey, null);
  if (picker) onScopeDispose(picker.addFocusTarget(target));
  return picker;
}
