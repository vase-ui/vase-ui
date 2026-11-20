---
order: 1
description: An unstyled Vue select component that selects a predefined value from a dropdown menu.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoSelectGrouped from '../demos/select/grouped/css-modules/index.vue';
import DemoSelectGroupedTailwind from '../demos/select/grouped/tailwind/index.vue';
import DemoSelectHero from '../demos/select/hero/css-modules/index.vue';
import DemoSelectHeroTailwind from '../demos/select/hero/tailwind/index.vue';
import DemoSelectMultiple from '../demos/select/multiple/css-modules/index.vue';
import DemoSelectMultipleTailwind from '../demos/select/multiple/tailwind/index.vue';
import DemoSelectObjectValues from '../demos/select/object-values/css-modules/index.vue';
import DemoSelectObjectValuesTailwind from '../demos/select/object-values/tailwind/index.vue';
</script>

# Select

A form control that selects a predefined value from a dropdown menu.

<DemoFrame>
  <DemoSelectHero />
  <template #tailwind>
    <DemoSelectHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/select/hero/css-modules/index.vue

<<< ../demos/select/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/select/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Use Combobox for a long list**: Select has no filter, only the keyboard typeahead. When the list needs a filter, use [Combobox](/components/combobox).
- **Special positioning**: By default, the popup covers its trigger, with the text of the selected item over the text of the value. See [Positioning](#positioning) to turn this off or to change it.
- **Form controls must have an accessible name**: Use `<Select.Label>`, or give `<Select.Trigger>` an `aria-label` when no label is visible. See [Labeling a select](#labeling-a-select) and the [forms guide](/handbook/forms).
- **Closing animations**: Put a `<Transition>` around `<Select.Popup>`. The popup stays visible until its leave ends. See the [animation guide](/handbook/animation).

## Anatomy

Import the component and assemble its parts:

<<< ./select/Anatomy.vue

## Positioning

`<Select.Positioner>` has the prop `alignItemWithTrigger`. By default, it makes the popup cover the trigger, with the text of the selected item over the text of the value.

While this mode is active, `data-side` is `"none"` on `Select.Popup` and `Select.Positioner`.

To place the popup at a side of the trigger, set `alignItemWithTrigger` to `false`. While it is `true` (the default), these rules apply:

- **Interaction type**: The mode is off when the popup opens with a touch pointer.
- **Viewport space**: The viewport must have enough room to put the selected item over the text of the value with a popup that is not too short. If it does not, the popup uses the default positioning. Set `min-height` on `<Select.Positioner>` to change the limit. A smaller value makes this occur less often. The trigger must also be at least 20px from the top and from the bottom of the viewport. If it is not, the popup uses the default positioning.
- **Other positioning props**: Props such as `side` and `align` have no effect while the mode is active. They apply when the prop is `false`, and when the popup uses the default positioning.

## Examples

### Typed component

`Select.Root` is a generic component. Its `Value` type follows the `modelValue` and `defaultValue` props. Its `Multiple` type follows `multiple`.

To fix both types, give the part its type arguments in an instantiation expression. Use the result as a component:

<<< ./select/TypedComponent.vue{7,15}

A wrapper that declares `defineProps<SelectRootProps<Value, Multiple>>()` and forwards the props with `v-bind` does not work. Vue gives an absent Boolean prop the value `false`. The wrapper then passes `open` as `false`, and the select cannot open.

### Formatting the value

By default, `<Select.Value>` renders the raw value.

Give the `items` prop to `<Select.Root>` to render the label of the selected item:

<<< ./select/Items.vue{4-9,13}

The default slot of `<Select.Value>` renders a formatted value. Its slot prop `value` is the selected value:

<<< ./select/LookupMap.vue{13-15}

To avoid the lookup, use [object values](#object-values) for the items.

### Labeling a select

Use `<Select.Label>` to give the trigger a visible label:

<<< ./select/Label.vue{7}

`<Select.Label>` renders a `<div>`. A click on it moves the focus to the trigger and does not open the popup.

In a `Field.Root`, `<Field.Label>` is a native `<label>` of the trigger. A click on it opens the popup, as a click on the trigger does.

### Placeholder values

To show a placeholder, set the `placeholder` prop of `<Select.Value>`:

<<< ./select/Placeholder.vue{13}

With a placeholder, the user cannot clear the value with the select itself. To make the value clearable from the popup, add an item with a `null` value to the list. While nothing is selected, `<Select.Value>` shows the label of that item:

<<< ./select/Items.vue{5}

### Multiple selection

Add the `multiple` prop to `<Select.Root>` to allow more than one selected item. The value is then an array.

<DemoFrame>
  <DemoSelectMultiple />
  <template #tailwind>
    <DemoSelectMultipleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/select/multiple/css-modules/index.vue

<<< ../demos/select/multiple/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/select/multiple/tailwind/index.vue

:::

</DemoSource>

### Object values

An item can have an object as its value. The default slot of `<Select.Value>` then gets the whole object, and the select needs no `items` for the lookup.

<DemoFrame>
  <DemoSelectObjectValues />
  <template #tailwind>
    <DemoSelectObjectValuesTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/select/object-values/css-modules/index.vue

<<< ../demos/select/object-values/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/select/object-values/tailwind/index.vue

:::

</DemoSource>

### Grouped

Use `<Select.Group>` and `<Select.GroupLabel>` to add headings that group related items in the popup.

The `items` prop describes the groups as an array of objects. Each object has an `items` array with the items of its group. Another property, such as `value`, can give the text of the heading:

<<< ./select/GroupedItems.vue{7,14}

<DemoFrame>
  <DemoSelectGrouped />
  <template #tailwind>
    <DemoSelectGroupedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/select/grouped/css-modules/index.vue

<<< ../demos/select/grouped/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/select/grouped/tailwind/index.vue

:::

</DemoSource>

## API reference

<ApiReference />

## Differences from Base UI

<BaseUiDifferences />
