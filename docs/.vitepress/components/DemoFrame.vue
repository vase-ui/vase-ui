<template>
  <div class="demo-frame vp-raw"><slot /></div>
</template>

<style scoped>
/* The copied style sheets of Base UI follow the color scheme of the system and cannot change.
   The frame follows it too, so the demo has the page colors that the style sheets assume.
   The look is the demo playground of the Base UI docs: docs/src/components/Demo/Demo.css. */
.demo-frame {
  display: flex;
  align-items: center;
  justify-content: safe center;
  overflow-x: auto;
  min-height: 8rem;
  margin: 1.25rem 0 1.5rem;
  padding: 2rem 1.5rem;
  border: 1px solid var(--vase-color-border);
  border-radius: var(--vase-radius-12);
  background-color: white;
  color: oklch(14.5% 0 0deg);
}

.demo-frame:has(+ .vp-code-group) {
  margin-bottom: 0;
  border-end-start-radius: 0;
  border-end-end-radius: 0;
}

@media (prefers-color-scheme: dark) {
  .demo-frame {
    background-color: black;
    color: white;
  }
}
</style>
