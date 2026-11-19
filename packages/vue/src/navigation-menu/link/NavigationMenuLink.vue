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
import { computed, shallowRef, type ShallowRef } from 'vue';
import { useCompositeItem } from '../../internals/composite/root/useCompositeRoot';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  useNavigationMenuRootContext,
  useNavigationMenuFocusout,
} from '../root/NavigationMenuRootContext';

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

const { setValue } = useNavigationMenuRootContext();
const onFocusout = useNavigationMenuFocusout();

const state = computed<NavigationMenuLinkState>(() => ({ active: props.active }));

const element: ShallowRef<HTMLElement | null> = shallowRef(null);
const compositeItem = useCompositeItem(element);

const { elementProps, setRef, usesRenderSlot } = useRenderElement('a', props, {
  elementRef: element,
  state,
  props: (attrs) => [
    compositeItem.attributes.value,
    compositeItem.events,
    {
      'aria-current': props.active ? 'page' : undefined,
      // The key removes the `tabindex` of the composite, so the link stays a native tab stop.
      tabindex: undefined,
      onClick(event: MouseEvent) {
        if (props.closeOnClick) {
          setValue(null, createChangeEventDetails(REASONS.linkPress, event));
        }
      },
      onFocusout,
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
