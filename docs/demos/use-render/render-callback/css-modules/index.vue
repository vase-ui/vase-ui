<script setup lang="ts">
import Counter from './Counter.vue';
import styles from './index.module.css';
</script>

<template>
  <Counter>
    <template #element="{ props, elementRef, state }">
      <button v-bind="props" :ref="elementRef">
        Counter: <span :class="styles.count">{{ state.count }}</span>
        <span :class="styles.suffix">{{ state.odd ? '👎' : '👍' }}</span>
      </button>
    </template>
  </Counter>
</template>
