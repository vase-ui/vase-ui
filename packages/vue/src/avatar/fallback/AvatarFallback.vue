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
import { computed, onMounted, shallowRef, watchEffect } from 'vue';
import { useTimeout } from '../../common/useTimeout';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { avatarStateAttributesMapping, useAvatarRootContext } from '../root/AvatarRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<AvatarFallbackProps>(), { as: 'span', delay: 0 });

defineSlots<{
  default(props: { state: AvatarFallbackState }): unknown;
  render: ComponentRenderFn<HTMLProps, AvatarFallbackState>;
}>();

const { state } = useAvatarRootContext();

const timeout = useTimeout();
const delayPassed = shallowRef(props.delay === 0);
const visible = computed(
  () => state.value.imageLoadingStatus !== 'loaded' && (props.delay === 0 || delayPassed.value),
);

onMounted(() => {
  watchEffect(() => {
    if (delayPassed.value) {
      return;
    }
    if (props.delay > 0) {
      timeout.start(props.delay, () => {
        delayPassed.value = true;
      });
    } else {
      timeout.clear();
      delayPassed.value = true;
    }
  });
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  state,
  stateAttributesMapping: avatarStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="visible && usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else-if="visible" v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
