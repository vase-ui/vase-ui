import { inject, onScopeDispose, provide } from 'vue';
import type { InjectionKey } from 'vue';
import { useKeepAliveState } from '../../useKeepAliveState';

export type PickerFocusTarget = () => Element | null | undefined;
export const PickerFocusTargets: InjectionKey<Set<PickerFocusTarget>> = Symbol();

interface PickerControlOwner {
  targets: Set<PickerFocusTarget> | null;
  onSelect?: ((event: Event) => void) | undefined;
}

export const PickerCalendarOwner: InjectionKey<PickerControlOwner | null> = Symbol();
export const PickerClockOwner: InjectionKey<PickerControlOwner | null> = Symbol();

export function providePickerControl(
  key: InjectionKey<PickerControlOwner | null>,
  onSelect?: (event: Event) => void,
) {
  provide(key, { targets: inject(PickerFocusTargets, null), onSelect });
}

export function registerPickerFocusTarget(
  targets: Set<PickerFocusTarget> | null | undefined,
  target: PickerFocusTarget,
) {
  if (targets) {
    const { isHeld } = useKeepAliveState();
    const getElement = () => (isHeld.value ? null : target());
    targets.add(getElement);
    onScopeDispose(() => targets.delete(getElement));
  }
}

export function usePickerControl(
  key: InjectionKey<PickerControlOwner | null>,
  target: PickerFocusTarget,
) {
  const owner = inject(key, null);
  // A standalone calendar or clock nested in this control has its own selection.
  provide(key, null);
  registerPickerFocusTarget(owner?.targets, target);
  return owner?.onSelect;
}
