import { inject } from 'vue';
import type { InjectionKey, Ref, ShallowRef } from 'vue';

export interface ScrubCursor {
  element: HTMLSpanElement;
  setTransform: (transform: string) => void;
}

export interface NumberFieldScrubAreaContext {
  isScrubbing: Readonly<Ref<boolean>>;
  isTouchInput: Readonly<Ref<boolean>>;
  isPointerLockDenied: Readonly<Ref<boolean>>;
  cursor: ShallowRef<ScrubCursor | null>;
  /**
   * The element of the scrub area. `NumberField.ScrubAreaCursor` renders in its root node.
   */
  scrubAreaElement: Readonly<ShallowRef<HTMLElement | null>>;
}

export const NumberFieldScrubAreaContext: InjectionKey<NumberFieldScrubAreaContext> = Symbol();

export function useNumberFieldScrubAreaContext(): NumberFieldScrubAreaContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(NumberFieldScrubAreaContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of the scrub area of Number Field must be inside <NumberField.ScrubArea>. Without a scrub area the part has no scrub to follow. Put the part inside <NumberField.ScrubArea>.',
    );
  }
  return context;
}
