<script setup lang="ts" generic="Payload = unknown">
import { computed, mergeProps, useAttrs, useId } from 'vue';
import { useAsTag, useElement, type ElementSlotProps } from '../common/element';
import { givenId } from '../common/id';
import { usePopupHover } from '../popup/hover';
import { usePopupTrigger } from '../popup/trigger';
import { useTriggerRoot, type PopoverHandle } from './root';
import type { PopoverTriggerProps, PopoverTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverTriggerProps<Payload>>(), {
  disabled: false,
  openOnHover: false,
  delay: 300,
  closeDelay: 0,
});
defineSlots<{
  default?(scope: { state: PopoverTriggerState }): unknown;
  element?(scope: ElementSlotProps<PopoverTriggerState>): unknown;
}>();

const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const context = useTriggerRoot(() => props.handle as PopoverHandle | undefined);
const root = () => context.value?.root ?? null;
const elementId = computed(() => givenId(props.id) ?? generatedId);

const hover = usePopupHover(root, {
  trigger: element,
  enabled: () => props.openOnHover,
  delay: () => props.delay,
  closeDelay: () => props.closeDelay,
  inside: (target) => !!context.value?.inside(target),
});
const trigger = usePopupTrigger(root, {
  element,
  id: () => elementId.value,
  payload: () => props.payload,
  disabled: () => props.disabled,
  tag: useAsTag(() => props.as),
  closesAtPress: (event) => !props.openOnHover || hover.closesAtPress(event),
});

const state = computed<PopoverTriggerState>(() => ({
  open: trigger.open.value,
  disabled: trigger.button.disabled.value,
}));

function elementProps() {
  const current = root();
  const popup = current?.popup;
  return trigger.button.mergeAttributes(
    mergeProps(props.openOnHover ? hover.listeners : {}, {
      id: elementId.value,
      'aria-haspopup': 'dialog',
      'aria-expanded': trigger.open.value ? 'true' : 'false',
      'aria-controls': trigger.open.value && popup ? popup.id : undefined,
      'data-pressed': trigger.open.value && current?.reason === 'trigger-press' ? '' : undefined,
      onClick: trigger.onClick,
      onKeydown: (event: KeyboardEvent) => {
        if (trigger.open.value) context.value?.focus.onTriggerKeydown(event);
      },
    }),
    attrs,
  );
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
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
