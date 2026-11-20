<script setup lang="ts">
import { onUnmounted, shallowRef } from 'vue';

// Two buttons A and B in a box. A takes the capture of the pointer at `pointerdown`. `removeA()`
// removes A with Vue. `log` gets the type, the target and the `detail` of each pointer event and
// click that reaches the document.
const props = defineProps<{ log: { add(entry: string): void } }>();
const shownA = shallowRef(true);
defineExpose({ removeA: () => (shownA.value = false) });

function capture(event: PointerEvent) {
  (event.currentTarget as Element).setPointerCapture(event.pointerId);
}

function record(event: Event) {
  const target = event.target as Element | Document;
  const name = target instanceof Element ? target.id || target.localName : 'document';
  props.log.add(
    `${event.type} ${name}${event.type === 'click' ? ` ${(event as MouseEvent).detail}` : ''}`,
  );
}

const types = ['pointerup', 'lostpointercapture', 'click'];
for (const type of types) document.addEventListener(type, record, true);
onUnmounted(() => {
  for (const type of types) document.removeEventListener(type, record, true);
});
</script>

<template>
  <div id="box" style="display: flex; gap: 40px; padding: 20px">
    <button v-if="shownA" id="A" style="width: 60px; height: 40px" @pointerdown="capture">A</button>
    <button id="B" style="width: 60px; height: 40px">B</button>
  </div>
</template>
