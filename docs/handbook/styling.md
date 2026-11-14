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

<<< ../examples/styling/ClassAttribute.vue{7}

A part also accepts a `stateClass` prop. It is a function that gets the state of the part and returns a class.

<<< ../examples/styling/StateClass.vue{7}

The element gets the classes in this order: `class`, the result of `stateClass`, then the class of the part. Vue removes a function that you give to `class`, so use `stateClass` for a class that depends on the state.

### Data attributes

A part sets data attributes for its states. For example, you can style [Switch](/components/switch) with its `[data-checked]` and `[data-unchecked]` attributes, among others.

```css
.SwitchThumb[data-checked] {
  background-color: green;
}
```

### CSS variables

A part exposes CSS variables to help you style it. They often hold dynamic numeric values for size or transform calculations. For example, `Tooltip.Positioner` of [Tooltip](/components/tooltip) sets `--available-height` and `--anchor-width`. A rule on the popup can read them.

```css
.Popup {
  max-height: var(--available-height);
}
```

See the API reference of each component for a complete list of its data attributes and CSS variables.

### Style prop

A part that renders an HTML element accepts a `style` attribute. Use it to style the element with an object of CSS properties.

<<< ../examples/styling/StyleAttribute.vue{7}

A part also accepts a `stateStyle` prop. It is a function that gets the state of the part and returns a style.

<<< ../examples/styling/StateStyle.vue{7}

For one property, `stateStyle` wins over `style`, and `style` wins over the style of the part.

## Scoped styles

A rule of `<style scoped>` matches the element of a part that has one root node.

A part that renders a hidden input beside its element has more than one root node. `Switch.Root`, `Checkbox.Root`, `Radio.Root`, `NumberField.Root` and `OTPField.Root` are such parts. `Toast.Viewport`, and `NavigationMenu.Viewport` in a positioner, render other nodes beside their element, so they also have more than one root node. A rule of `<style scoped>` does not match the element of such a part, and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`. The API reference of each such part says this.

In this sample, the rule `.thumb` matches `Switch.Thumb`, which has one root node. The rule `.field :deep(.switch)` reaches `Switch.Root` from an element of your own:

<<< ../examples/styling/ScopedStyle.vue

## Tailwind CSS

Apply Tailwind CSS classes to each part with the `class` attribute. The variants that start with `data-` use the data attributes of the part.

<<< ../examples/styling/Tailwind.vue

## CSS Modules

Apply custom CSS classes to each part with the `class` attribute. Then write the rules of those classes in a CSS module. In a Vue file, use a `<style module>` block and the `$style` object.

<<< ../examples/styling/CssModules.vue

An imported `*.module.css` file works in the same way, as the demos of this site do.

## CSS-in-JS

A library that gives you a class name can give it to the `class` attribute.

The entry point of a component also exports the names of its data attributes and CSS variables, such as `TooltipPopupDataAttributes` and `TooltipPositionerCssVariables`. Use them in code that writes CSS in script. In this sample, `TooltipPositionerCssVariables.availableHeight` is `--available-height`:

<<< ../examples/styling/StyleNames.vue
