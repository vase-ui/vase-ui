<script setup lang="ts">
import { computed, mergeProps, useAttrs, useId, watch, type TransitionProps } from 'vue';
// eslint-disable-next-line no-restricted-imports -- Vue has no other API that tells a client-only mount from a hydration in `setup`: it sets `vnode.el` before `setup` only when it hydrates the component. A Vapor component gets no instance, and it waits for its mount.
import { getCurrentInstance } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { useIsHydrated } from '../common/hydration';
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
  element?(scope: ElementSlotProps<NavigationMenuContentState>): unknown;
}>();

const root = injectNavigationMenuRoot('Content');
const item = injectItem('Content');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const onKeydown = useKeyGroup({ orientation: () => 'both' });
// A portal in the content goes where the portal of the root goes.
providePortalTarget((inherited) => root.portalTarget ?? inherited);

// The server and the hydration render a kept content in its item with no `<Teleport>`: the server
// render of a component with no `ssrRender`, such as one of the package in Nuxt, drops a
// `<Teleport>` with no target, and Vue 3.5.12 cannot hydrate one. The `<Teleport>` comes after the
// mount, disabled while no viewport is there, and the kept content mounts again in it. A
// client-only mount renders the `<Teleport>` at once, so the kept content mounts one time.
const clientOnly =
  // eslint-disable-next-line no-restricted-globals -- `setup` has no element for `ownerDocument`. The typeof check tells a server from a client.
  typeof document !== 'undefined' && getCurrentInstance()?.vnode.el === null;
const hydrated = useIsHydrated();
const teleports = computed(() => clientOnly || hydrated.value);
const contentId = computed(() => givenId(props.id) ?? generatedId);
const shown = computed(
  () => root.shown != null && root.shown === item.value && root.target !== null,
);
const rendered = computed(() => props.keepMounted || shown.value);
const state = computed<NavigationMenuContentState>(() => {
  const open = root.value != null && root.value === item.value;
  return { open, activationDirection: open ? root.direction : null };
});

watch(
  [element, contentId],
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

const transitionProps = computed<TransitionProps>(() => {
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
      id: contentId.value,
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
  <Teleport v-if="teleports" :to="root.target" :disabled="!root.target">
    <Transition v-bind="transitionProps">
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
  <template v-else-if="keepMounted">
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
</template>
