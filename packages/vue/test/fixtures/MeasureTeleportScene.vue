<script setup lang="ts">
import { shallowRef, type PropType } from 'vue';
import MeasureTeleportPart from './MeasureTeleportPart.vue';

// Two parts with a `<Teleport>` root and one target. `around` puts a `<Transition>` of the
// developer around each part. With `popup`, the target is in a popup that leaves in a
// `<Transition>`. `scene.target` names the element of the target: `view`, or `null`.
defineProps({
  scene: {
    type: Object as PropType<{
      shown: string | null;
      target: 'view' | null;
      direction: string;
      popup: boolean;
    }>,
    required: true,
  },
  around: Boolean,
  /** Gets each value of the ref of the target. */
  onRef: { type: Function as PropType<(value: string | null) => void>, default: () => {} },
});
// A root keeps the last target, because the ref of the target gets `null` at the close.
const view = shallowRef<HTMLElement | null>(null);
</script>

<template>
  <div class="item">
    <template v-for="name in ['a', 'b']" :key="name">
      <Transition v-if="around" name="t">
        <MeasureTeleportPart
          :to="scene.target ? view : null"
          :show="scene.shown === name"
          :data-name="name"
          :data-direction="scene.direction"
          class="x"
        >
          <input :aria-label="name" />
        </MeasureTeleportPart>
      </Transition>
      <MeasureTeleportPart
        v-else
        :to="scene.target ? view : null"
        :show="scene.shown === name"
        :data-name="name"
      >
        <input :aria-label="name" />
      </MeasureTeleportPart>
    </template>
  </div>
  <Transition name="p">
    <div v-if="scene.popup" class="popup">
      <div
        :ref="
          (element) => {
            if (element) view = element as HTMLElement;
            onRef(element ? 'view' : null);
          }
        "
        class="view"
      />
    </div>
  </Transition>
</template>

<style>
.t-enter-active,
.t-leave-active,
.p-leave-active {
  transition: opacity 100ms;
}

.t-enter-from,
.t-leave-to,
.p-leave-to {
  opacity: 0;
}
</style>
