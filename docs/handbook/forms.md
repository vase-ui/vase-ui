---
order: 5
description: A guide to building forms with Vase UI components.
---

<script setup lang="ts">
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoFormsHero from '../demos/handbook-forms/hero/css-modules/index.vue';
import DemoTanstackForm from '../demos/handbook-forms/tanstack-form/css-modules/index.vue';
import DemoVeeValidate from '../demos/handbook-forms/vee-validate/css-modules/index.vue';
</script>

# Forms

A guide to building forms with Vase UI components.

Vase UI form control components extend the native [constraint validation API](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#the-constraint-validation-api). You can build forms that collect user input or give control over an interface. The components also work with form libraries such as [VeeValidate](#veevalidate) and [TanStack Form](#tanstack-form).

<DemoFrame>
  <DemoFormsHero />
</DemoFrame>

::: code-group

<<< ../demos/handbook-forms/hero/css-modules/index.vue

<<< ../demos/handbook-forms/hero/css-modules/ExampleForm.vue

<<< ../demos/handbook-forms/components/ToastProvider.vue

<<< ../examples/forms/layout.module.css

:::

## Naming form controls

A form control must have an accessible name, so that assistive technologies can recognize it. Use the label strategy below for each type of control.

### Input controls

Use `<Field.Label>` or a native `<label>` to label these controls:

- `Input`
- `NumberField`
- `OTPField`
- `Autocomplete`
- `Combobox` (input outside the popup)
- `Checkbox`
- `Radio`
- `Switch`

You can label `Checkbox`, `Radio` and `Switch` implicitly. Put them inside `<Field.Label>`:

<<< ../examples/forms/ImplicitLabel.vue{8-11}

### Trigger-based controls

- `Combobox` (input inside the popup): use `<Combobox.Label>`. See [Input inside popup](/components/combobox#input-inside-popup).
- `Select`: use `<Select.Label>`. See [Labeling a select](/components/select#labeling-a-select).
- `Slider`: use `<Slider.Label>`. For a slider with more than one thumb, also give each `<Slider.Thumb>` an `aria-label`, to tell the thumbs apart. See [Labeling a slider](/components/slider#labeling-a-slider).

### Fallback

If no visible label is rendered, give `aria-label` to the part that is the form control.

### Describing the control

`<Field.Description>` gives the control an accessible description automatically:

<<< ../examples/forms/DescribeControl.vue{15,21}

### Labeling control groups

To label a group of controls, compose `<Fieldset.Root>` with the group. A range slider with more than one thumb is an example. Render the group in the `#render` slot of `Fieldset.Root`. Keep the group label in `<Fieldset.Legend>`:

<<< ../examples/forms/RangeInFieldset.vue{11-14,17-18}

For a checkbox group and a radio group, wrap each option in `<Field.Item>`. Each control then has its own label and description:

<<< ../components/radio-group/FieldsetLegend.vue{14,19-20,25}

<<< ../components/checkbox-group/FieldsetLegend.vue{14,19-20,25}

## Building form fields

Give `name` to `<Field.Root>` to include the value of the control that it wraps when a parent form is submitted:

<<< ../examples/forms/FieldName.vue{9}

## Submitting data

You can take over the submission with the native `submit` event or with the `formSubmit` event of Vase UI.

`Form` emits `submit` only when each field is valid. It does not prevent the default action of the event, so call `event.preventDefault()` yourself:

<<< ../examples/forms/NativeSubmit.vue{7-10,19}

When a `formSubmit` listener exists, `Form` gives it the values of the named fields as an object, with `eventDetails` as the second argument. `Form` also calls `preventDefault()` on the native submit event:

<<< ../examples/forms/FormSubmit.vue{4-9,17}

## Constraint validation

Vase UI form components support the native HTML validation attributes for many validation rules:

- `required` specifies a required field.
- `minlength` and `maxlength` specify a valid length for text fields.
- `pattern` specifies a regular expression that the value of the field must match.
- `step` specifies an increment that the values of a numeric field must be an integral multiple of.

<<< ../examples/forms/ConstraintValidation.vue{7}

A form component such as `Select`, `Switch` or `Checkbox` uses a hidden input to take part in native form submission and validation. A hidden input that has a `name` is `position: absolute`. To place it near its control, give the component, or its `Field.Root`, a `name`. Then wrap the component in a container with `position: relative`. The native validation message then points at the control. A hidden input with no `name` is `position: fixed` at the top left of the viewport.

`Select.Root` renders its hidden input after its children. Put the container around `Select.Root`, not only around `Select.Trigger`:

<<< ../examples/forms/PositionedInput.vue{7,8}

## Custom validation

You can add custom validation logic with a synchronous or an asynchronous function in the `validate` prop. It runs after the native validations pass.

Use the `validationMode` prop to set when the validation runs:

- `onSubmit` (default) validates the fields when the parent `<Form>` is submitted. Afterward, the fields validate again when their value changes.
- `onBlur` validates the field when the focus moves away.
- `onChange` validates the field when its value changes. A key press in a text field is an example. So is a click on a checkbox.

`validationDebounceTime` sets, in milliseconds, how long to wait between `validate` calls in `onChange` mode. Use it for asynchronous requests and for text fields that validate on change.

An asynchronous `validate` function does not stop the submission of a form in `onSubmit` mode.

<<< ../examples/forms/CustomValidation.vue{23-25}

## Server-side validation

You can give the errors that a server returns after a submission to the `errors` prop of `Form`. The form merges them into the state of each field for display.

`errors` is an object. Its keys are field names, and each value is an error string or an array of error strings. When the value of a field changes, the form clears the error of that field.

<<< ../examples/forms/ServerErrors.vue{14,18,23}

After a change of a field clears its error, a write of an equal error value shows no error again, because Vue reports no change. Give a new object, or change a value.

## Displaying errors

Use `<Field.Error>` with no content to show the native error message of the field while it is invalid. The `match` prop customizes the message for a validity state, so that you can manage internationalization in your application:

<<< ../examples/forms/ErrorMatch.vue{8}

## VeeValidate

[VeeValidate](https://vee-validate.logaretm.com/v4/) is a form library for Vue. You can integrate it with Vase UI to manage the form state and the field state outside the components.

<DemoFrame>
  <DemoVeeValidate />
</DemoFrame>

::: code-group

<<< ../demos/handbook-forms/vee-validate/css-modules/index.vue

<<< ../demos/handbook-forms/vee-validate/css-modules/VeeValidateForm.vue

:::

### Initialize the form

Initialize the form with the `useForm` function. Give the initial value of each field, by its name, in `initialValues`:

<<< ../examples/forms/VeeValidateInit.vue{10-13}

### Integrate components

Put the `<Field>` component of VeeValidate around `<Field.Root>`. Its default slot gives the state of the field. Give each slot prop to the matching part:

- `field.name` goes to the `name` prop of `<Field.Root>`.
- `errorMessage` is the text of `<Field.Error>`. `!!errorMessage` goes to `invalid` of `<Field.Root>` and to `match` of `<Field.Error>`.
- `meta.touched` and `meta.dirty` go to `touched` and `dirty` of `<Field.Root>`.
- `value`, `handleChange` and `handleBlur` go to the `value` prop, the `update:value` event and the `blur` event of the control.

<<< ../examples/forms/VeeValidateField.vue{9,11-14,22-24,26}

Listen to `update:value`, not to `valueChange`. `valueChange` gives `eventDetails` as a second argument, and `handleChange` takes a Boolean there.

### Field validation

Give `<Field>` a `rules` function. It returns `true` when the value is valid, or an error message. Use the `match` prop of `<Field.Error>` to show the message:

<<< ../examples/forms/VeeValidateRules.vue{7-15,22,32}

VeeValidate gives the function a value of the type `unknown`. Check the type in the function.

### Submitting data

Wrap your submit function with `handleSubmit`. It validates the form, and then calls your function with the values as an object. Bind the result to the `submit` event of a native `<form>`:

<<< ../examples/forms/VeeValidateSubmit.vue{16,20}

Do not use `Form` here. A field that shows an error stops the `submit` event of `Form`. `handleSubmit` then does not run, and VeeValidate does not show the errors of the other fields. Add `novalidate`, as `Form` does, so that the browser shows no message of its own.

## TanStack Form

[TanStack Form](https://tanstack.com/form/latest/docs/framework/vue/quick-start) is a form library with a function-based API for orchestrating validations. It also works with Vase UI.

<DemoFrame>
  <DemoTanstackForm />
</DemoFrame>

::: code-group

<<< ../demos/handbook-forms/tanstack-form/css-modules/index.vue

<<< ../demos/handbook-forms/tanstack-form/css-modules/TanstackForm.vue

:::

### Initialize the form

Create a form instance with the `useForm` function. Give the initial value of each field, by its name, in `defaultValues`:

<<< ../examples/forms/TanstackInit.vue#init{11-13 ts}

### Integrate components

Use the `<form.Field>` component of the form instance. Its default slot gives `field`. Give its members to the matching parts:

- `field.name` goes to the `name` prop of `<Field.Root>`.
- `field.state.meta.isValid`, `isDirty` and `isTouched` go to `invalid`, `dirty` and `touched` of `<Field.Root>`. `invalid` takes the opposite of `isValid`.
- `field.state.value`, `field.handleChange` and `field.handleBlur` go to the `value` prop, the `valueChange` event and the `blur` event of the control.

<<< ../examples/forms/TanstackField.vue{10-16,19,21,22,24}

The `Form` component of Vase UI is not needed with TanStack Form.

### Form validation

To validate like a native `<form>`:

1. Call `revalidateLogic`, and give the result to `validationLogic` in `useForm`.
2. Give a function to `validators.onDynamic` in `useForm`. It returns an object with the keys `form` and `fields`. Each key holds the errors by field name.

The form then validates all fields at the first submit. After that, it validates again each time that a value changes.

<<< ../examples/forms/TanstackValidation.vue{9-12,14,29}

### Field validation

Give `validators` to a `<form.Field>` to validate that field with a function of its own:

<<< ../examples/forms/TanstackFieldValidator.vue{7-10,15}

### Submitting data

To submit the form:

1. Give a submit function to `onSubmit` in `useForm`.
2. Call `form.handleSubmit()` from an event listener, such as `@submit.prevent` on the form or `@click` on a button.

<<< ../examples/forms/TanstackSubmit.vue{4-12,16}
