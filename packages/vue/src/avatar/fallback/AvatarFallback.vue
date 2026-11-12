<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { AvatarRootState } from '../root/AvatarRoot.vue';

export interface AvatarFallbackState extends AvatarRootState {}

export interface AvatarFallbackProps
  extends
    VaseUIComponentProps<AvatarFallbackState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * How long to wait before showing the fallback. Specified in milliseconds.
   *
   * @default 0
   */
  delay?: number | undefined;
}
</script>

<script setup lang="ts">
import { onMounted, shallowRef, watch } from 'vue';
import { useTimeout } from '../../common/useTimeout';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useAvatarRootContext } from '../root/AvatarRootContext';
import { avatarStateAttributesMapping } from '../root/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AvatarFallbackProps>(), { as: 'span', delay: 0 });

defineSlots<{
  default(props: { state: AvatarFallbackState }): unknown;
  render: ComponentRenderFn<HTMLProps, AvatarFallbackState>;
}>();

const { state } = useAvatarRootContext();

// A server does not run `onMounted`. With no delay, the fallback is then in the server HTML.
const delayPassed = shallowRef(props.delay === 0);
const timeout = useTimeout();

// `delayPassed` never goes back to `false`. A fallback that shows with no delay stays visible
// when `delay` changes to a number later.
function updateDelayPassed() {
  if (props.delay > 0) {
    timeout.start(props.delay, () => {
      delayPassed.value = true;
    });
  } else {
    timeout.clear();
    delayPassed.value = true;
  }
}

onMounted(updateDelayPassed);
watch(() => props.delay, updateDelayPassed);

const { element, elementProps } = useRenderElement('span', props, {
  state,
  stateAttributesMapping: avatarStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <template v-if="state.imageLoadingStatus !== 'loaded' && (delay === 0 || delayPassed)">
    <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
    <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
  </template>
</template>
