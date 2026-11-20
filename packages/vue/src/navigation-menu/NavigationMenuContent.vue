<script setup lang="ts">
import { computed, mergeProps, useAttrs, useId, watch, type TransitionProps } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { ownerDocument } from '../common/owner';
import { activeElement, contains } from '../common/shadowDom';
import { providePortalTarget } from '../popup/portal';
import { useKeyGroup } from './keys';
import { injectItem, injectNavigationMenuRoot } from './root';
import type { NavigationMenuContentProps, NavigationMenuContentState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuContentProps>(), {
  keepMounted: false,
  transition: undefined,
});
defineSlots<{
  default?(scope: { state: NavigationMenuContentState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: NavigationMenuContentState;
  }): unknown;
}>();

const root = injectNavigationMenuRoot('Content');
const item = injectItem('Content');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const onKeydown = useKeyGroup({ orientation: () => 'both' });
// A portal in the content goes where the portal of the root goes.
providePortalTarget((inherited) => root.portalTarget ?? inherited);

const id = computed(() => givenId(props.id) ?? generatedId);
const shown = computed(
  () => root.shown != null && root.shown === item.value && root.target !== null,
);
const rendered = computed(() => props.keepMounted || shown.value);
const state = computed<NavigationMenuContentState>(() => {
  const open = root.value != null && root.value === item.value;
  return { open, activationDirection: open ? root.direction : null };
});

watch(
  [element, id],
  ([current, value]) => {
    item.contentId = current ? value : null;
  },
  { immediate: true },
);
watch(
  () => (shown.value ? element.value : null),
  (current, _, onCleanup) => {
    if (current) onCleanup(root.setShownContent(current));
  },
  { immediate: true },
);

// The old content leaves out of the flow, so the popup takes the size of the new content. Vue writes
// no attribute on an element that leaves, so the part writes its new direction.
function onBeforeLeave(leaving: Element) {
  const target = leaving as HTMLElement;
  if (root.direction) target.setAttribute('data-activation-direction', root.direction);
  Object.assign(target.style, { position: 'absolute', top: '0', left: '0' });
  if (!contains(target, activeElement(ownerDocument(target)))) target.setAttribute('inert', '');
}

const transition = computed<TransitionProps>(() => {
  const given = props.transition;
  // At a close the content does not leave: it stays in the popup, and goes with it.
  if (!given || !root.target || !root.popup.open) return { css: false, onBeforeLeave };
  const hooks = given.onBeforeLeave;
  return {
    ...given,
    onBeforeLeave: [onBeforeLeave, ...(Array.isArray(hooks) ? hooks : hooks ? [hooks] : [])],
  };
});

function elementProps() {
  return mergeProps(
    {
      id: id.value,
      hidden: shown.value ? undefined : true,
      'data-activation-direction': state.value.activationDirection ?? undefined,
      onKeydown,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <Teleport :to="root.target" :disabled="!root.target">
    <Transition v-bind="transition">
      <slot
        v-if="rendered && $slots.element"
        name="element"
        :props="elementProps()"
        :elementRef="setElement"
        :state="state"
      />
      <component :is="as" v-else-if="rendered && as" v-bind="elementProps()" :ref="setElement">
        <slot :state="state" />
      </component>
      <div v-else-if="rendered" v-bind="elementProps()" :ref="setElement">
        <slot :state="state" />
      </div>
    </Transition>
  </Teleport>
</template>
