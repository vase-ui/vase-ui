---
order: 1
description: An unstyled Vue combobox component that renders an input with a list of predefined items to select.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoComboboxAsyncMultiple from '../demos/combobox/async-multiple/css-modules/index.vue';
import DemoComboboxAsyncMultipleTailwind from '../demos/combobox/async-multiple/tailwind/index.vue';
import DemoComboboxAsyncSingle from '../demos/combobox/async-single/css-modules/index.vue';
import DemoComboboxAsyncSingleTailwind from '../demos/combobox/async-single/tailwind/index.vue';
import DemoComboboxCreateItems from '../demos/combobox/create-items/css-modules/index.vue';
import DemoComboboxCreateItemsTailwind from '../demos/combobox/create-items/tailwind/index.vue';
import DemoComboboxGrouped from '../demos/combobox/grouped/css-modules/index.vue';
import DemoComboboxGroupedTailwind from '../demos/combobox/grouped/tailwind/index.vue';
import DemoComboboxHero from '../demos/combobox/hero/css-modules/index.vue';
import DemoComboboxHeroTailwind from '../demos/combobox/hero/tailwind/index.vue';
import DemoComboboxInputInsidePopup from '../demos/combobox/input-inside-popup/css-modules/index.vue';
import DemoComboboxInputInsidePopupTailwind from '../demos/combobox/input-inside-popup/tailwind/index.vue';
import DemoComboboxMultiple from '../demos/combobox/multiple/css-modules/index.vue';
import DemoComboboxMultipleTailwind from '../demos/combobox/multiple/tailwind/index.vue';
import DemoComboboxVirtualized from '../demos/combobox/virtualized/css-modules/index.vue';
import DemoComboboxVirtualizedTailwind from '../demos/combobox/virtualized/tailwind/index.vue';
</script>

# Combobox

An input with a list of predefined items to select.

<DemoFrame>
  <DemoComboboxHero />
  <template #tailwind>
    <DemoComboboxHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/hero/css-modules/index.vue

<<< ../demos/combobox/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Combobox is a Select with a filter**: Use Combobox when the value must be one of a set of predefined items. It works like [Select](/components/select), but the user types in an input to filter the items. Prefer Combobox to Select when the list is long enough to need a filter.
- **Avoid for search widgets**: Combobox does not accept free-form text. For a search widget, use [Autocomplete](/components/autocomplete).
- **Avoid when there is no input**: Use [Select](/components/select) when the combobox has no input. Select has the accessibility features of a listbox with no input.
- **Form controls must have an accessible name**: Label the control with a native `<label>`, `<Field.Label>` or `<Combobox.Label>`. `<Combobox.Label>` names the control: the input, or the trigger when the input is in the popup. When no label is visible, give the control an `aria-label`. See the [forms guide](/handbook/forms).
- **Closing animations**: Put a `<Transition appear>` around `<Combobox.Popup>`. Without `keepMounted`, the popup mounts at each open, so the `<Transition>` needs `appear`. The popup stays in the DOM until its leave ends. See the [animation guide](/handbook/animation).

## Anatomy

Import the component and assemble its parts:

<<< ./combobox/Anatomy.vue

## Item values

Each `<Combobox.Item>` takes a `value` prop that identifies it. Pass the item that the `item` slot of `<Combobox.List>` renders. The slot renders each filtered item, and gets `{ item, index }`:

<<< ./combobox/ItemObjects.vue{19}

