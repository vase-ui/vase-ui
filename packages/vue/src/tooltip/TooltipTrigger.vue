<script setup lang="ts" generic="Payload = unknown">
import { computed, mergeProps, useAttrs, useId, useSlots, watch } from 'vue';
import { useAsTag, useElement } from '../common/element';
import { givenId } from '../common/id';
import { usePopupHover } from '../popup/hover';
import { isInPopup } from '../popup/layer';
import { useTriggerEntry } from '../popup/trigger';
import { useOpenOnFocus } from './focus';
import { injectGroup, isActive, setTriggerGroup } from './group';
import { innerTriggerEvents, useTriggerRoot, type TooltipHandle } from './root';
import type { TooltipTriggerProps, TooltipTriggerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TooltipTriggerProps<Payload>>(), {
  disabled: false,
  delay: undefined,
  closeDelay: undefined,
  closeOnClick: true,
});
defineSlots<{
  default?(scope: { state: TooltipTriggerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TooltipTriggerState;
  }): unknown;
}>();

// The open delay of Base UI for a trigger with no `delay` and no provider.
const OPEN_DELAY = 600;

const attrs = useAttrs();
const slots = useSlots();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const context = useTriggerRoot(() => props.handle as TooltipHandle | undefined);
const root = () => context.value?.root ?? null;
const group = injectGroup();
const asTag = useAsTag(() => props.as);
const elementId = computed(() => givenId(props.id) ?? generatedId);
const triggerDisabled = computed(() => props.disabled || !!context.value?.disabled);
// A press, a close by Escape or by a press, and a window that gets the focus again: the focus of
// the trigger opens nothing until the focus or the mouse pointer leaves the trigger.
const blocked = { value: false };

watch(element, (trigger) => trigger && setTriggerGroup(trigger, group), { flush: 'sync' });
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
  get disabled() {
    return triggerDisabled.value;
  },
});

const open = computed(() => {
  const current = root();
  return !!current?.open && current.activeTriggerId === elementId.value;
});
watch(
  open,
  (isOpen) => {
    const reason = root()?.reason;
    if (
      !isOpen &&
      (reason === 'escape-key' || reason === 'trigger-press' || reason === 'outside-press')
    ) {
      blocked.value = true;
    }
  },
  { flush: 'sync' },
);

const hover = usePopupHover(root, {
  trigger: element,
  enabled: () => !triggerDisabled.value,
  delay: () =>
    group.provider && isActive(group) ? 0 : (props.delay ?? group.delay() ?? OPEN_DELAY),
  closeDelay: () => props.closeDelay ?? group.closeDelay() ?? 0,
  inside: (target) => {
    const layer = context.value?.layer;
    return !!layer && isInPopup(layer, target);
  },
  hoverablePopup: () => !!context.value?.hoverable,
  openOnDisabled: true,
  inner: (event) => innerTriggerEvents.has(event),
});
const focus = useOpenOnFocus(root, {
  element,
  delay: 0,
  disabled: () => triggerDisabled.value,
  inner: (event) => innerTriggerEvents.has(event),
  blocked,
});

function onPointerenter(event: PointerEvent) {
  hover.listeners.onPointerenter(event);
  context.value?.cursor.onTriggerPointer(event);
}
function onPointermove(event: PointerEvent) {
  hover.listeners.onPointermove(event);
  context.value?.cursor.onTriggerPointer(event);
}
function onPointerleave(event: PointerEvent) {
  hover.listeners.onPointerleave();
  if (event.pointerType === 'mouse') blocked.value = false;
}
function onPointerover(event: PointerEvent) {
  hover.listeners.onPointerover(event);
  if (!triggerDisabled.value) innerTriggerEvents.add(event);
}
function onFocusin(event: FocusEvent) {
  focus.onFocusin(event);
  if (!triggerDisabled.value) innerTriggerEvents.add(event);
}
// A key press on a button gives only `click` (test/measurements/tooltip.test.ts).
function onPress(event: MouseEvent) {
  if (!props.closeOnClick) return;
  blocked.value = true;
  root()?.request(false, 'trigger-press', event, element.value);
}

const state = computed<TooltipTriggerState>(() => ({
  open: open.value,
  disabled: triggerDisabled.value,
}));

function elementProps() {
  // The `element` slot and a component in `as` render an element that gives its own `type`.
  const ownButton = !slots.element && (props.as === undefined || asTag() === 'button');
  return mergeProps(
    {
      id: elementId.value,
      // An attribute that is `undefined` would remove the type of a part in the `element` slot.
      ...(ownButton && { type: 'button' }),
      'data-popup-open': open.value ? '' : undefined,
      'data-trigger-disabled': triggerDisabled.value ? '' : undefined,
      onPointerenter,
      onPointermove,
      onPointerleave,
      onPointerover,
      onPointerdown: onPress,
      onClick: onPress,
      onFocusin,
      onFocusout: focus.onFocusout,
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
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
