<script setup lang="ts" generic="Payload = unknown">
import { computed, mergeProps, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { usePopupHover } from '../popup/hover';
import { onKeydown as onLayerKeydown } from '../popup/layer';
import { useTriggerEntry } from '../popup/trigger';
import { useOpenOnFocus } from './focus';
import { recordHoveredLine } from './line';
import { useTriggerRoot, type PreviewCardHandle } from './root';
import type { PreviewCardTriggerProps, PreviewCardTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PreviewCardTriggerProps<Payload>>(), {
  delay: 600,
  closeDelay: 300,
});
defineSlots<{
  default?(scope: { state: PreviewCardTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: PreviewCardTriggerState;
  }): unknown;
}>();

const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const context = useTriggerRoot(() => props.handle as PreviewCardHandle | undefined);
const root = () => context.value?.root ?? null;
const elementId = computed(() => givenId(props.id) ?? generatedId);

useTriggerEntry(root, {
  get id() {
    return elementId.value;
  },
  get element() {
    return element.value;
  },
  get payload() {
    return props.payload;
  },
  disabled: false,
});
const open = computed(() => {
  const current = root();
  return !!current?.open && current.activeTriggerId === elementId.value;
});

const hover = usePopupHover(root, {
  trigger: element,
  enabled: () => true,
  delay: () => props.delay,
  closeDelay: () => props.closeDelay,
  inside: (target) => !!context.value?.inside(target),
});
const focus = useOpenOnFocus(root, { element, delay: () => props.delay });

const state = computed<PreviewCardTriggerState>(() => ({ open: open.value }));

function elementProps() {
  return mergeProps(
    // An open by hover in the same event reads the line, so this listener comes first.
    { onPointerenter: recordHoveredLine, onPointermove: recordHoveredLine },
    hover.listeners,
    focus.listeners,
    {
      id: elementId.value,
      'data-popup-open': open.value ? '' : undefined,
      // The link has the focus, so its ancestors get no Escape that closes the card.
      onKeydown: onLayerKeydown,
    },
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
  <a v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </a>
</template>
