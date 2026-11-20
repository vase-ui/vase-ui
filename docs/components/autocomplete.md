---
order: 1
description: An unstyled Vue autocomplete component that renders an input with a list of filtered options.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import BaseUiDifferences from '../.vitepress/components/BaseUiDifferences.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoAutocompleteAsync from '../demos/autocomplete/async/css-modules/index.vue';
import DemoAutocompleteAsyncTailwind from '../demos/autocomplete/async/tailwind/index.vue';
import DemoAutocompleteAutoHighlight from '../demos/autocomplete/auto-highlight/css-modules/index.vue';
import DemoAutocompleteAutoHighlightTailwind from '../demos/autocomplete/auto-highlight/tailwind/index.vue';
import DemoAutocompleteFuzzyMatching from '../demos/autocomplete/fuzzy-matching/css-modules/index.vue';
import DemoAutocompleteFuzzyMatchingTailwind from '../demos/autocomplete/fuzzy-matching/tailwind/index.vue';
import DemoAutocompleteGrouped from '../demos/autocomplete/grouped/css-modules/index.vue';
import DemoAutocompleteGroupedTailwind from '../demos/autocomplete/grouped/tailwind/index.vue';
import DemoAutocompleteHero from '../demos/autocomplete/hero/css-modules/index.vue';
import DemoAutocompleteHeroTailwind from '../demos/autocomplete/hero/tailwind/index.vue';
import DemoAutocompleteInline from '../demos/autocomplete/inline/css-modules/index.vue';
import DemoAutocompleteInlineTailwind from '../demos/autocomplete/inline/tailwind/index.vue';
import DemoAutocompleteLimit from '../demos/autocomplete/limit/css-modules/index.vue';
import DemoAutocompleteLimitTailwind from '../demos/autocomplete/limit/tailwind/index.vue';
import DemoAutocompleteVirtualized from '../demos/autocomplete/virtualized/css-modules/index.vue';
import DemoAutocompleteVirtualizedTailwind from '../demos/autocomplete/virtualized/tailwind/index.vue';
</script>

# Autocomplete

An input that suggests options for the text that the user types.

<DemoFrame>
  <DemoAutocompleteHero />
  <template #tailwind>
    <DemoAutocompleteHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/hero/css-modules/index.vue

<<< ../demos/autocomplete/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/hero/tailwind/index.vue

:::

</DemoSource>

## Usage guidelines

- **Avoid when a selection state is necessary**: Use [Combobox](/components/combobox) when the selection must stay and the text must be one of the items. The input of Autocomplete can hold free-form text, and its suggestions only complete the text when the user wants them.
- **Form controls must have an accessible name**: Give the input a `<label>` element, or use [Field](/components/field). See the [forms guide](/handbook/forms).
- **Closing animations**: Put a `<Transition appear>` around `<Autocomplete.Popup>`. Without `keepMounted`, the popup mounts at each open, so the `<Transition>` needs `appear`. The popup stays in the DOM until its leave ends. See the [animation guide](/handbook/animation).

## Anatomy

Import the component and assemble its parts:

<<< ./autocomplete/Anatomy.vue

## Item values

Each `<Autocomplete.Item>` takes a `value` prop that identifies it. Pass the item that the `item` slot of `<Autocomplete.List>` renders, so that props such as `itemToStringValue` get it. The slot gets `{ item, index }`.

## Examples

### Async search

Load the items from a remote source when the text changes, and show the status of the load in `<Autocomplete.Status>`.

<DemoFrame>
  <DemoAutocompleteAsync />
  <template #tailwind>
    <DemoAutocompleteAsyncTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/async/css-modules/index.vue

<<< ../demos/autocomplete/async/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/async/tailwind/index.vue

:::

</DemoSource>

### Inline autocomplete

The `mode` prop fills the input with the text of the item that the arrow keys highlight. It takes the values of `aria-autocomplete`: `list`, `both`, `inline` or `none`.

