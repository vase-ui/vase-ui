---
order: 1
description: An unstyled Vue toolbar component that groups a set of buttons and controls.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoToolbarHero from '../demos/toolbar/hero/css-modules/index.vue';
import DemoToolbarHeroTailwind from '../demos/toolbar/hero/tailwind/index.vue';
</script>

# Toolbar

A container that groups a set of buttons and controls.

<DemoFrame>
  <DemoToolbarHero />
  <template #tailwind>
    <DemoToolbarHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/toolbar/hero/css-modules/index.vue

<<< ../demos/toolbar/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/toolbar/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

To make a toolbar accessible and helpful, follow these guidelines:

- **Use inputs sparingly**: In an input, the left and right arrow keys move the text cursor. In a horizontal toolbar, the same keys move the focus between the controls. Put at most one input in a horizontal toolbar, and make it the last item of the toolbar.

## Anatomy

Import the component and assemble its parts:

<<< ./toolbar/Anatomy.vue

## Examples

### Using with other components

Render a part of another component in the `element` slot of a toolbar part, and bind `props` and `elementRef` to it. The element then joins the keyboard navigation of the toolbar and keeps the behavior of the other part.

<<< ./toolbar/MenuInToolbar.vue{8-10}

- **Popups with a trigger**, such as Alert Dialog, Dialog, Drawer, Menu, Popover and Select: render the trigger in the `element` slot of `<Toolbar.Button>`, as the sample does. Set `disabled` on `<Toolbar.Button>`, not on the trigger, so that the button stays in the keyboard navigation of the toolbar.
- **Tooltip**: render `<Toolbar.Button>` in the `element` slot of `<Tooltip.Trigger>`.
- **Toggle**: render a `Toggle` in the `element` slot of `<Toolbar.Button>`, also in a `ToggleGroup`, as the demo at the top of this page does.
- **Number Field**: render `<NumberField.Input>` in the `element` slot of `<Toolbar.Input>`, and keep it inside `<NumberField.Root>` and `<NumberField.Group>` with the increment and decrement buttons. A `Switch`, a `Checkbox` or a `Radio` also goes in that slot. `Toolbar.Input` then renders no `Input`, so give `v-model` to the part in the slot.

See [how props are merged](/handbook/composition#how-props-are-merged) for how the two parts combine.

## API reference

<ApiReference />

### Toolbar.Orientation

The orientation of the toolbar.

<ApiReference name="Toolbar.Orientation" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
