---
order: 5
description: A guide to building forms with Vase UI components.
---

<script setup lang="ts">
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoFormsHero from '../examples/forms/demos/hero/index.vue';
</script>

# Forms

A guide to building forms with Vase UI components.

Vase UI form control components extend the native [constraint validation API](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#the-constraint-validation-api). You can build forms that collect user input or give control over an interface.

<DemoFrame>
  <DemoFormsHero />
</DemoFrame>

::: code-group

<<< ../examples/forms/demos/hero/index.vue

<<< ../examples/forms/demos/hero/ExampleForm.vue

<<< ../examples/forms/demos/hero/ToastList.vue

:::

## Naming form controls

A form control must have an accessible name, so that assistive technologies can recognize it. Use the label strategy below for each type of control.

### Input controls

Use `<Field.Label>` or a native `<label>` to label these controls:

- `Input`
- `NumberField`
- `OTPField`
- `Checkbox`
- `Radio`
- `Switch`

You can label `Checkbox`, `Radio` and `Switch` implicitly. Put them inside `<Field.Label>`:

<<< ../examples/forms/ImplicitLabel.vue{8-11}

### Trigger-based controls

Use `<Slider.Label>` to label `Slider`. For a slider with more than one thumb, also give each `<Slider.Thumb>` an `aria-label`, to tell the thumbs apart. See [Labeling a slider](/components/slider#labeling-a-slider).

### Fallback

If no visible label is rendered, give `aria-label` to the part that is the form control.

### Describing the control

`<Field.Description>` gives the control an accessible description automatically:

<<< ../examples/forms/DescribeControl.vue{12}

### Labeling control groups

To label a group of controls, compose `<Fieldset.Root>` with the group. A range slider with more than one thumb is an example. Render the group in the `#render` slot of `Fieldset.Root`. Keep the group label in `<Fieldset.Legend>`:

<<< ../examples/forms/RangeInFieldset.vue{11-14,17-18}

For a checkbox group and a radio group, wrap each option in `<Field.Item>`. Each control then has its own label and description:

<<< ../components/radio-group/FieldsetLegend.vue{10-13}

<<< ../components/checkbox-group/FieldsetLegend.vue{10-13}

## Building form fields

Give `name` to `<Field.Root>` to include the value of the control that it wraps when a parent form is submitted:

<<< ../examples/forms/FieldName.vue{9}

## Submitting data

You can take over the submission with the native `submit` event or with the `formSubmit` event of Vase UI.

`Form` emits `submit` only when each field is valid. It does not prevent the default action of the event, so call `event.preventDefault()` yourself:

<<< ../examples/forms/NativeSubmit.vue{8-12}

When a `formSubmit` listener exists, `Form` gives it the values of the named fields as an object, with `eventDetails` as the second argument. `Form` also calls `preventDefault()` on the native submit event:

<<< ../examples/forms/FormSubmit.vue{4-9,17}

## Constraint validation

Vase UI form components support the native HTML validation attributes for many validation rules:

- `required` specifies a required field.
- `minlength` and `maxlength` specify a valid length for text fields.
- `pattern` specifies a regular expression that the value of the field must match.
- `step` specifies an increment that the values of a numeric field must be an integral multiple of.

<<< ../examples/forms/ConstraintValidation.vue{7}

Vase UI form components use a hidden input to take part in native form submission and validation. A hidden input that has a `name` is `position: absolute`. To place it near its control, give the component a `name`. Then wrap the control in a container with `position: relative`. The native validation message then points at the control. A hidden input with no `name` is `position: fixed` at the top left of the viewport.

<<< ../examples/forms/PositionedInput.vue{7,8}

## Custom validation

You can add custom validation logic with a synchronous or an asynchronous function in the `validate` prop. It runs after the native validations pass.

Use the `validationMode` prop to set when the validation runs:

- `onSubmit` (default) validates the fields when the parent `<Form>` is submitted. Afterward, the fields validate again when their value changes.
- `onBlur` validates the field when the focus moves away.
- `onChange` validates the field when its value changes. A key press in a text field is an example. So is a click on a checkbox.

`validationDebounceTime` sets, in milliseconds, how long to wait between `validate` calls in `onChange` mode. Use it for asynchronous requests and for text fields that validate on change.

An asynchronous `validate` function does not stop the submission of a form in `onSubmit` mode.

<<< ../examples/forms/CustomValidation.vue{24-26}

## Server-side validation

You can give the errors that a server returns after a submission to the `errors` prop of `Form`. The form merges them into the state of each field for display.

`errors` is an object. Its keys are field names, and each value is an error string or an array of error strings. When the value of a field changes, the form clears the error of that field.

<<< ../examples/forms/ServerErrors.vue{14,18,23}

After a change of a field clears its error, a write of an equal error value shows no error again, because Vue reports no change. Give a new object, or change a value.

## Displaying errors

Use `<Field.Error>` with no content to show the native error message of the field while it is invalid. The `match` prop customizes the message for a validity state, so that you can manage internationalization in your application:

<<< ../examples/forms/ErrorMatch.vue{8}
