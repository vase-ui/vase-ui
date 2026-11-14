import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { PopoverStore } from '../store/PopoverStore';

export type PopoverRootContext<Payload = unknown> = PopoverStore<Payload>;

export const PopoverRootContext: InjectionKey<PopoverRootContext<any>> = Symbol();

export function usePopoverRootContext(optional?: false): PopoverRootContext;
export function usePopoverRootContext(optional: true): PopoverRootContext | undefined;
export function usePopoverRootContext(optional?: boolean) {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(PopoverRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of Popover must be inside <Popover.Root>. Without a root the part has no popover state. Put the part inside <Popover.Root>.',
    );
  }
  return context;
}
