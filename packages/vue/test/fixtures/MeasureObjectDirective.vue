<script setup lang="ts">
// An element with a directive object that has `beforeUpdate`, as a virtual DOM template gives it.
const vBeforeUpdate = { beforeUpdate() {} };
</script>

<template>
  <div v-before-update="true" data-testid="element">Element</div>
</template>
