import { inject } from 'vue';
import type { CSSProperties, InjectionKey, Ref } from 'vue';

export interface DrawerViewportContext {
  swiping: Readonly<Ref<boolean>>;
  getDragStyles: () => CSSProperties;
  swipeStrength: Readonly<Ref<number | null>>;
}

export const DrawerViewportContext: InjectionKey<DrawerViewportContext> = Symbol();

export function useDrawerViewportContext(): DrawerViewportContext | undefined {
  return inject(DrawerViewportContext, undefined);
}
