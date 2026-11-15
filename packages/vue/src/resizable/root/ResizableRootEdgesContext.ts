import { inject } from 'vue';
import type { InjectionKey, ShallowRef } from 'vue';
import type { EdgeBoundary } from '../utils/useEdges';

export interface ResizableRootEdgesContext {
  /**
   * The boundaries of two panels that have no handle between them, with the boxes of their edge
   * nodes. The list is empty on a server, in the first client render, and in a root with no
   * `dragEdges`.
   */
  edges: Readonly<ShallowRef<readonly EdgeBoundary[]>>;
}

export const ResizableRootEdgesContext: InjectionKey<ResizableRootEdgesContext> = Symbol();

export function useResizableRootEdgesContext(): ResizableRootEdgesContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ResizableRootEdgesContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: The `children` component of <Resizable.Root> must be inside <Resizable.Root>. Without the part it has no edges to render. Mount the `children` component in the element of the `#render` slot of <Resizable.Root>.',
    );
  }

  return context;
}
