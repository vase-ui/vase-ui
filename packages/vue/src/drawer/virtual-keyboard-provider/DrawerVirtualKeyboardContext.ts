import { inject } from 'vue';
import type { InjectionKey } from 'vue';

export interface DrawerVirtualKeyboardContext {
  onTouchStart: (event: TouchEvent) => void;
  // Driven by the viewport's native `touchmove` listener so it still fires when the
  // swipe gesture claims the event with `stopPropagation()`.
  onTouchMove: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
  onTouchCancel: () => void;
}

export const DrawerVirtualKeyboardContext: InjectionKey<DrawerVirtualKeyboardContext> = Symbol();

export function useDrawerVirtualKeyboardContext(): DrawerVirtualKeyboardContext | undefined {
  return inject(DrawerVirtualKeyboardContext, undefined);
}
