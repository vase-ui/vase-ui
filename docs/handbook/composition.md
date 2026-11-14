---
order: 3
description: A guide to composing Vase UI components with your own Vue components.
---

# Composition

A guide to composing Vase UI components with your own Vue components.

## Composing custom components

Use the `as` prop or the `#render` slot to compose a Vase UI part with your own components. The `as` prop takes a tag or a component. The `#render` slot gives `props` to bind on your own element or component.

For example, most triggers render a `<button>` by default. The sample below uses a custom button instead.

<<< ../examples/composition/CustomTrigger.vue{9-11}

Give the component to `as` when it needs no props of its own: `:as="MyButton"`. Use `#render` when it has props of its own, such as `size`. With `strictTemplates`, the type check refuses a prop that the default element of the part does not have.

The custom component needs one root element. Vue gives the attributes to that element by default. The part reads the element from the `element` that the component exposes. If the component exposes none, the part reads its root element.

Under `#render`, the part does not render its default slot. Put the content in your element.

## Composing multiple components

To compose more than one part with your own components, nest the `#render` slots as deeply as you need. Tooltip is a common example.

<<< ../examples/composition/NestedTriggers.vue{11-17}

In this sample, `Tooltip.Trigger` renders `Dialog.Trigger`, and `Dialog.Trigger` renders `MyButton`. A popup trigger is a generic component, and the type check refuses it as the value of `as`. Nest the `#render` slots instead.

## How props are merged

With `as`, a part has one set of attributes. The part takes the props that it declares. It gives the other attributes to the tag or component. For example, `Toolbar.Button` declares `disabled`. Set `disabled` on `Toolbar.Button`, and not on the part that you render in its slot. The toolbar then keeps the element in its keyboard navigation.

With `#render`, the slot gets `props`. It holds the attributes, the listeners, the state data attributes, the class, the style and the `ref` setter. Bind it on your element with `v-bind="props"`.

Attributes that you write beside `v-bind="props"` follow the rules of Vue. When `v-bind="props"` comes first, Vue joins the `class` values and merges the `style` values. Vue calls both listeners, and it calls the listener of `props` first. For another attribute, such as `id` or `title`, the attribute that comes last wins.

For your listener to run first, merge `props` with `mergeProps`. See [how merging works](/utils/merge-props#how-merging-works). In your listener, [`event.preventVaseUIHandler()`](/handbook/customization#preventing-vase-ui-from-handling-an-event) stops the listeners of the part. For example, this toolbar button renders a toggle:

<<< ../examples/composition/MergedProps.vue{13-17,21-25}

The rendered `<button>` gets:

- `class="toggle toolbar-button"`: class names are combined, and the rightmost set comes first.
- `style="color: blue; padding: 4px;"`: style objects are merged, and the rightmost set wins.
- Both click listeners, and `handleToggleClick` runs first. `event.preventVaseUIHandler()` skips every listener that runs after it. When `handleToggleClick` calls it, `handleToolbarClick` does not run. Some parts call it internally.

An element takes one `ref`, and Vue keeps the last `ref` key. To keep the `ref` of the part and add one of your own, call `props.ref` in a function ref: `:ref="(element) => { props.ref(element); own = element }"`.

## Changing the default rendered element

You can also use the `as` prop to change the element that a part renders.

For example, `<Accordion.Header>` renders an `<h3>` element by default. The sample below renders it as an `<h2>` element, so that it fits the heading hierarchy of the page.

<<< ../examples/composition/HeadingLevel.vue{8}

Each Vase UI part renders the most appropriate element by default. In most cases, render a different element only when you have a reason for it.

## The render slot

The `#render` slot gives you complete control over where `props` go. It also lets you render different content for each state.

<<< ../examples/composition/RenderSlot.vue{8-13}

The default slot also gets `{ state }`. Some parts have nodes of their own. `Slider.Thumb` has a range input. Such a part gives `#render` a third slot prop, `children`. Mount `children` in your element. A development build shows a warning when the slot does not mount it.

<<< ../examples/composition/RenderChildren.vue{10-12}
