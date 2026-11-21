<script setup lang="ts">
import { computed, mergeProps, provide, shallowReactive, useAttrs } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement, type ElementSlotProps } from '../common/element';
import { useModel } from '../common/model';
import { collapsibleKey, type CollapsiblePanelEntry } from './part';
import type { CollapsibleRootEmits, CollapsibleRootProps, CollapsibleRootState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<CollapsibleRootProps>(), {
  open: undefined,
  defaultOpen: false,
  disabled: false,
});
const emit = defineEmits<CollapsibleRootEmits>();
defineSlots<{
  default?(scope: { state: CollapsibleRootState }): unknown;
  element?(scope: ElementSlotProps<CollapsibleRootState>): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const { value: isOpen, setOwn } = useModel(() => props.open, props.defaultOpen);
const panels = shallowReactive<CollapsiblePanelEntry[]>([]);
const state = computed<CollapsibleRootState>(() => ({
  open: isOpen.value,
  disabled: props.disabled,
}));

provide(collapsibleKey, {
  get open() {
    return isOpen.value;
  },
  get disabled() {
    return props.disabled;
  },
  get panelId() {
    return panels[0]?.id;
  },
  request(next, reason, event) {
    const details = createChangeEventDetails(reason, event);
    emit('openChange', next, details);
    if (details.isCanceled) return;
    setOwn(next);
    emit('update:open', next);
  },
  addPanel(panel) {
    panels.push(panel);
    return () => panels.splice(panels.indexOf(panel), 1);
  },
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      'data-open': isOpen.value ? '' : undefined,
      'data-disabled': props.disabled ? '' : undefined,
    },
    attrs,
  );
}
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
