import { inject } from 'vue';
import type { CSSProperties, InjectionKey, Ref } from 'vue';

export interface DrawerViewportContext {
  swiping: Readonly<Ref<boolean>>;
  getDragStyles: () => CSSProperties;
  getProgress: () => number;
  cancelHeldPopup: (popup: HTMLElement | null) => void;
  height: Readonly<Ref<number>>;
  release: Readonly<Ref<{ strength: number | null } | null>>;
}

export const DrawerViewportContext: InjectionKey<DrawerViewportContext> = Symbol();

export function useDrawerViewportContext(): DrawerViewportContext | undefined {
  return inject(DrawerViewportContext, undefined);
}
