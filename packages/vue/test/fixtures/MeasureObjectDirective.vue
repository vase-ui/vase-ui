<script setup lang="ts">
const vBeforeUpdate = { beforeUpdate() {} };
</script>

<template>
  <div v-before-update="true" data-testid="element">Element</div>
</template>
