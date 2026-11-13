import { inject } from 'vue';
import type { InjectionKey } from 'vue';

export interface ScrollAreaViewportContext {
  computeThumbPosition: () => void;
}

export const ScrollAreaViewportContext: InjectionKey<ScrollAreaViewportContext> = Symbol();

export function useScrollAreaViewportContext(): ScrollAreaViewportContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ScrollAreaViewportContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <ScrollArea.Content> must be inside <ScrollArea.Viewport>. Without a viewport the content cannot start a measurement. Put <ScrollArea.Content> inside <ScrollArea.Viewport>.',
    );
  }

  return context;
}
