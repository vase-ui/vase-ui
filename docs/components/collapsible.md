---
order: 1
description: An unstyled Vue collapsible component that displays a panel controlled by a button.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoCollapsibleHero from '../demos/collapsible/hero/css-modules/index.vue';
</script>

# Collapsible

A collapsible panel controlled by a button.

<DemoFrame>
  <DemoCollapsibleHero />
</DemoFrame>

::: code-group

<<< ../demos/collapsible/hero/css-modules/index.vue

<<< ../demos/collapsible/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./collapsible/Anatomy.vue

## Examples

### Hidden until found

The `hiddenUntilFound` prop hides the closed panel with [`hidden="until-found"`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden). The find-in-page search of the browser (<kbd>Ctrl</kbd>+<kbd>F</kbd>, or <kbd>Cmd</kbd>+<kbd>F</kbd> on macOS) can then search its contents and reveal the panel when it finds a match. The closed panel always stays mounted in the DOM, so search engines can also index its contents.

A browser that does not support `hidden="until-found"` keeps the panel hidden until its trigger opens it, and find-in-page skips the contents.

<<< ./collapsible/HiddenUntilFound.vue{8}

## API reference

<ApiReference />
