<script setup lang="ts">
import type { PropType } from 'vue';

// A focused input that Vue removes, disables or hides. Each `blur` and `focusout` writes whether
// the input is in the document at the event and one microtask later.
const props = defineProps({
  scene: {
    type: Object as PropType<{ shown: boolean; disabled: boolean; visible: boolean }>,
    required: true,
  },
  kind: {
    type: String as PropType<'v-if' | 'parent' | 'transition' | 'disabled' | 'v-show'>,
    required: true,
  },
  log: { type: Array as PropType<string[]>, required: true },
});

function record(event: FocusEvent) {
  const input = event.target as HTMLInputElement;
  const atEvent = input.isConnected;
  queueMicrotask(() => props.log.push(`${event.type} ${atEvent} ${input.isConnected}`));
}
</script>

<template>
  <div>
    <input
      v-if="kind === 'v-if' && scene.shown"
      aria-label="Text"
      @blur="record"
      @focusout="record"
    />
    <div v-if="kind === 'parent' && scene.shown">
      <input aria-label="Text" @blur="record" @focusout="record" />
    </div>
    <Transition v-if="kind === 'transition'">
      <input v-if="scene.shown" aria-label="Text" @blur="record" @focusout="record" />
    </Transition>
    <input
      v-if="kind === 'disabled'"
      aria-label="Text"
      :disabled="scene.disabled"
      @blur="record"
      @focusout="record"
    />
    <input
      v-if="kind === 'v-show'"
      v-show="scene.visible"
      aria-label="Text"
      @blur="record"
      @focusout="record"
    />
  </div>
</template>
