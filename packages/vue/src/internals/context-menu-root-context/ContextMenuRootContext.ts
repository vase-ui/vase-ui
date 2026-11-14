import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';
import type { PopupOpenChangeEventDetails } from '../../utils/popups/store';

export interface ContextMenuAnchor {
  getBoundingClientRect: () => DOMRect;
}

export interface ContextMenuRootContext {
  anchor: Readonly<Ref<ContextMenuAnchor>>;
  setAnchor: (anchor: ContextMenuAnchor) => void;
  backdropRef: ShallowRef<HTMLDivElement | null>;
  internalBackdropRef: ShallowRef<HTMLDivElement | null>;
  actionsRef: Ref<{
    setOpen(
      nextOpen: boolean,
      eventDetails: Omit<PopupOpenChangeEventDetails, 'preventUnmountOnClose'>,
    ): void;
  } | null>;
  positionerRef: ShallowRef<HTMLElement | null>;
  allowMouseUpTriggerRef: Ref<boolean>;
  initialCursorPointRef: Ref<{ x: number; y: number } | null>;
  rootId: ComputedRef<string | undefined>;
}

export const ContextMenuRootContext: InjectionKey<ContextMenuRootContext> = Symbol();

export function useContextMenuRootContext(optional: false): ContextMenuRootContext;
export function useContextMenuRootContext(optional?: true): ContextMenuRootContext | undefined;
export function useContextMenuRootContext(optional = true) {
  // The default `undefined` stops the Vue warning for a missing provider. The error below says more.
  const context = inject(ContextMenuRootContext, undefined);
  if (context === undefined && !optional) {
    throw new Error(
      'Vase UI: A part of Context Menu must be inside <ContextMenu.Root>. Without a root the part has no context menu state. Put the part inside <ContextMenu.Root>.',
    );
  }

  return context;
}
