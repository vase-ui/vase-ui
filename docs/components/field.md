---
order: 1
description: An unstyled Vue field component that provides labeling and validation for form controls.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoFieldHero from '../demos/field/hero/css-modules/index.vue';
</script>

# Field

A component that provides labeling and validation for form controls.

<DemoFrame>
  <DemoFieldHero />
</DemoFrame>

::: code-group

<<< ../demos/field/hero/css-modules/index.vue

<<< ../demos/field/hero/css-modules/index.module.css

:::

## Anatomy

Import the component and assemble its parts:

<<< ./field/Anatomy.vue

In the server HTML, `Field.Control` already has the id of the label in `aria-labelledby` and the ids of the messages in `aria-describedby`. The parts can be in any order. A screen reader can name the control before the page hydrates. `Field.Error` names the control only while it shows.

A native reset of the form puts an uncontrolled `Field.Control` back to its default value. The field then clears its error, and `data-filled` and `data-dirty` follow the new value. The reset starts no validation.

`Field.Root` exposes `validate()`. Call it through a template ref to validate the field.

## API reference

<ApiReference />
