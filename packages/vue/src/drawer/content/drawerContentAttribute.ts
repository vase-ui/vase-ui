import type { DialogStore } from '../dialog/store/DialogStore';

export const DRAWER_CONTENT_ATTRIBUTE = 'data-drawer-content';

export const drawerContents = new WeakMap<Element, () => DialogStore<unknown>>();
