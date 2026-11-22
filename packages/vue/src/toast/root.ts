import { inject, provide, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { usePlacement } from '../popup/placement';
import type { ToastObject } from './types';

/** What `Toast.Root` gives to its parts. The properties are reactive. */
export interface ToastRootForParts {
  readonly toast: ToastObject;
  /** The pointer or the keyboard focus is in the viewport. */
  readonly expanded: boolean;
  /** A newer toast is in front of the toast. */
  readonly behind: boolean;
  /** The root has `aria-hidden`, so each part in it leaves the tab order. */
  readonly ariaHidden: boolean;
  /** The focus is in the root, from the keyboard or from a press. */
  readonly focusWithin: boolean;
  /** Adds a title or a description. The root names the last one that shows. */
  addLabel(
    kind: 'title' | 'description',
    label: { readonly id: string; readonly shown: boolean },
  ): () => void;
  /** Measures the natural height of the root. */
  measure(): void;
}

const rootKey: InjectionKey<ToastRootForParts> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'toast root' : undefined,
);

export function provideToastRoot(root: ToastRootForParts) {
  provide(rootKey, root);
}

/** The root of the part. A part with no root throws an error that names it. */
export function injectToastRoot(part: string) {
  const root = inject(rootKey, null);
  if (!root) {
    throw createError(69, part);
  }
  return root;
}

const positionerKey: InjectionKey<ReturnType<typeof usePlacement>> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'toast positioner' : undefined,
);

export function providePositioner(placement: ReturnType<typeof usePlacement>) {
  provide(positionerKey, placement);
}

/** The placement of the positioner around the part. A part with no positioner throws an error. */
export function injectPositioner(part: string) {
  const placement = inject(positionerKey, null);
  if (!placement) {
    throw createError(70, part);
  }
  return placement;
}
