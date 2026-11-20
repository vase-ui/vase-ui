---
order: 3
description: How Vase UI components help you make an accessible app, and what your app adds.
---

# Accessibility

Vase UI components give the roles, the states and the keyboard support of the WAI-ARIA Authoring Practices. Your app gives the labels, the focus styles and the colors.

## Keyboard navigation

The components follow the [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/), so a person can use each component with only a keyboard. Many components use the arrow keys, <kbd>Home</kbd>, <kbd>End</kbd>, <kbd>Enter</kbd>, <kbd>Esc</kbd> and the letter keys. Props such as `orientation` and `loopFocus` change the keys of some components.

## Focus management

The components move the focus after an interaction. For example, an open dialog moves the focus into its popup. When the dialog closes, it gives the focus back to its trigger, else to the element that had the focus before. The props `initialFocus` and `finalFocus` of a popup part, such as `Dialog.Popup`, change these targets.

Give each element that can get the focus a visible focus style, as [WCAG 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) requires. Use the `:focus-visible` pseudo-class: it matches when the browser shows a focus indicator, such as after a key press.

## Color contrast

Give text and the parts of each control enough contrast with their background. [WCAG 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) gives the ratio for text. [WCAG 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) gives it for the borders and the states of a control.

## Accessible labels

`Field` connects each form control to its label, its description and its error. `Fieldset` connects a group of controls to its legend. The [forms guide](/handbook/forms#naming-form-controls) shows how. A native `<label>` also names an input.

A control with no visible label needs a name from `aria-label` or `aria-labelledby`. An icon button is an example. An image that gives information needs `alt` text. The [accessible name computation](https://www.w3.org/TR/accname-1.2/) gives the rules.

## Testing

Each component has tests in Chromium, Firefox and WebKit. Also test your app with a keyboard and with a screen reader.

### Automated checks

An open popup that can hold the focus, such as a Dialog, a Menu, a Popover or a Select, has a focus sentinel before and after the content of its portal. A toast viewport has the same sentinels after <kbd>F6</kbd> moves the focus into it. A sentinel is a `<span>` with `tabindex="0"` and `aria-hidden="true"`. When a sentinel gets the focus, the component moves the focus at once. The sentinels keep the Tab order correct between the page and that content.

[axe-core](https://github.com/dequelabs/axe-core) reports each sentinel under the rule `aria-hidden-focus`. The report is a false positive: [ACT rule 6cfa84](https://www.w3.org/WAI/standards-guidelines/act/rules/6cfa84/) passes a sentinel that moves the focus. Base UI and Floating UI render the same sentinels ([base-ui#5237](https://github.com/mui/base-ui/issues/5237), [floating-ui#2758](https://github.com/floating-ui/floating-ui/issues/2758)).

An open Context Menu gives `aria-hidden="true"` to the rest of the page. A Dialog or a Drawer with `modal` set to `'trap-focus'` does the same. So does a Popover with `modal` set to `'trap-focus'` and a `Popover.Close`. axe-core then reports each control of the page under the same rule. No control of the page can get the focus while the popup is open: a `'trap-focus'` popup keeps the focus, and a Context Menu closes when the focus leaves it.

Check the page while no popup is open. To check an open popup, turn off the rule `aria-hidden-focus` for that check only:

::: code-group

```ts [axe-core]
await axe.run(document, { rules: { 'aria-hidden-focus': { enabled: false } } });
```

```ts [@axe-core/playwright]
await new AxeBuilder({ page }).disableRules('aria-hidden-focus').analyze();
```

:::
