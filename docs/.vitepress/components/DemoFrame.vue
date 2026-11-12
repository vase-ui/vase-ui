<template>
  <div class="demo-frame vp-raw"><slot /></div>
</template>

<style scoped>
/* The copied style sheets of Base UI follow the color scheme of the system and cannot change.
   The frame follows it too, so the demo has the page colors that the style sheets assume. */
.demo-frame {
  display: flex;
  align-items: center;
  justify-content: safe center;
  overflow-x: auto;
  margin: 16px 0;
  padding: 48px 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background-color: white;
  color: oklch(14.5% 0 0deg);
}

@media (prefers-color-scheme: dark) {
  .demo-frame {
    background-color: oklch(14.5% 0 0deg);
    color: white;
  }
}
</style>
