---
order: 1
description: An unstyled Vue checkbox component that is easy to customize.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoCheckboxHero from '../demos/checkbox/hero/css-modules/index.vue';
</script>

# Checkbox

An easily stylable checkbox component.

<DemoFrame>
  <DemoCheckboxHero />
</DemoFrame>

::: code-group

<<< ../demos/checkbox/hero/css-modules/index.vue

<<< ../demos/checkbox/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Form controls must have an accessible name**: Give the checkbox a `<label>` element, or put it in a `Field`. See [Labeling a checkbox](#labeling-a-checkbox) and the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./checkbox/Anatomy.vue

`Checkbox.Root` renders its element and a hidden `<input>` after it. The input gives the checkbox the form behavior of a native checkbox. A reset of the form puts an uncontrolled checkbox back to `defaultChecked`. A controlled checkbox does not change. A reset does not change `indeterminate`. In a `Field`, a reset clears the error of the field. The reset starts no validation.

Because of the hidden input, `Checkbox.Root` has more than one root node. A rule of `<style scoped>` does not match its element, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

## Examples

### Labeling a checkbox

A `<label>` around the checkbox is the simplest pattern to label it:

<<< ./checkbox/EnclosingLabel.vue{6,9}

### Rendering as a native button

By default, `Checkbox.Root` renders a `<span>` element, so a `<label>` can hold it. Render the checkbox as a native button when a label beside it names it with `for` and `id`.

<<< ./checkbox/SiblingLabel.vue{8}

To put a native button in a `<label>`, use the `#render` slot. The hidden input then stays outside the label, and the HTML stays valid.

<<< ./checkbox/LabelInRenderSlot.vue{7-12}

## API reference

<ApiReference />
