<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureShowContent from './MeasureShowContent.vue';
import MeasureShowContentChild from './MeasureShowContentChild.vue';

// A `<Transition>` that mounts with its part, as a portal mounts them.
defineProps({
  later: Boolean,
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
</script>

<template>
  <Transition
    @before-enter="log.add('before-enter')"
    @enter="
      (element: Element) =>
        log.add(
          `enter, content ${element.scrollHeight > 0 ? 'in the element' : 'not in the element'}`,
        )
    "
    @after-enter="log.add('after-enter')"
  >
    <MeasureShowContent :later>
      <MeasureShowContentChild :log />
    </MeasureShowContent>
  </Transition>
</template>
