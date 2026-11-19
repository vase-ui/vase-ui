<script setup lang="ts">
import { computed, mergeProps, onMounted, shallowRef, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { useIsHydrating } from '../common/hydration';
import PrehydrationScript from '../internals/PrehydrationScript.vue';
import { injectTabsList } from './list';
import { measureActiveTab, type ActiveTabMeasure } from './measure';
import { script } from './prehydrationScript.min';
import { injectTabsRoot, rootStateAttributes } from './root';
import type { TabsIndicatorProps, TabsIndicatorState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabsIndicatorProps>(), { renderBeforeHydration: false });
const slots = defineSlots<{
  default?(scope: { state: TabsIndicatorState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TabsIndicatorState;
  }): unknown;
}>();

const root = injectTabsRoot();
const list = injectTabsList();
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const isHydrating = useIsHydrating();

// The server HTML and the first client render have no measure.
const measure = shallowRef<ActiveTabMeasure | null>(null);
const shownMeasure = computed(() => {
  const size = measure.value?.size;
  return size && size.width > 0 && size.height > 0 ? measure.value : null;
});
const state = computed<TabsIndicatorState>(() => ({
  ...root.state,
  activeTabPosition: shownMeasure.value?.position ?? null,
  activeTabSize: shownMeasure.value?.size ?? null,
}));
// The script of the server HTML is a function of the indicator. With the `element` slot, the
// script follows the element of the developer.
const prehydrationScript = computed(
  () =>
    `${script}(document.currentScript.${slots.element ? 'previousElementSibling' : 'parentElement'})`,
);

function update() {
  const tab = root.activeTab?.element;
  measure.value = tab && list.element ? measureActiveTab(tab, list.element) : null;
}

onMounted(() => {
  const elements = () => [list.element, ...root.tabs.map((tab) => tab.element)];
  watch([() => root.activeTab?.element, elements, () => root.state.orientation], update, {
    immediate: true,
    flush: 'post',
  });
  watch(
    elements,
    (observed, _, onCleanup) => {
      const observer = new ResizeObserver(update);
      for (const target of observed) if (target) observer.observe(target);
      onCleanup(() => observer.disconnect());
    },
    { immediate: true, flush: 'post' },
  );
  // A tab that moves with no change of size, such as a tab that a keyed `v-for` moves, gets no
  // callback of the `ResizeObserver`.
  watch(
    () => list.element,
    (listElement, _, onCleanup) => {
      if (!listElement) return;
      const observer = new MutationObserver(update);
      observer.observe(listElement, { childList: true, subtree: true });
      onCleanup(() => observer.disconnect());
    },
    { immediate: true, flush: 'post' },
  );
});

defineExpose({ element });

function elementProps() {
  const shown = shownMeasure.value;
  return mergeProps(
    {
      role: 'presentation',
      // A `style` key with no value gives `style=""` in the server HTML.
      ...(shown && {
        style: {
          '--active-tab-left': `${shown.position.left}px`,
          '--active-tab-right': `${shown.position.right}px`,
          '--active-tab-top': `${shown.position.top}px`,
          '--active-tab-bottom': `${shown.position.bottom}px`,
          '--active-tab-width': `${shown.size.width}px`,
          '--active-tab-height': `${shown.size.height}px`,
        },
      }),
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: shown ? undefined : true,
      // The script of the server HTML removes `hidden` and writes the style.
      'data-allow-mismatch':
        props.renderBeforeHydration && isHydrating.value ? 'style,attribute' : undefined,
      ...rootStateAttributes(root.state),
    },
    attrs,
  );
}
</script>

<template>
  <slot
    v-if="root.value !== null && $slots.element && !renderBeforeHydration"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <template v-else-if="root.value !== null && $slots.element">
    <slot name="element" :props="elementProps()" :elementRef="setElement" :state="state" />
    <PrehydrationScript :script="prehydrationScript" />
  </template>
  <span v-else-if="root.value !== null" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <PrehydrationScript v-if="renderBeforeHydration" :script="prehydrationScript" />
  </span>
</template>
