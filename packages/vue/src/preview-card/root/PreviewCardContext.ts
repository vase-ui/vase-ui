import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { PreviewCardStore } from '../store/PreviewCardStore';

export type PreviewCardRootContext<Payload = unknown> = PreviewCardStore<Payload>;

export const PreviewCardRootContext: InjectionKey<PreviewCardRootContext<any>> = Symbol();

export function usePreviewCardRootContext(optional?: false): PreviewCardRootContext;
export function usePreviewCardRootContext(optional: true): PreviewCardRootContext | undefined;
export function usePreviewCardRootContext(optional?: boolean) {
  const context = inject(PreviewCardRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of PreviewCard must be inside <PreviewCard.Root>. Without a root the part has no preview card state. Put the part inside <PreviewCard.Root>.',
    );
  }

  return context;
}
