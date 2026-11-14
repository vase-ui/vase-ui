import { computed, defineComponent, provide, shallowRef } from 'vue';
import type { PropType } from 'vue';
import type { ContextMenuRootContext as ContextMenuRootContextValue } from '../../src/internals/context-menu-root-context/ContextMenuRootContext';
import { ContextMenuRootContext } from '../../src/internals/context-menu-root-context/ContextMenuRootContext';
import type { MenubarContext as MenubarContextValue } from '../../src/internals/menubar-context/MenubarContext';
import { MenubarContext } from '../../src/internals/menubar-context/MenubarContext';

// The contexts of the parents of a menu: a menubar and a context menu. A test gives the members
// that it reads, and the others have plain values.

export function createMenubarContext(
  overrides: Partial<MenubarContextValue> = {},
): MenubarContextValue {
  return {
    modal: computed(() => true),
    disabled: computed(() => false),
    contentElement: shallowRef(null),
    hasSubmenuOpen: shallowRef(false),
    setHasSubmenuOpen() {},
    orientation: computed(() => 'horizontal' as const),
    allowMouseUpTriggerRef: shallowRef(false),
    rootId: computed(() => 'menubar'),
    ...overrides,
  };
}

export function createContextMenuContext(
  overrides: Partial<ContextMenuRootContextValue> = {},
): ContextMenuRootContextValue {
  return {
    anchor: shallowRef({ getBoundingClientRect: () => new DOMRect() }),
    setAnchor() {},
    backdropRef: shallowRef(null),
    internalBackdropRef: shallowRef(null),
    actionsRef: shallowRef(null),
    positionerRef: shallowRef(null),
    allowMouseUpTriggerRef: shallowRef(false),
    initialCursorPointRef: shallowRef(null),
    rootId: computed(() => 'context-menu'),
    ...overrides,
  };
}

export const MenubarProvider = defineComponent({
  props: { context: { type: Object as PropType<MenubarContextValue>, required: true } },
  setup(props, { slots }) {
    provide(MenubarContext, props.context);
    return () => slots.default?.();
  },
});

export const ContextMenuProvider = defineComponent({
  props: { context: { type: Object as PropType<ContextMenuRootContextValue>, required: true } },
  setup(props, { slots }) {
    provide(ContextMenuRootContext, props.context);
    return () => slots.default?.();
  },
});
