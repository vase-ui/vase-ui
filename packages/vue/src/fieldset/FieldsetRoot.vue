<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  onMounted,
  provide,
  shallowReactive,
  shallowRef,
  useAttrs,
  useId,
} from 'vue';
import { useElement } from '../common/element';
import { fieldsetKey, useInDisabledFieldset } from './part';
import { legendKey } from './root';
import type { FieldsetRootProps, FieldsetRootState } from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<FieldsetRootProps>();
defineSlots<{
  default?(scope: { state: FieldsetRootState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: FieldsetRootState;
  }): unknown;
}>();

const attrs = useAttrs();
const around = inject(fieldsetKey, null);
const legendId = useId();
const { element, setElement } = useElement<HTMLElement>();
const inDisabledFieldset = useInDisabledFieldset(element);
// The element of the `element` slot is known after the mount. Until then, the parts take the
// answer of the root.
const isFieldset = computed(() => !element.value || element.value.localName === 'fieldset');
const legends = shallowReactive<{ readonly id: string }[]>([]);
const mounted = shallowRef(false);
onMounted(() => (mounted.value = true));
const state = computed<FieldsetRootState>(() => ({
  disabled: props.disabled || inDisabledFieldset.value,
}));

provide(fieldsetKey, {
  get disabled() {
    return state.value.disabled;
  },
  get disabledOutsideBrowser() {
    return (!isFieldset.value && props.disabled) || !!around?.disabledOutsideBrowser;
  },
  get legendId() {
    return legends[0]?.id;
  },
});
provide(legendKey, {
  get firstLegendId() {
    return legends.length === 0 ? legendId : undefined;
  },
  addLegend(legend) {
    legends.push(legend);
    return () => legends.splice(legends.indexOf(legend), 1);
  },
});

defineExpose({ element });

// A server writes the attributes of the root before the `setup` of a legend in it, so the root
// assumes a legend until the mount.
function labelledBy() {
  // An `aria-labelledby` of the developer wins in the merge.
  if (attrs['aria-label'] != null) return undefined;
  return legends[0]?.id ?? (mounted.value ? undefined : legendId);
}

function elementProps() {
  // CSS `:disabled` matches a `<fieldset>`. Another element that the developer renders shows the
  // state as an attribute.
  return mergeProps(
    {
      disabled: props.disabled,
      'data-disabled': !isFieldset.value && state.value.disabled ? '' : undefined,
      'aria-labelledby': labelledBy(),
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
  <fieldset v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </fieldset>
</template>
