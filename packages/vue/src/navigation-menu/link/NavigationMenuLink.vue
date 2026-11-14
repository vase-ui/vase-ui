<script lang="ts">
import type { AnchorHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface NavigationMenuLinkState {
  /**
   * Whether the link is the currently active page.
   */
  active: boolean;
}

export interface NavigationMenuLinkProps
  extends
    VaseUIComponentProps<NavigationMenuLinkState>,
    /* @vue-ignore */ WithVaseUIEvent<AnchorHTMLAttributes> {
  /**
   * Whether the link is the currently active page.
   * @default false
   */
  active?: boolean | undefined;
  /**
   * Whether to close the navigation menu when the link is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuLinkProps>(), {
  as: 'a',
  active: false,
  closeOnClick: false,
});

defineSlots<{
  default(props: { state: NavigationMenuLinkState }): unknown;
  render: ComponentRenderFn<AnchorHTMLAttributes & Pick<HTMLProps, 'ref'>, NavigationMenuLinkState>;
}>();

const { setValue, popupElement, positionerElement, rootRef } = useNavigationMenuRootContext();
const nodeId = useNavigationMenuTreeContext();
const tree = useFloatingTree();

const state = computed<NavigationMenuLinkState>(() => ({ active: props.active }));

const { compositeProps, compositeRef } = useCompositeItem();

const { element, elementProps } = useRenderElement('a', props, {
  state,
  ref: [compositeRef],
  props: (attrs) => [
    compositeProps.value,
    {
      'aria-current': props.active ? 'page' : undefined,
      // The key removes the `tabindex` of the composite, so the link stays a native tab stop.
      tabindex: undefined,
      onClick(event: MouseEvent) {
        if (props.closeOnClick) {
          setValue(null, createChangeEventDetails(REASONS.linkPress, event));
        }
      },
      onFocusout(event: FocusEvent) {
        if (
          positionerElement.value &&
          popupElement.value &&
          isOutsideMenuEvent(
            {
              currentTarget: event.currentTarget as HTMLElement | null,
              relatedTarget: event.relatedTarget as HTMLElement | null,
            },
            {
              popupElement: popupElement.value,
              rootElement: rootRef.value,
              tree: tree.value,
              nodeId,
            },
          )
        ) {
          setValue(null, createChangeEventDetails(REASONS.focusOut, event));
        }
      },
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
