<script setup lang="ts">
import { computed, mergeProps, provide, shallowReactive, useAttrs, useId } from 'vue';
import type { CollapsiblePanelEntry } from '../collapsible/part';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement } from '../common/element';
import { injectAccordionRoot } from './item';
import { accordionItemKey, type AccordionTriggerEntry } from './part';
import type {
  AccordionItemChangeEventDetails,
  AccordionItemProps,
  AccordionItemState,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AccordionItemProps>(), {
  value: undefined,
  disabled: false,
});
const emit = defineEmits<{
  /**
   * The user opens or closes the item. It comes before the `valueChange` of the root.
   * `details.cancel()` keeps the item as it is. An item that another item closes emits nothing.
   */
  openChange: [open: boolean, details: AccordionItemChangeEventDetails];
}>();
defineSlots<{
  default?(scope: { state: AccordionItemState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: AccordionItemState;
  }): unknown;
}>();

const root = injectAccordionRoot();
const attrs = useAttrs();
const generatedValue = useId();
const { element, setElement } = useElement<HTMLElement>();
const itemValue = computed(() => props.value ?? generatedValue);
const state = computed<AccordionItemState>(() => ({
  value: root.value,
  open: root.value.includes(itemValue.value),
  disabled: props.disabled || root.disabled,
}));
const panels = shallowReactive<CollapsiblePanelEntry[]>([]);
const triggers = shallowReactive<AccordionTriggerEntry[]>([]);

provide(accordionItemKey, {
  get state() {
    return state.value;
  },
  get open() {
    return state.value.open;
  },
  get disabled() {
    return state.value.disabled;
  },
  get panelId() {
    return panels[0]?.id;
  },
  get triggerId() {
    return triggers[0]?.id;
  },
  get keepMounted() {
    return root.keepMounted;
  },
  get hiddenUntilFound() {
    return root.hiddenUntilFound;
  },
  request(open, reason, event) {
    const details = createChangeEventDetails(reason, event);
    emit('openChange', open, details);
    if (!details.isCanceled) root.change(itemValue.value, open, details);
  },
  addPanel(panel) {
    panels.push(panel);
    return () => panels.splice(panels.indexOf(panel), 1);
  },
  addTrigger(trigger) {
    triggers.push(trigger);
    return () => triggers.splice(triggers.indexOf(trigger), 1);
  },
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      'data-open': state.value.open ? '' : undefined,
      'data-disabled': state.value.disabled ? '' : undefined,
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
