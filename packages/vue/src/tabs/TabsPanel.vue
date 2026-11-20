<script setup lang="ts" generic="Value = any">
import { computed, mergeProps, onUnmounted, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { injectTabsRoot, rootStateAttributes } from './root';
import type { TabsPanelProps, TabsPanelState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabsPanelProps<Value>>(), { keepMounted: false });
defineSlots<{
  default?(scope: { state: TabsPanelState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TabsPanelState;
  }): unknown;
}>();

const root = injectTabsRoot();
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

const elementId = computed(() => givenId(props.id) ?? generatedId);
const open = computed(() => root.value === props.value);
const { waiting } = useEnterAfterLeave(() => open.value, element);
const shown = computed(() => (open.value && !waiting.value) || props.keepMounted);
const state = computed<TabsPanelState>(() => ({ ...root.state, hidden: !open.value }));

// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const unregister = root.addPanel({
  get value() {
    return props.value;
  },
  get id() {
    return elementId.value;
  },
  get shown() {
    return shown.value;
  },
});
onUnmounted(unregister);

// Vue does not patch an element that leaves in a `<Transition>`. A style of the leave then reads
// the side of the new tab.
watch(
  () => root.state.tabActivationDirection,
  (direction) => element.value?.setAttribute('data-activation-direction', direction),
  { flush: 'sync' },
);

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      role: 'tabpanel',
      id: elementId.value,
      'aria-labelledby': root.tabId(props.value),
      tabindex: open.value ? 0 : undefined,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: open.value ? undefined : true,
      inert: open.value ? undefined : true,
      ...rootStateAttributes(root.state),
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