<DemoFrame>
  <DemoAutocompleteInline />
  <template #tailwind>
    <DemoAutocompleteInlineTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/inline/css-modules/index.vue

<<< ../demos/autocomplete/inline/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/inline/tailwind/index.vue

:::

</DemoSource>

### Grouped

Use `<Autocomplete.Group>` and `<Autocomplete.GroupLabel>` to add headings that group related items in the popup.

The `items` prop describes the groups as an array of objects. Each object has an `items` array with the items of its group. Another property, such as `value`, can give the text of the heading:

<<< ./autocomplete/Grouped.vue{6,12,16}

<DemoFrame>
  <DemoAutocompleteGrouped />
  <template #tailwind>
    <DemoAutocompleteGroupedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/grouped/css-modules/index.vue

<<< ../demos/autocomplete/grouped/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/grouped/tailwind/index.vue

:::

</DemoSource>

### Fuzzy matching

A fuzzy match finds relevant items also when the query is not the same as the text of the item.

<DemoFrame>
  <DemoAutocompleteFuzzyMatching />
  <template #tailwind>
    <DemoAutocompleteFuzzyMatchingTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/fuzzy-matching/css-modules/index.vue

<<< ../demos/autocomplete/fuzzy-matching/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/fuzzy-matching/tailwind/index.vue

:::

</DemoSource>

### Limit results

The `limit` prop sets the largest number of visible items. `<Autocomplete.Status>` tells the user to make the query more specific.

<DemoFrame>
  <DemoAutocompleteLimit />
  <template #tailwind>
    <DemoAutocompleteLimitTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/limit/css-modules/index.vue

<<< ../demos/autocomplete/limit/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/limit/tailwind/index.vue

:::

</DemoSource>

### Auto highlight

The `autoHighlight` prop of `<Autocomplete.Root>` gives the highlight to the first item that matches the typed text. Set it to `"always"` to keep a highlight at each time, such as for a list in place in a dialog.

Use it with the `keepHighlight` and `highlightItemOnHover` props to set the highlight for the pointer.

<DemoFrame>
  <DemoAutocompleteAutoHighlight />
  <template #tailwind>
    <DemoAutocompleteAutoHighlightTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/auto-highlight/css-modules/index.vue

<<< ../demos/autocomplete/auto-highlight/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/auto-highlight/tailwind/index.vue

:::

</DemoSource>

### Virtualized

Use a virtualization library, such as `@tanstack/vue-virtual`, to handle a large data set.

<DemoFrame>
  <DemoAutocompleteVirtualized />
  <template #tailwind>
    <DemoAutocompleteVirtualizedTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/autocomplete/virtualized/css-modules/index.vue

<<< ../demos/autocomplete/virtualized/css-modules/VirtualizedList.vue

<<< ../demos/autocomplete/virtualized/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/autocomplete/virtualized/tailwind/index.vue

<<< ../demos/autocomplete/virtualized/tailwind/VirtualizedList.vue

:::

</DemoSource>

#### Memoizing items

A child component that takes the item as a prop is a simpler alternative to virtualization for a short list. Vue renders a child component again only when its props, its slots or the reactive values of its render change. A typed character then renders only the items that change. The open is not faster, because the popup mounts each item. For a long list, use virtualization.

::: code-group

<<< ./autocomplete/SuggestionItem.vue

<<< ./autocomplete/MemoizedItems.vue{20}

:::

## API reference

<ApiReference />

### useFilter

Returns a filter that matches items with a query through `Intl.Collator`, for a list that you filter yourself.

<ApiReference name="Autocomplete.useFilter" :heading-level="4" />

### useFilteredItems

Returns the items that the filter of `Autocomplete.Root` keeps, for a component inside the root.

<ApiReference name="Autocomplete.useFilteredItems" :heading-level="4" />

## Differences from Base UI

<BaseUiDifferences />
