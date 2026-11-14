<template>
  <div class="demo-frame vp-raw"><slot /></div>
</template>

<style scoped>
/* The copied style sheets of Base UI follow the color scheme of the system and cannot change.
   The frame follows it too, so the demo has the page colors that the style sheets assume.
   The look is the demo playground of the Base UI docs: docs/src/components/Demo/Demo.css.
   The playground of Base UI is 8rem high inside the border of its card, so the height here
   includes the two borders of the frame. */
.demo-frame {
  display: flex;
  align-items: center;
  justify-content: safe center;
  overflow-x: auto;
  box-sizing: border-box;
  min-height: calc(8rem + 2px);
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
