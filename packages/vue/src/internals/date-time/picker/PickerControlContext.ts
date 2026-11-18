import { inject, provide } from 'vue';
import type { InjectionKey } from 'vue';

export type PickerFocusTarget = () => Element | null | undefined;
type RegisterFocusTarget = (target: PickerFocusTarget) => void;
export const RegisterPickerFocusTarget: InjectionKey<RegisterFocusTarget> = Symbol();

interface PickerControlOwner {
  registerFocusTarget: RegisterFocusTarget | null;
  onSelect?: ((event: Event) => void) | undefined;
}

export const PickerCalendarOwner: InjectionKey<PickerControlOwner | null> = Symbol();
export const PickerClockOwner: InjectionKey<PickerControlOwner | null> = Symbol();

export function providePickerControl(
  key: InjectionKey<PickerControlOwner | null>,
  onSelect?: (event: Event) => void,
) {
  provide(key, { registerFocusTarget: inject(RegisterPickerFocusTarget, null), onSelect });
}

export function usePickerControl(
  key: InjectionKey<PickerControlOwner | null>,
  target: PickerFocusTarget,
) {
  const owner = inject(key, null);
  // A standalone calendar or clock nested in this control has its own selection.
  provide(key, null);
  owner?.registerFocusTarget?.(target);
  return owner?.onSelect;
}
