import { inject } from 'vue';
import type { InjectionKey, Ref } from 'vue';

export interface DrawerProviderContext {
  setDrawerOpen: (drawer: object, open: boolean) => void;
  removeDrawer: (drawer: object) => void;
  active: Readonly<Ref<boolean>>;
  readonly visualState: Readonly<DrawerVisualState>;
  setVisualState: (state: Partial<DrawerVisualState>, owner?: object) => void;
}

export const DrawerProviderContext: InjectionKey<DrawerProviderContext> = Symbol();

export interface DrawerVisualState {
  swipeProgress: number;
  frontmostHeight: number;
}

export function useDrawerProviderContext(): DrawerProviderContext | undefined {
  return inject(DrawerProviderContext, undefined);
}