That item is the selected value. The `modelValue` and `defaultValue` props take it, and `valueChange` gives it. To store IDs instead, see [Value selection with IDs](#value-selection-with-ids).

## Examples

### Typed component

`Combobox.Root` is a generic component with the type arguments `Value`, `Multiple` and `Item`. `Multiple` defaults to `false`, and `Item` defaults to `Value`.

To fix the types, give the part its type arguments in an instantiation expression. Use the result as a component:

<<< ./combobox/TypedComponent.vue{10,23}

A `createItems()` collection has items that differ from its selection values. The root needs the third type argument, `Item`, to accept such a collection. Without it, the type check refuses the collection.

A wrapper that declares `defineProps<ComboboxRootProps<Value, Multiple, Item>>()` and forwards the props with `v-bind` does not work. Vue gives an absent Boolean prop the value `false`. The wrapper then passes `false` for each Boolean prop that its consumer omits, such as `open`, and the combobox stays closed.

### Value selection with IDs

When your app stores IDs and not item objects, use `Combobox.createItems` with `getValue` and `getLabel`. They derive the selection value and the display label of each item.

With static data, create the collection at module scope. The parameters of the two functions get their types from `users`. Give the derived ID to the `value` prop of `<Combobox.Item>`, not the item that the slot renders:

<<< ./combobox/ItemIds.vue{19}

The props and the events of the selection use the derived IDs, and the list still gets the original items. The filter and the typeahead use the derived label.

When the data loads or changes at run time, make the collection in a `computed`. The collection then changes only with its data:

<<< ./combobox/DynamicItems.vue

<DemoFrame>
  <DemoComboboxCreateItems />
  <template #tailwind>
    <DemoComboboxCreateItemsTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/create-items/css-modules/index.vue

<<< ../demos/combobox/create-items/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/create-items/tailwind/index.vue

:::

</DemoSource>

Use primitive items for a simple list. Use object values when the selected record is useful state of the app. Use `createItems()` when the selection needs a stable primitive ID and the list uses object records.

Stable IDs keep the match of the items when a data library replaces the row objects at a refetch. With object values, use `isItemEqualToValue` to compare their IDs.

When a server filters the results, `items` is the list of records that the app knows. `filteredItems` is the window of results that the popup shows. Give `filteredItems` the source items, not the derived values. Keep the flat or grouped structure of `items`:

<<< ./combobox/FilteredWindow.vue{23}

Put the record of the selected user in `knownUsers`. Its label then stays available while the record is not in `searchResults`. Or give `itemToStringLabel`, when the selected value alone gives the label.

### Multiple select

Add the `multiple` prop to `<Combobox.Root>` to let the user select more than one item. The value is then an array. Render each selected item as a `<Combobox.Chip>` in `<Combobox.Chips>`. The user can remove a chip.

<DemoFrame>
  <DemoComboboxMultiple />
  <template #tailwind>
    <DemoComboboxMultipleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/multiple/css-modules/index.vue

<<< ../demos/combobox/multiple/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/multiple/tailwind/index.vue

:::

</DemoSource>

To let screen readers announce how to reach and remove the chips, give `aria-description` to `<Combobox.Chip>` and `<Combobox.Input>`. Also give `aria-label` to `<Combobox.Chips>` and `<Combobox.ChipRemove>`. Vase UI does not ship these strings. Translate them with the rest of your interface.

To limit the visible chips, slice the selected values that `<Combobox.Value>` gives to its slot:

<<< ./combobox/LimitedChips.vue{15,22-24}

#### Keeping the filter after selection

In `multiple` mode, a selection clears the filter that the user typed. When the input is outside the popup, that selection also closes the popup. To let the user pick more than one result of a query, cancel the change request that does this.

The request to cancel depends on where the input is. When the input is outside the popup, cancel the close request in `openChange`. That request has the reason `item-press`:

<<< ./combobox/KeepFilterOutside.vue{5-7}

When the input is inside the popup, cancel the request that clears the input in `inputValueChange`. That request has `eventDetails.isItemPress`:

<<< ./combobox/KeepFilterInside.vue{5-7}

The typed filter still resets when the popup closes.

### Input inside popup

`<Combobox.Input>` can be inside `<Combobox.Popup>`. The combobox is then a select popup with a search field.

<DemoFrame>
  <DemoComboboxInputInsidePopup />
  <template #tailwind>
    <DemoComboboxInputInsidePopupTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/input-inside-popup/css-modules/index.vue

<<< ../demos/combobox/input-inside-popup/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/input-inside-popup/tailwind/index.vue

:::

</DemoSource>

In this pattern, use `<Combobox.Label>` to give the trigger a visible label:

<<< ./combobox/Label.vue{7}

`<Combobox.Label>` renders a `<div>`. With the input inside the popup, a click on the label focuses the trigger and does not open the popup.

With the input outside the popup, use a native `<label>` or `<Field.Label>` for the input. A click on `<Combobox.Label>` then focuses the input, and not the trigger.

### Grouped

Use `<Combobox.Group>` and `<Combobox.GroupLabel>` to add headings that group related items in the popup.

The `items` prop describes the groups as an array of objects. Each object has an `items` array with the items of its group. Another property, such as `value`, can give the text of the heading:

<<< ./combobox/Grouped.vue{6,12,16}

<DemoFrame>
  <DemoComboboxGrouped />
  <template #tailwind>
    <DemoComboboxGroupedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/grouped/css-modules/index.vue

<<< ../demos/combobox/grouped/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/grouped/tailwind/index.vue

:::

</DemoSource>

### Async search (single)

Load the items from a remote source when the input changes. The app does not need to load all items first. Keep the selected item in the `items` list, so that it stays available while new results arrive.

<DemoFrame>
  <DemoComboboxAsyncSingle />
  <template #tailwind>
    <DemoComboboxAsyncSingleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/async-single/css-modules/index.vue

<<< ../demos/combobox/async-single/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/async-single/tailwind/index.vue

:::

</DemoSource>

### Async search (multiple)

Load the items from a remote source when the input changes, and allow more than one selected item. The app does not need to load all items first. The selected items stay in the list while new matches arrive.

<DemoFrame>
  <DemoComboboxAsyncMultiple />
  <template #tailwind>
    <DemoComboboxAsyncMultipleTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/async-multiple/css-modules/index.vue

<<< ../demos/combobox/async-multiple/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/async-multiple/tailwind/index.vue

:::

</DemoSource>

### Virtualized

Use a virtualization library, such as `@tanstack/vue-virtual`, to handle a large data set.

<DemoFrame>
  <DemoComboboxVirtualized />
  <template #tailwind>
    <DemoComboboxVirtualizedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/combobox/virtualized/css-modules/index.vue

<<< ../demos/combobox/virtualized/css-modules/VirtualizedList.vue

<<< ../demos/combobox/virtualized/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/combobox/virtualized/tailwind/index.vue

<<< ../demos/combobox/virtualized/tailwind/VirtualizedList.vue

:::

</DemoSource>

#### Memoizing items

A child component that takes the item as a prop is a simpler alternative to virtualization for a short list. Vue renders a child component again only when its props, its slots or the reactive values of its render change. A typed character then renders only the items that change. The open is not faster, because the popup mounts each item. For a long list, use virtualization.

::: code-group

<<< ./combobox/FruitItem.vue

<<< ./combobox/MemoizedItems.vue{20}

:::

## API reference

<ApiReference />

### useFilter

Returns a filter that matches items with a query through `Intl.Collator`, for a list that you filter yourself.

<ApiReference name="Combobox.useFilter" :heading-level="4" />

### useFilteredItems

Returns the items that the filter of `Combobox.Root` keeps, for a component inside the root.

<ApiReference name="Combobox.useFilteredItems" :heading-level="4" />

### createItems

Makes a collection for the `items` prop of `Combobox.Root`, with the selection value and the label of each item.

<ApiReference name="Combobox.createItems" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
