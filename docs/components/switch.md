---
order: 1
description: An unstyled Vue switch component that indicates whether a setting is on or off.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSwitchHero from '../demos/switch/hero/css-modules/index.vue';
</script>

# Switch

A control that indicates whether a setting is on or off.

<DemoFrame>
  <DemoSwitchHero />
</DemoFrame>

::: code-group

<<< ../demos/switch/hero/css-modules/index.vue

<<< ../demos/switch/hero/css-modules/index.module.css

:::

## Usage guidelines

- **Form controls must have an accessible name**: Give the switch a `<label>` element, or put it in a `Field`. See [Labeling a switch](#labeling-a-switch) and the [forms guide](/handbook/forms).

## Anatomy

Import the component and assemble its parts:

<<< ./switch/Anatomy.vue

`Switch.Root` renders its element and a hidden `<input>` after it. The input gives the switch the form behavior of a native checkbox. A reset of the form puts an uncontrolled switch back to `defaultChecked`. A controlled switch does not change.

Because of the hidden input, `Switch.Root` has more than one root node. A rule of `<style scoped>` does not match its element, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.

## Examples

### Labeling a switch

A `<label>` around the switch is the simplest pattern to label it:

<<< ./switch/EnclosingLabel.vue{6,9}

### Rendering as a native button

By default, `Switch.Root` renders a `<span>` element, so a `<label>` can hold it. Render the switch as a native button when a label beside it names it with `for` and `id`.

<<< ./switch/SiblingLabel.vue{8}

To put a native button in a `<label>`, use the `#render` slot. The hidden input then stays outside the label, and the HTML stays valid.

<<< ./switch/LabelInRenderSlot.vue{7-12}

## API reference

<ApiReference />
