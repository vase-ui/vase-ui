import { computed, shallowRef, watch } from 'vue';
import { useFormReset } from '../formEvents';
import { usePickerPopup } from './popup';
import type { PickerForPart } from './root';

/** What a field root exposes to the field part that renders it. */
export interface FieldRootExposed {
  element: HTMLElement | null;
  inputElement: HTMLInputElement | null;
  clear(): void;
}

/**
 * The keys of `Props` that a wrapper owns. A key that `Props` does not have is a type error, so a
 * renamed prop of the inner part breaks the build.
 */
export type OwnedKeys<Props, Keys extends keyof Props> = Keys;

/**
 * What the field parts of the pickers share: the element in the root, the native reset, and
 * Alt+ArrowDown. The part binds `setField` as the ref of its field root.
 */
export function usePickerField(picker: PickerForPart<unknown>, part: string) {
  const popup = usePickerPopup(part);
  const field = shallowRef<FieldRootExposed | null>(null);
  const element = computed(() => field.value?.element ?? null);
  const inputElement = computed(() => field.value?.inputElement ?? null);

  watch(
    element,
    (el, _, onCleanup) => {
      if (el) onCleanup(picker.addField(el));
    },
    { flush: 'post' },
  );
  useFormReset(inputElement, (event) => picker.reset(event));

  function onKeydown(event: KeyboardEvent) {
    if (
      event.key !== 'ArrowDown' ||
      !event.altKey ||
      event.shiftKey ||
      event.ctrlKey ||
      event.defaultPrevented ||
      picker.readonly
    ) {
      return;
    }
    event.preventDefault();
    popup.openByKey(event, picker.firstTrigger);
  }

  return {
    setField(value: unknown) {
      field.value = value as FieldRootExposed | null;
    },
    element,
    inputElement,
    onKeydown,
    /** Empties each segment of the field root. */
    clearSegments() {
      field.value?.clear();
    },
  };
}
