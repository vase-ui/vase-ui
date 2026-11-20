---
order: 1
description: Learn how to style Vase UI components with your preferred styling engine.
---

# Styling

A guide to styling Vase UI components with your preferred styling engine.

Vase UI components are unstyled and ship no styles. Use [Tailwind CSS](https://tailwindcss.com), CSS Modules, scoped styles or any other styling solution that you prefer. You keep full control of your styling layer.

## Style hooks

### CSS classes

A part that renders an HTML element accepts a `class` attribute. Use it to style the element with CSS classes.

<<< ../examples/styling/ClassAttribute.vue{6}

The class you give to the part comes before its own class. For a class that depends on state, bind `:class` on the element in the render slot.

<<< ../examples/styling/SlotClass.vue{11}

### Data attributes

A part sets data attributes for its states. For example, you can style [Toggle Group](/components/toggle-group) with its `[data-orientation]` attribute. A part whose element has a pseudo-class or an ARIA attribute for a state has no data attribute for that state. [Checkbox](/components/checkbox) has `:checked`, and [Toggle](/components/toggle) has `[aria-pressed='true']`. The page of a part lists a selector for each state.

```css
.ToggleGroup[data-orientation='vertical'] {
  flex-direction: column;
}
```

### CSS variables

A part exposes CSS variables to help you style it. They often hold dynamic numeric values for size or transform calculations. For example, `Popover.Positioner` of [Popover](/components/popover) sets `--available-height` and `--anchor-width`. A rule on the popup can read them.

```css
.Popup {
  max-height: var(--available-height);
}
```

See the API reference of each component for a complete list of its data attributes and CSS variables.

### Inline styles

A part that renders an HTML element accepts a `style` attribute. Use it to style the element with an object of CSS properties.

<<< ../examples/styling/StyleAttribute.vue{6}

For a style that depends on state, bind `:style` on the element in the render slot.

<<< ../examples/styling/SlotStyle.vue{14}

If the part controls the same property, put your style before `v-bind="props"` to give the part priority.
For example, `ScrollArea.Viewport` suspends `scroll-snap-type` during a drag.

## Scoped styles

Each part that renders an element has one root node, except the parts that this section names. A rule of `<style scoped>` thus matches the element of the part. `v-show`, a custom directive and `<Transition>` on the part apply to that element too. This also applies to a part that renders its element only in some states, such as `Collapsible.Panel`, `Dialog.Backdrop` or `Tabs.Indicator`.

`Tabs.Indicator` with `renderBeforeHydration` keeps one root node: its script is the last child of its element. `OTPField.Root` also keeps one root node: its hidden input is the last child of its element. With the `element` slot, the script or the hidden input follows the element of the slot, so the part has two root nodes. The element of the slot has the scope of the developer, so a rule of `<style scoped>` still matches it.

Each `Popup` part has one root node, also while it keeps focus guards or a dismiss button beside its element. A rule of `<style scoped>`, `v-show`, a custom directive and `<Transition>` thus apply to the popup element.

In this sample, the rules `.root` and `.input` match `DateField.Root` and `DateField.Input`, which each have one root node:

<<< ../examples/styling/ScopedStyle.vue

Each `Portal` part renders its content in a `Teleport`, in another place of the document. `Popover.Portal` renders no element of its own: write an element of your own in it. Each other `Portal` part renders its element there. A rule of `<style scoped>`, `v-show` and a custom directive on the part do not reach that element, and `:deep()` does not reach it either. Write the element in the `#render` slot of the part, bind `props` on it, and mount `children` in it. In both forms, the element is an element of your own template, so they apply to it:

<<< ../examples/styling/ScopedPortal.vue

The default element of `NavigationMenu.Content` is in a `<Teleport>`, so a scoped rule does not reach it. Render your element in its `element` slot, and bind `props` and `elementRef` on it.

## Tailwind CSS

Apply Tailwind CSS classes to each part with the `class` attribute. The variants that start with `data-` use the data attributes of the part.

<<< ../examples/styling/Tailwind.vue

## CSS Modules

Apply custom CSS classes to each part with the `class` attribute. Then write the rules of those classes in a CSS module. In a Vue file, use a `<style module>` block and the `$style` object.

<<< ../examples/styling/CssModules.vue

An imported `*.module.css` file works in the same way, as the demos of this site do.

## CSS-in-JS

A library that gives you a class name can give it to the `class` attribute.

The entry point of a component that has no `element` slot also exports the names of its data attributes, such as `TimePickerItemDataAttributes`. Use them in code that writes CSS in script. In this sample, `TimePickerItemDataAttributes.selected` is `data-selected`:

<<< ../examples/styling/StyleNames.vue
