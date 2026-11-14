<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { CompositeMetadata } from '../../internals/composite/list/useCompositeList';
import type { VaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type {
  Orientation as BaseOrientation,
  VaseUIComponentProps,
  WithVaseUIEvent,
} from '../../internals/types';
import type { TabsTabActivationDirection, TabsTabMetadata, TabsTabValue } from '../tab/TabsTab.vue';

export type TabsRootOrientation = BaseOrientation;

export interface TabsRootState {
  /**
   * The component orientation.
   */
  orientation: TabsRootOrientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTabActivationDirection;
}

export interface TabsRootProps
  extends VaseUIComponentProps<TabsRootState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The value of the currently active `Tab`. Use when the component is controlled.
   * When the value is `null`, no Tab will be active.
   */
  value?: TabsTabValue | undefined;
  /**
   * The default value. Use when the component is not controlled.
   * When the value is `null`, no Tab will be active.
   * @default 0
   */
  defaultValue?: TabsTabValue | undefined;
  /**
   * The component orientation (layout flow direction).
   * @default 'horizontal'
   */
  orientation?: TabsRootOrientation | undefined;
}

export type TabsRootChangeEventReason =
  typeof REASONS.none | typeof REASONS.disabled | typeof REASONS.missing | typeof REASONS.initial;
export type TabsRootChangeEventDetails = VaseUIChangeEventDetails<
  TabsRootChangeEventReason,
  { activationDirection: TabsTabActivationDirection }
>;

type TabMap = ReadonlyMap<Element, CompositeMetadata<TabsTabMetadata>>;

function findTabElement(tabMap: TabMap, value: TabsTabValue): HTMLElement | null {
  for (const [tabElement, tabMetadata] of tabMap) {
    if (value === tabMetadata.value) {
      return tabElement as HTMLElement;
    }
  }

  return null;
}

function computeActivationDirection(
  oldValue: TabsTabValue,
  newValue: TabsTabValue,
  orientation: TabsRootOrientation,
  tabMap: TabMap,
): TabsTabActivationDirection {
  if (oldValue == null || newValue == null) {
    return 'none';
  }

  const [positionProp, backward, forward] =
    orientation === 'horizontal'
      ? (['left', 'left', 'right'] as const)
      : (['top', 'up', 'down'] as const);

  const oldTab = findTabElement(tabMap, oldValue);
  const newTab = findTabElement(tabMap, newValue);

  if (oldTab == null || newTab == null) {
    // A tab that is added and selected in the same update has no element yet. The direction then
    // comes from the values. It works for numbers and strings.
    if (
      oldTab !== newTab &&
      (typeof oldValue === 'number' || typeof oldValue === 'string') &&
      typeof oldValue === typeof newValue
    ) {
      return newValue > oldValue ? forward : backward;
    }
    return 'none';
  }

  const oldPosition = oldTab.getBoundingClientRect()[positionProp];
  const newPosition = newTab.getBoundingClientRect()[positionProp];

  if (newPosition < oldPosition) {
    return backward;
  }
  if (newPosition > oldPosition) {
    return forward;
  }

  return 'none';
}
</script>

<script setup lang="ts">
import { computed, onMounted, provide, shallowReactive, shallowRef, watch } from 'vue';
import { useControlled } from '../../common/useControlled';
import { useCompositeList } from '../../internals/composite/list/useCompositeList';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { TabsRootContext } from './TabsRootContext';
import type { TabsPartRegistration } from './TabsRootContext';
import { tabsStateAttributesMapping } from './stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TabsRootProps>(), {
  as: 'div',
  value: undefined,
  orientation: 'horizontal',
});

const emit = defineEmits<{
  /**
   * Event handler called when new value is being set.
   *
   * The event `reason` is `'none'` for a change by the user, such as a click or a key. It is
   * `'initial'` for the first automatic selection of an uncontrolled root with no `defaultValue`.
   * This includes the case when the implicit value names no tab, or a disabled tab. It is
   * `'disabled'` for the automatic fallback when the selected tab becomes disabled. It is
   * `'missing'` for the automatic fallback when the selected tab is removed, or when an explicit
   * `defaultValue` never names a mounted tab.
   *
   * For an automatic change, the value can be `null` when no enabled tab is available.
   * An automatic change emits `valueChange` and then `update:value`.
   * Automatic changes cannot be canceled: `eventDetails.cancel()` has no effect on `'initial'`,
   * `'disabled'` and `'missing'`.
   */
  valueChange: [value: TabsTabValue, eventDetails: TabsRootChangeEventDetails];
  'update:value': [value: TabsTabValue];
}>();

