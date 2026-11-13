import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type { Orientation } from '../../internals/types';

export interface ToolbarRootContext {
  disabled: ComputedRef<boolean>;
  orientation: ComputedRef<Orientation>;
}

export const ToolbarRootContext: InjectionKey<ToolbarRootContext> = Symbol();

export function useToolbarRootContext(optional?: false): ToolbarRootContext;
export function useToolbarRootContext(optional: true): ToolbarRootContext | undefined;
export function useToolbarRootContext(optional?: boolean) {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ToolbarRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of Toolbar must be inside <Toolbar.Root>. Without a root the part has no orientation and no disabled state. Put the part inside <Toolbar.Root>.',
    );
  }

  return context;
}
