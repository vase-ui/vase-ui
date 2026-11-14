---
order: 1
description: An unstyled Vue toolbar component that groups a set of buttons and controls.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
</script>

# Toolbar

A container that groups a set of buttons and controls.

## Usage guidelines

To make a toolbar accessible and helpful, follow these guidelines:

- **Use inputs sparingly**: In an input, the left and right arrow keys move the text cursor. In a horizontal toolbar, the same keys move the focus between the controls. Put at most one input in a horizontal toolbar. Make it the last element of the toolbar.

## Anatomy

Import the component and assemble its parts:

<<< ./toolbar/Anatomy.vue

## Examples

### Using with other components

Give a part of another component to the `as` prop of a toolbar part. The two parts then share one element. The element joins the keyboard navigation of the toolbar and keeps the behavior of the other part.

<<< ./toolbar/ToggleGroupInToolbar.vue{10,13}

When the other part needs props or listeners of its own, render it in the `#render` slot. Bind `props` on it. Set `disabled` on the toolbar part, not on the other part. The element then stays in the keyboard navigation of the toolbar.

See [how props are merged](/handbook/composition#how-props-are-merged) for how the two parts combine.

## API reference

<ApiReference />
