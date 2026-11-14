import { inject } from 'vue';
import type { ComputedRef, CSSProperties, InjectionKey, Ref, ShallowRef } from 'vue';

/**
 * What `usePopupViewport` gives to `PopupViewportChildren`, the component that renders the
 * containers of the viewport.
 */
export interface PopupViewportContext {
  /**
   * The key of the current container. A new key mounts the container again.
   */
  currentContentKey: ComputedRef<string>;
  /**
   * Whether the viewport shows the previous content beside the current content.
   */
  transitioning: ComputedRef<boolean>;
  /**
   * Whether the current container has `data-starting-style` and the previous container does not
   * have `data-ending-style`.
   */
  showStartingStyle: Readonly<Ref<boolean>>;
  previousContainerStyle: ComputedRef<CSSProperties>;
  currentContainerRef: ShallowRef<HTMLElement | null>;
  previousContainerRef: ShallowRef<HTMLElement | null>;
}

export const PopupViewportContext: InjectionKey<PopupViewportContext> = Symbol();

export function usePopupViewportContext(): PopupViewportContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(PopupViewportContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <PopupViewportChildren> must be inside a viewport part. Without a viewport it has no containers to render. Mount it in the `children` slot prop of the viewport part.',
    );
  }

  return context;
}
