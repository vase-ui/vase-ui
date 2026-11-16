import { inject } from 'vue';
import type { ComputedRef, CSSProperties, InjectionKey } from 'vue';

export interface ResizableHandleContext {
  /**
   * The style of the hit area node: the area that takes a press on the handle.
   */
  hitAreaStyle: ComputedRef<CSSProperties>;
  /**
   * The `ref` setter of the hit area node. The handle registers the node in the registry of the
   * crossings.
   */
  hitAreaRef: (element: unknown) => void;
}

export const ResizableHandleContext: InjectionKey<ResizableHandleContext> = Symbol();

export function useResizableHandleContext(): ResizableHandleContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ResizableHandleContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The `children` component of <Resizable.Handle> must be inside <Resizable.Handle>. Without the part it has no hit area to render. Mount the `children` component in the element of the `#render` slot of <Resizable.Handle>.',
    );
  }

  return context;
}
