---
order: 1
description: An unstyled Vue select component for choosing a predefined value in a dropdown menu.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
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

A common form component for choosing a predefined value in a dropdown menu.

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

- **Use Combobox for a long list**: Select has no filter. The keyboard typeahead only finds an item that matches the typed text. When the list is long enough to need a filter, use [Combobox](/components/combobox).
- **Special positioning**: By default, the popup overlaps its trigger, so that the text of the selected item is over the value text of the trigger. See [Positioning](#positioning) to turn this off or to change it.
- **Form controls must have an accessible name**: Use `<Select.Label>`, or give `<Select.Trigger>` an `aria-label` when the select has no visible label. See [Labeling a select](#labeling-a-select) and the [forms guide](/handbook/forms).
- **Animations**: Put a `<Transition>` around `<Select.Popup>`. See [Animation](#animation).

## Anatomy

Import the component and assemble its parts:

<<< ./select/Anatomy.vue

`Select.Root` renders a `<div>` that holds the form inputs after its content. For a select in a line of text, give the root `display: inline-block` or `display: contents`. Do not put `Select.Root` in a `<p>`: the HTML parser closes the paragraph at the `<div>`, and the hydration then fails.

Bind the value with `v-model`. The root emits `valueChange` with the new value and `eventDetails`, and then `update:modelValue`. Without `multiple`, a press of the selected item emits neither event, and the popup closes. To stop the change, call `eventDetails.cancel()` before the `valueChange` listener returns. The root then emits no `update:modelValue` and keeps its value.

The popup and its items stay in the DOM, hidden, from the first focus of the trigger or the first open. So a key on the closed trigger selects the next item whose text starts with it, as on a native select.

## Forms

A select with a `name` submits its value in a `type="hidden"` input. With `multiple`, it submits one value for each selected item. A hidden input keeps a line break of the value.

A visually hidden text input has the constraint validation of `required`, and it takes the fill of the browser. Give `autocomplete` to the root so that the browser fills it. A native reset gives the select its first value back.

## Animation

Put a `<Transition>` around `<Select.Popup>`, and around `<Select.Backdrop>`. Do not write `v-show` or `appear`: the part shows and hides its own element, so the `<Transition>` runs the enter and the leave of each open and close. To run code at the end of an animation, use `@after-enter` and `@after-leave`. To animate with JavaScript, give the `<Transition>` `:css="false"` and call `done` in its `@leave` hook.

Do not give a closed popup a size with CSS: a box with a size makes the page scroll further.

## The selected mark

The default slot of `<Select.Item>` gets `state.selected`. Render the mark with `v-if`:

```vue
<Select.Item value="sans" v-slot="{ state }">
  <CheckIcon v-if="state.selected" />
  <Select.ItemText>Sans-serif</Select.ItemText>
</Select.Item>
```

For CSS alone, select `[aria-selected="true"]` on the item.

## Style hooks

- The trigger has `aria-expanded="true"` while open, `:disabled`, `aria-readonly="true"`, `aria-required="true"` and `aria-invalid="true"`. It has `data-pressed`, `data-popup-side`, `data-placeholder` and the state of its field.
- An item has `aria-selected="true"`, `aria-disabled="true"` and `data-highlighted`.
- A scroll arrow is in the DOM while the list can scroll in its direction. With `keepMounted`, it stays and has `hidden`, so an arrow with a `display` rule needs `[hidden] { display: none }`.

## Positioning

`<Select.Positioner>` has the prop `alignItemWithTrigger`. By default, it makes the popup overlap the trigger, so that the text of the selected item is over the value text of the trigger.

While this mode is active, `data-side` is `"none"` on `Select.Popup` and `Select.Positioner`.

To stop the popup from overlapping the trigger, set `alignItemWithTrigger` to `false`. While it is `true` (the default), these rules apply:

- **Interaction type**: The mode is off when the popup opens with a touch pointer.
- **Viewport space**: The viewport must have enough room to put the selected item over the value text without a popup that is too short. If it has not, the popup falls back to the default positioning. Set `min-height` on `<Select.Positioner>` to change the limit. A smaller value makes the popup fall back less often. The trigger must also be at least 20px from the top and from the bottom of the viewport. If it is not, the popup falls back.
- **Other positioning props**: Props such as `side` and `align` have no effect while the mode is active. They apply when the prop is `false`, and when the popup falls back.

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

## Portal target

Set `to` on `Select.Portal` to select a target. For example, `to="#overlays"` selects the element with that ID. See [Portal targets](/components/dialog#portal-targets).

## API reference

<ApiReference />
