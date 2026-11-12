import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { AvatarRootState, ImageLoadingStatus } from './AvatarRoot.vue';

export interface AvatarRootContext {
  state: ComputedRef<AvatarRootState>;
  setImageLoadingStatus(status: ImageLoadingStatus): void;
}

export const AvatarRootContext: InjectionKey<AvatarRootContext> = Symbol();

export function useAvatarRootContext(): AvatarRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(AvatarRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Avatar must be inside <Avatar.Root>. Without a root the part has no image status to read or to report. Put the part inside <Avatar.Root>.',
    );
  }

  return context;
}
