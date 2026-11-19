<script setup lang="ts" generic="Value = any">
import {
  computed,
  mergeProps,
  onMounted,
  provide,
  shallowReactive,
  shallowRef,
  useAttrs,
  watch,
} from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { byDocumentOrder, useElement } from '../common/element';
import { useIsHydrated } from '../common/hydration';
import { useModel } from '../common/model';
import { rootStateAttributes, tabsRootKey, type RootPanel, type RootTab } from './root';
import type {
  TabsRootChangeEventDetails,
  TabsRootChangeEventReason,
  TabsRootProps,
  TabsRootState,
  TabsTabActivationDirection,
} from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabsRootProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  orientation: 'horizontal',
});
const emit = defineEmits<{
  /**
   * The value changes. `details.reason` is `none` for a change by the user, and
   * `details.cancel()` then keeps the value as it was. An uncontrolled root also changes its value
   * itself: the first tab that is not disabled at the mount (`initial`), and the first tab that is
   * not disabled, or `null`, when the active tab is disabled (`disabled`) or no tab has the value
   * (`missing`). Such a change cannot be cancelled.
   */
  valueChange: [value: Value | null, details: TabsRootChangeEventDetails];
  /** Comes after the change event with the new value, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: Value | null];
}>();
defineSlots<{
  default?(scope: { state: TabsRootState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: TabsRootState;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLDivElement>();
const mounted = useIsHydrated();

const given = props.modelValue === undefined ? props.defaultValue : props.modelValue;
// `undefined` until an uncontrolled root with no `defaultValue` takes its first tab.
const { value: chosen, setOwn } = useModel<Value | null | undefined>(() => props.modelValue, given);
const tabs = shallowReactive<RootTab[]>([]);
const panels = shallowReactive<RootPanel[]>([]);

const orderedTabs = computed(() =>
  mounted.value
    ? tabs
        .filter((tab): tab is RootTab & { element: HTMLElement } => !!tab.element)
        .sort((a, b) => byDocumentOrder(a.element, b.element))
    : [...tabs],
);
// Before the mount, the server HTML and the first client render show this value.
const firstEnabledValue = computed(
  () => (orderedTabs.value.find((tab) => !tab.disabled)?.value ?? null) as Value | null,
);
const value = computed(() => (chosen.value === undefined ? firstEnabledValue.value : chosen.value));
const activeTab = computed(() => tabOf(value.value));

const direction = shallowRef<TabsTabActivationDirection>('none');
// The value that the direction starts from.
let directionFrom: unknown = value.value;
const state = computed<TabsRootState>(() => ({
  orientation: props.orientation,
  tabActivationDirection: direction.value,
}));

// The default flush runs after Vue writes the new props, so the direction has the new
// orientation, and before the render, so each part renders the new value with its direction.
watch([value, () => tabOf(value.value)?.element], () => {
  const next = value.value;
  if (next === directionFrom) return;
  direction.value = directionBetween(directionFrom, next);
  // A new tab that mounts in the same update has no element yet. The direction comes again when it
  // has one.
  if (next == null || directionFrom == null || tabOf(next)?.element) directionFrom = next;
});

// A `defaultValue` that names a disabled tab stays until that tab is enabled one time.
let keepDisabledDefault = props.defaultValue !== undefined;
let hadTabs = false;

onMounted(() => {
  watch(
    [
      () => props.modelValue,
      value,
      () => orderedTabs.value.map((tab) => [tab.value, tab.disabled]),
    ],
    changeIfNeeded,
    { flush: 'post', immediate: true },
  );
});

// A controlled root shows only the value of its parent.
function changeIfNeeded() {
  if (props.modelValue !== undefined) return;
  // A root keeps its value while it waits for its first tabs.
  if (!hadTabs && orderedTabs.value.length === 0) return;
  hadTabs = true;
  if (chosen.value === undefined) {
    changeItself(firstEnabledValue.value, 'initial');
    return;
  }
  const current = chosen.value;
  if (current === null) return;
  const active = tabOf(current);
  if (active && !active.disabled) {
    keepDisabledDefault = false;
    return;
  }
  if (active && keepDisabledDefault && current === given) return;
  const next = firstEnabledValue.value;
  if (next !== current) changeItself(next, active ? 'disabled' : 'missing');
}

function changeItself(next: Value | null, reason: Exclude<TabsRootChangeEventReason, 'none'>) {
  directionFrom = next;
  direction.value = 'none';
  setOwn(next);
  const details = Object.assign(createChangeEventDetails(reason, new Event('vase-ui')), {
    activationDirection: 'none' as const,
  });
  emit('valueChange', next, details);
  emit('update:modelValue', next);
}

function select(next: Value, event: Event) {
  if (next === value.value) return;
  const details = Object.assign(
    createChangeEventDetails<TabsRootChangeEventReason>('none', event),
    {
      activationDirection: directionBetween(value.value, next),
    },
  );
  emit('valueChange', next, details);
  if (details.isCanceled) return;
  setOwn(next);
  emit('update:modelValue', next);
}

function tabOf(searched: unknown) {
  return orderedTabs.value.find((tab) => tab.value === searched);
}

function directionBetween(from: unknown, to: unknown): TabsTabActivationDirection {
  if (from == null || to == null) return 'none';
  const [side, back, forward] =
    props.orientation === 'horizontal'
      ? (['left', 'left', 'right'] as const)
      : (['top', 'up', 'down'] as const);
  const fromElement = tabOf(from)?.element;
  const toElement = tabOf(to)?.element;
  if (!fromElement || !toElement) {
    if (fromElement === toElement) return 'none';
    if (typeof from === 'number' && typeof to === 'number') return to > from ? forward : back;
    if (typeof from === 'string' && typeof to === 'string') return to > from ? forward : back;
    return 'none';
  }
  const fromPlace = fromElement.getBoundingClientRect()[side];
  const toPlace = toElement.getBoundingClientRect()[side];
  if (toPlace === fromPlace) return 'none';
  return toPlace > fromPlace ? forward : back;
}

provide(tabsRootKey, {
  get value() {
    return value.value;
  },
  get state() {
    return state.value;
  },
  get tabs() {
    return orderedTabs.value;
  },
  get activeTab() {
    return activeTab.value;
  },
  get tabStop() {
    return (
      activeTab.value ?? (mounted.value || chosen.value === null ? orderedTabs.value[0] : undefined)
    );
  },
  tabId: (searched) => tabOf(searched)?.id,
  panelId: (searched) => panels.findLast((panel) => panel.value === searched && panel.shown)?.id,
  select: (next, event) => select(next as Value, event),
  addTab(tab) {
    tabs.push(tab);
    return () => tabs.splice(tabs.indexOf(tab), 1);
  },
  addPanel(panel) {
    panels.push(panel);
    return () => panels.splice(panels.indexOf(panel), 1);
  },
});

defineExpose({ element });

function elementProps() {
  return mergeProps(rootStateAttributes(state.value), attrs);
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
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
