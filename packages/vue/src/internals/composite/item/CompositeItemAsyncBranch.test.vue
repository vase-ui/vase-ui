<script lang="ts">
let release: (() => void) | undefined;

// The `setup` of the branch waits until a test calls this function.
export function releaseAsyncBranch() {
  release?.();
}
</script>

<script setup lang="ts">
// A server render has no test that can release the branch.
if (typeof document === 'undefined') {
  await Promise.resolve();
} else {
  await new Promise<void>((resolve) => {
    release = resolve;
  });
}
</script>

<template>
  <slot />
</template>
