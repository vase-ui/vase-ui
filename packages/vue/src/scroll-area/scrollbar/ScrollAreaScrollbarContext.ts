import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';

export type ScrollAreaScrollbarContext = ComputedRef<'horizontal' | 'vertical'>;

export const ScrollAreaScrollbarContext: InjectionKey<ScrollAreaScrollbarContext> = Symbol();

export function useScrollAreaScrollbarContext(): ScrollAreaScrollbarContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ScrollAreaScrollbarContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <ScrollArea.Thumb> must be inside <ScrollArea.Scrollbar>. Without a scrollbar the thumb has no orientation. Put <ScrollArea.Thumb> inside <ScrollArea.Scrollbar>.',
    );
  }

  return context;
}