defineSlots<{
  default(props: { state: TabsRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, TabsRootState>;
}>();

// Only an explicit `defaultValue` is the choice of the consumer. A selection that the consumer did
// not name is an automatic change, and the root emits it. The prop has no default, so that the part
// can tell an absent prop from `defaultValue={0}`.
const hasExplicitDefaultValue = props.defaultValue !== undefined;
const initialDefaultValue = hasExplicitDefaultValue ? props.defaultValue : 0;

const [activeTabValue, setValue] = useControlled<TabsTabValue>({
  controlled: () => props.value,
  default: () => (props.defaultValue === undefined ? 0 : props.defaultValue),
  name: 'Tabs',
  state: 'value',
});

const isControlled = props.value !== undefined;

// An implicit selection is an automatic change too, so the root emits it one time when the tabs
// register. An explicit `defaultValue` is the choice of the consumer.
let shouldNotifyInitialValueChange = !hasExplicitDefaultValue;
// An explicit `defaultValue` can name a disabled tab. The root keeps that selection until the tab
// is enabled. After that, a disabled selection falls back.
let shouldHonorDisabledDefaultValue = hasExplicitDefaultValue;
let didRegisterTabs = false;

const tabMap = shallowRef<TabMap>(new Map());
// A tab and a panel register in `setup`, so that the server HTML of a part that renders later has
// the `id`. A part that renders earlier gets it in the first flush on the client.
const tabs = shallowReactive(new Map<symbol, TabsPartRegistration>());
const panels = shallowReactive(new Map<symbol, TabsPartRegistration>());

function register(
  registry: Map<symbol, TabsPartRegistration>,
  source: symbol,
  registration: TabsPartRegistration | undefined,
) {
  if (registration === undefined) {
    registry.delete(source);
  } else {
    registry.set(source, registration);
  }
}

// The first tab with the value names the panel. The last panel with the value owns the tab.
function findId(
  registry: Map<symbol, TabsPartRegistration>,
  searched: TabsTabValue,
  lastWins: boolean,
) {
  let found: string | undefined;
  for (const registration of registry.values()) {
    if (registration.value() === searched) {
      const id = registration.id();
      if (id !== undefined) {
        found = id;
        if (!lastWins) {
          break;
        }
      }
    }
  }

  return found;
}

const tabActivationDirection = shallowRef<TabsTabActivationDirection>('none');
// The value that the direction is computed against. It stays on the old value while the new tab
// has no element. The direction is then computed again when the tab map changes.
let previousValue = activeTabValue.value;

function updateActivationDirection() {
  if (previousValue === activeTabValue.value) {
    return;
  }

  tabActivationDirection.value = computeActivationDirection(
    previousValue,
    activeTabValue.value,
    props.orientation,
    tabMap.value,
  );

  const isIncomplete =
    previousValue != null &&
    activeTabValue.value != null &&
    findTabElement(tabMap.value, activeTabValue.value) == null;
  if (!isIncomplete) {
    previousValue = activeTabValue.value;
  }
}

// The watcher has the default flush. It runs after Vue writes each new prop of the root, so the
// direction uses the new orientation. It runs before the render, so each tab or panel renders one
// time with the new value and its direction.
watch([activeTabValue, tabMap], updateActivationDirection);

function onValueChange(newValue: TabsTabValue, eventDetails: TabsRootChangeEventDetails) {
  eventDetails.activationDirection = computeActivationDirection(
    activeTabValue.value,
    newValue,
    props.orientation,
    tabMap.value,
  );

  emit('valueChange', newValue, eventDetails);

  if (eventDetails.isCanceled) {
    return;
  }

  emit('update:value', newValue);
  setValue(newValue);
}

function notifyAutomaticValueChange(nextValue: TabsTabValue, reason: TabsRootChangeEventReason) {
  emit(
    'valueChange',
    nextValue,
    createChangeEventDetails(reason, undefined, undefined, {
      activationDirection: 'none' as const,
    }),
  );
  emit('update:value', nextValue);
}

function commitAutomaticValueChange(
  fallbackValue: TabsTabValue,
  reason: TabsRootChangeEventReason,
) {
  // An automatic fallback is not a directional transition. The previous value is set first, so that
  // the watcher of the value computes no direction.
  previousValue = fallbackValue;
  tabActivationDirection.value = 'none';
  // The write comes before the listener, so that a listener that throws cannot stop it.
  setValue(fallbackValue);
  notifyAutomaticValueChange(fallbackValue, reason);
  // The initial notification is done only after the listener returns.
  shouldNotifyInitialValueChange = false;
}

// A controlled root keeps the exact value of the parent, also when that tab is disabled or missing.
function run() {
  if (isControlled) {
    return;
  }

  const map = tabMap.value;

  if (map.size === 0) {
    // In Vue, only `KeepAlive` empties the map while the tab parts exist. A deactivated tab part
    // stays in the registry, so an empty registry is a removal.
    if (didRegisterTabs && activeTabValue.value !== null && tabs.size === 0) {
      commitAutomaticValueChange(null, REASONS.missing);
    }
    return;
  }

  didRegisterTabs = true;

  let selectedTabMetadata: TabsTabMetadata | undefined;
  let firstEnabledTabMetadata: TabsTabMetadata | undefined;
  for (const tabMetadata of map.values()) {
    if (selectedTabMetadata === undefined && tabMetadata.value === activeTabValue.value) {
      selectedTabMetadata = tabMetadata;
    }
    if (firstEnabledTabMetadata === undefined && !tabMetadata.disabled) {
      firstEnabledTabMetadata = tabMetadata;
    }
  }

  const selectionIsDisabled = selectedTabMetadata?.disabled;
  const selectionIsMissing = selectedTabMetadata == null && activeTabValue.value !== null;

  if (!selectionIsDisabled && activeTabValue.value === initialDefaultValue) {
    shouldHonorDisabledDefaultValue = false;
  }

  if (
    shouldHonorDisabledDefaultValue &&
    selectionIsDisabled &&
    activeTabValue.value === initialDefaultValue
  ) {
    return;
  }

  if (selectionIsDisabled || selectionIsMissing) {
    const fallbackValue = firstEnabledTabMetadata?.value ?? null;

    if (activeTabValue.value === fallbackValue) {
      // The value is at the fallback already, so there is nothing to emit.
      shouldNotifyInitialValueChange = false;
      return;
    }

    let fallbackReason: TabsRootChangeEventReason = REASONS.missing;
    if (shouldNotifyInitialValueChange) {
      fallbackReason = REASONS.initial;
    } else if (selectionIsDisabled) {
      fallbackReason = REASONS.disabled;
    }

    commitAutomaticValueChange(fallbackValue, fallbackReason);
    return;
  }

  if (shouldNotifyInitialValueChange && selectedTabMetadata != null) {
    notifyAutomaticValueChange(activeTabValue.value, REASONS.initial);
    shouldNotifyInitialValueChange = false;
  }
}

onMounted(run);
watch([tabMap, activeTabValue], run, { flush: 'post' });

// A server cannot tell which tab the implicit default `0` names, so that value chooses no tab. The
// first enabled tab then takes the tab stop of the server HTML.
const hasChosenTab = computed(
  () => activeTabValue.value != null && (isControlled || hasExplicitDefaultValue),
);

provide(TabsRootContext, {
  value: activeTabValue,
  onValueChange,
  orientation: computed(() => props.orientation),
  getTabElementBySelectedValue: (selectedValue) => findTabElement(tabMap.value, selectedValue),
  getTabIdByPanelValue: (panelValue) => findId(tabs, panelValue, false),
  getTabPanelIdByValue: (tabValue) => findId(panels, tabValue, true),
  registerTab: (source, registration) => register(tabs, source, registration),
  registerPanel: (source, registration) => register(panels, source, registration),
  setTabMap(map) {
    tabMap.value = map;
  },
  tabActivationDirection,
  hasChosenTab,
});

// The panels register their elements in this list, to get their `data-index`.
const panelElements = shallowRef<(HTMLElement | null)[]>([]);
useCompositeList({ elementsRef: panelElements });

const state = computed<TabsRootState>(() => ({
  orientation: props.orientation,
  tabActivationDirection: tabActivationDirection.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: tabsStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
