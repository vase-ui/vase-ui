---
order: 1
description: A guide to styling Vase UI components with your preferred styling engine.
---

# Styling

Vase UI components ship no styles. Style them with Tailwind CSS, CSS Modules, scoped styles or any other tool.

## Style hooks

### CSS classes

A part that renders an element takes the `class` attribute.

<<< ../examples/styling/ClassAttribute.vue{6}

For a class that depends on the state, render your own element in the `element` slot, and bind `:class` on it.

<<< ../examples/styling/SlotClass.vue{11}

### State selectors

Select a state of a part with the selector that the browser gives for it:

- A CSS pseudo-class, where the element has one: `:checked` on a checkbox, `:disabled` on a native button.
- An ARIA attribute that the part writes for accessibility: `[aria-expanded="true"]` on a trigger, `[aria-pressed="true"]` on a toggle.
- A `data-*` attribute, for each other state: `[data-orientation="vertical"]` on a toggle group, `[data-open]` on a collapsible.

```css
.Trigger[aria-expanded='true'] {
  font-weight: 600;
}

.Trigger:disabled {
  opacity: 0.5;
}
```

The API reference of each component lists the selectors of each part.

### CSS variables

Some parts write CSS variables with values that the part measures. For example, `Popover.Positioner` writes `--available-height` and `--anchor-width`:

```css
.Popup {
  max-height: var(--available-height);
}
```

The API reference of each component lists the CSS variables of each part.

### Inline styles

A part that renders an element takes the `style` attribute.

<<< ../examples/styling/StyleAttribute.vue{6}

For a style that depends on the state, bind `:style` on your element in the `element` slot.

<<< ../examples/styling/SlotStyle.vue{14}

## Scoped styles

A part that renders its own element has one root node: that element. A rule of `<style scoped>`, `v-show` and a custom directive on the part apply to it. An element that you render in the `element` slot is in your template, so it has your scope.

<<< ../examples/styling/ScopedStyle.vue

A `Portal` part renders no element. Write your own element in it, and give the rule to that element:

<<< ../examples/styling/ScopedPortal.vue

`NavigationMenu.Content` renders its element in a `<Teleport>`, so a scoped rule does not reach it. Render your own element in its `element` slot.

## Text direction

Set the `dir` attribute on `<html>`, or on an element around the parts. Each part reads the text direction of its own element, as a native control does. Its arrow keys and its layout follow that direction.

- In CSS, `:dir(rtl)` selects an element in right-to-left text.
- A popup in a portal is in `<body>`, so it has the direction of `<html>`. For another direction, give `dir` to its positioner.
- A server cannot read the direction of an element around a part. `Slider.Root` places its thumbs in the server HTML, so give it its own `dir`.

<<< ../examples/styling/TextDirection.vue{7}

## Zoom

A CSS `zoom` on a popup, or on an element in it, scales the popup and its arrow. The arrow points at the anchor, and `--transform-origin` is in the pixels of the popup.

Give `zoom` to the popup, not to its positioner. Floating UI places the positioner in the pixels of its offset parent, so a `zoom` of the positioner moves it away from its anchor.

In WebKit, a popup with a `zoom` in an ancestor with a `zoom` has `offsetLeft` and `offsetTop` in other pixels. There, a margin of the popup or a padding of the positioner moves its arrow and its transform origin.

## Tailwind CSS

Give the Tailwind CSS classes to the `class` attribute of each part. Use the variants of the state selectors: `aria-expanded:`, `disabled:`, `data-highlighted:`.

<<< ../examples/styling/Tailwind.vue

## CSS Modules

Give the classes of a CSS module to the `class` attribute of each part. In a Vue file, write a `<style module>` block and use the `$style` object.

<<< ../examples/styling/CssModules.vue

An imported `*.module.css` file works in the same way.

## CSS-in-JS

Give the class name that the library makes to the `class` attribute of the part.

## Differences from Base UI

| Base UI                                                                                   | Vase UI                                                                                                                            |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `className`, a string or a function of the state                                          | The `class` attribute. For a class from the state, bind `:class` on your element in the `element` slot.                            |
| `style`, an object or a function of the state                                             | The `style` attribute. For a style from the state, bind `:style` on your element in the `element` slot.                            |
| A data attribute for each state, such as `data-checked` or `data-disabled`                | A CSS pseudo-class or an ARIA attribute of the same element, where one gives the state. A `data-*` attribute for each other state. |
| `DirectionProvider` and `useDirection`                                                    | The `dir` attribute on an element around the parts. Each part reads the direction of its own element.                              |
| Constants of the names, such as `MenuItemDataAttributes` and `MenuPositionerCssVariables` | No constants. Write the selector or the variable name that the API reference of the part lists.                                    |
