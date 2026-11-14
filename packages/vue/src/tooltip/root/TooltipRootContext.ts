import { inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { TooltipStore } from '../store/TooltipStore';

export type TooltipRootContext<Payload = unknown> = TooltipStore<Payload>;

export const TooltipRootContext: InjectionKey<TooltipRootContext<any>> = Symbol();

export function useTooltipRootContext(optional?: false): TooltipRootContext;
export function useTooltipRootContext(optional: true): TooltipRootContext | undefined;
export function useTooltipRootContext(optional?: boolean) {
  const context = inject(TooltipRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of Tooltip must be inside <Tooltip.Root>. Without a root the part has no tooltip state. Put the part inside <Tooltip.Root>.',
    );
  }
  return context;
}
