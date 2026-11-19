---
order: 1
description: An unstyled Vue progress bar component that displays the status of a task that takes a long time.
---

<script setup lang="ts">
import ApiReference from '../.vitepress/components/ApiReference.vue';
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoSource from '../.vitepress/components/DemoSource.vue';
import DemoProgressHero from '../demos/progress/hero/css-modules/index.vue';
import DemoProgressHeroTailwind from '../demos/progress/hero/tailwind/index.vue';
</script>

# Progress

Displays the status of a task that takes a long time.

<DemoFrame>
  <DemoProgressHero />
  <template #tailwind>
    <DemoProgressHeroTailwind />
  </template>
</DemoFrame>

<DemoSource variant="css-modules">

::: code-group

<<< ../demos/progress/hero/css-modules/index.vue

<<< ../demos/progress/hero/css-modules/index.module.css

:::

</DemoSource>

<DemoSource variant="tailwind">

::: code-group

<<< ../demos/progress/hero/tailwind/index.vue

:::

</DemoSource>

## Anatomy

Import the component and assemble its parts:

<<< ./progress/Anatomy.vue

`Progress.Root` renders a `<div role="progressbar">`. Each attribute and listener that you give to a part goes to its element.

Without `value`, or with `null`, the progress is indeterminate. A value out of the range counts as the nearest end of the range.

A `Progress.Label` with no `id` prop names the bar, also in the server HTML. A label with an `id` prop names the bar from the mount on. To name the bar in the server HTML too, give the root that id in `aria-labelledby`. Use one `Progress.Label` in a root.

A root with no `Progress.Label` needs `aria-label` or `aria-labelledby`. That attribute also names a root that has a label.

The text of `Progress.Value` and `aria-valuetext` of the root is the percent of the range, or the value in `format`. With no `locale`, the text has the locale `en-US`, on the server and in the browser. Give `locale` with the locale of the page.

While the progress is indeterminate, the root has no `aria-valuetext`, and a screen reader says the state in the language of the user. To give a text, use `getAriaValueText` or `aria-valuetext`, in the language of the page.

## Styling

Each part has one of these attributes:

| Selector               | State                         |
| ---------------------- | ----------------------------- |
| `[data-indeterminate]` | The progress has no value.    |
| `[data-progressing]`   | The value is less than `max`. |
| `[data-complete]`      | The value is `max`.           |

`Progress.Indicator` has the inline style `width` with the percent of the range, and `inset-inline-start: 0`. While the progress is indeterminate, it has no inline style.

## API reference

<ApiReference />
