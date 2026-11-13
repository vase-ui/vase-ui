<script setup lang="ts">
import Counter from './Counter.vue';
import styles from './index.module.css';
</script>

<template>
  <Counter>
    <template #render="{ props, state }">
      <button v-bind="props">
        Counter: <span :class="styles.count">{{ state.count }}</span>
        <span :class="styles.suffix">{{ state.odd ? '👎' : '👍' }}</span>
      </button>
    </template>
  </Counter>
</template>
