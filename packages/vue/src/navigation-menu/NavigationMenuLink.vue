<script setup lang="ts">
import { mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { useKeyGroupItem } from './keys';
import { injectNavigationMenuRoot } from './root';
import type { NavigationMenuLinkProps, NavigationMenuLinkState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuLinkProps>(), { closeOnClick: false });
defineSlots<{
  default?(scope: { state: NavigationMenuLinkState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: NavigationMenuLinkState;
  }): unknown;
}>();

const root = injectNavigationMenuRoot('Link');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const state: NavigationMenuLinkState = {};
useKeyGroupItem(element);

function onClick(event: MouseEvent) {
  if (props.closeOnClick) root.close('link-press', event);
}

function elementProps() {
  return mergeProps({ onClick }, attrs);
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <a v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </a>
</template>
