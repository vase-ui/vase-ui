<script setup lang="ts" generic="Value = any">
import { computed, mergeProps, onUnmounted, useAttrs, useId } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { injectTabsList } from './list';
import { injectTabsRoot, rootStateAttributes, type RootTab } from './root';
import type { TabsTabProps, TabsTabState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<TabsTabProps<Value>>();
defineSlots<{
  default?(scope: { state: TabsTabState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TabsTabState;
  }): unknown;
}>();

const root = injectTabsRoot();
const list = injectTabsList();
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

const elementId = computed(() => givenId(props.id) ?? generatedId);
const active = computed(() => root.value === props.value);
const state = computed<TabsTabState>(() => ({
  ...root.state,
  active: active.value,
  disabled: props.disabled,
}));

const tab: RootTab = {
  get value() {
    return props.value;
  },
  get id() {
    return elementId.value;
  },
  get disabled() {
    return props.disabled;
  },
  get element() {
    return element.value;
  },
};
// Nuxt removes the call of `onUnmounted` from its server build, with its arguments, so the part
// registers before the call.
const unregister = root.addTab(tab);
onUnmounted(unregister);

defineExpose({ element });

function elementProps() {
  // The element of the `element` slot is known after the mount.
  const button = !element.value || element.value.localName === 'button';
  return mergeProps(
    {
      role: 'tab',
      type: button ? 'button' : undefined,
      id: elementId.value,
      'aria-selected': active.value ? 'true' : 'false',
      'aria-controls': root.panelId(props.value),
      // A disabled tab keeps the focus, so it has no `disabled` attribute.
      'aria-disabled': props.disabled ? 'true' : undefined,
      tabindex: list.tabStop === tab ? 0 : -1,
      ...rootStateAttributes(root.state),
      onClick,
      onKeydown,
      onFocus: () => list.onFocus(tab),
      onBlur: () => list.onBlur(),
    },
    attrs,
  );
}

// The listener runs before the listeners of the developer. HTML gives a disabled control no click.
// So no listener of the developer on the tab runs, and the click does not bubble to an ancestor.
function onClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  // A click from a script or from an assistive technology moves no focus. The tabs example of the
  // Authoring Practices gives the tab the focus, so the arrow keys continue from it.
  element.value?.focus();
  root.select(props.value, event);
}

function onKeydown(event: KeyboardEvent) {
  list.onKeydown(event, tab);
  const target = element.value;
  if (!target || target.localName === 'button') return;
  // The browser activates a `<button>` with Enter and Space, and a link with Enter. The click of a
  // link then has the modifier keys of the key, so a modifier opens the link in a new tab or window.
  // The click listener stops the click of a disabled tab.
  if (event.key === ' ' || (event.key === 'Enter' && !target.matches('a[href]'))) {
    event.preventDefault();
    target.click();
  }
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
  <button v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </button>
</template>
