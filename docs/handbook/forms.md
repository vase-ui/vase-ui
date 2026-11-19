---
order: 5
description: A guide to building forms with Vase UI components.
---

<script setup lang="ts">
import DemoFrame from '../.vitepress/components/DemoFrame.vue';
import DemoFormsHero from '../demos/handbook-forms/hero/tailwind/index.vue';
import DemoTanstackForm from '../demos/handbook-forms/tanstack-form/tailwind/index.vue';
import DemoVeeValidate from '../demos/handbook-forms/vee-validate/tailwind/index.vue';
</script>

# Forms

A guide to building forms with Vase UI components.

Vase UI form control components extend the native [constraint validation API](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#the-constraint-validation-api). You can build forms that collect user input or give control over an interface. The components also work with form libraries such as [VeeValidate](#veevalidate) and [TanStack Form](#tanstack-form).

The demos on this page use Tailwind CSS, and the files in `components` give each part its classes. The VeeValidate and TanStack Form demos use the same files.

<DemoFrame>
  <template #tailwind>
    <DemoFormsHero />
  </template>
</DemoFrame>

::: code-group

<<< ../demos/handbook-forms/hero/tailwind/index.vue

<<< ../demos/handbook-forms/hero/tailwind/ExampleForm.vue

<<< ../demos/handbook-forms/components/autocomplete.ts

<<< ../demos/handbook-forms/components/button.ts

<<< ../demos/handbook-forms/components/checkbox-group.ts

<<< ../demos/handbook-forms/components/checkbox.ts

<<< ../demos/handbook-forms/components/combobox.ts

<<< ../demos/handbook-forms/components/field.ts

<<< ../demos/handbook-forms/components/fieldset.ts

<<< ../demos/handbook-forms/components/form.ts

<<< ../demos/handbook-forms/components/number-field.ts

<<< ../demos/handbook-forms/components/radio-group.ts

<<< ../demos/handbook-forms/components/radio.ts

<<< ../demos/handbook-forms/components/select.ts

<<< ../demos/handbook-forms/components/slider.ts

<<< ../demos/handbook-forms/components/switch.ts

<<< ../demos/handbook-forms/components/toast.ts

<<< ../demos/handbook-forms/components/withProps.ts

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

To label a group of controls, put the group in `<Fieldset.Root>`, and its label in `<Fieldset.Legend>`. The legend names the fieldset, and also a group in it that nothing else names. Examples are a range slider with more than one thumb and a section that combines several inputs:

<<< ../examples/forms/RangeInFieldset.vue{11-13}

Put a checkbox group or a radio group in `Fieldset.Root`. Wrap each option in `<Field.Item>`. Each control then has its own label and description:

<<< ../components/radio-group/FieldsetLegend.vue{11,15,19}

<<< ../components/checkbox-group/FieldsetLegend.vue{11,15,20}

## Building form fields

Give `name` to `<Field.Root>` to include the value of the control that it wraps when a parent form is submitted:

<<< ../examples/forms/FieldName.vue{9}

## Submitting data

`Form` emits `submit` only when each field is valid. The first argument is the native `SubmitEvent`. While `Form` has a `submit` listener, it prevents the native submit, so the page stays. Send the `FormData` of the form in the listener:

<<< ../examples/forms/NativeSubmit.vue{7,8,17}

The second argument has the values of the named fields of the form as an object. Each value has the type that its control gives:

<<< ../examples/forms/FormSubmit.vue{4-9,17}

## Constraint validation

Vase UI form components support the native HTML validation attributes for many validation rules:

- `required` specifies a required field.
- `minlength` and `maxlength` specify a valid length for text fields.
- `pattern` specifies a regular expression that the value of the field must match.
- `step` specifies an increment that the values of a numeric field must be an integral multiple of.

<<< ../examples/forms/ConstraintValidation.vue{8}

A form component such as `Select` or `NumberField` uses a hidden input to take part in native form submission and validation. `Input`, `Checkbox`, `Radio` and `Switch` are native inputs, so the browser places their messages. A hidden input that has a `name` is `position: absolute`. To place it near its control, give the component, or its `Field.Root`, a `name`. Then wrap the component in a container with `position: relative`. The native validation message then points at the control. A hidden input with no `name` is `position: fixed` at the top left of the viewport.

`Select.Root` renders its hidden input after its children. Put the container around `Select.Root`, not only around `Select.Trigger`:

<<< ../examples/forms/PositionedInput.vue{7,8}

## Custom validation

You can add custom validation logic with a synchronous or an asynchronous function in the `validate` prop. It runs after the native validations pass.

Use the `validationMode` prop to set when the validation runs:

- `submit` (default) validates the fields when the parent `<Form>` is submitted. Afterward, the fields validate again when their value changes.
- `blur` validates the field when the focus moves away.
- `change` validates the field when its value changes. A key press in a text field is an example. So is a click on a checkbox.

`validationDebounceTime` sets, in milliseconds, how long to wait between `validate` calls in `change` mode. Use it for asynchronous requests and for text fields that validate on change.

`validate` gets the value of the field and the values of its form. An asynchronous `validate` function does not stop the submission of a form in `submit` mode.

<<< ../examples/forms/CustomValidation.vue{24-26}

## Server-side validation

Bind the errors that a server returns after a submission with `v-model:errors` of `Form`. The form gives them to each field for display.

`errors` is an object. Its keys are field names, and each value is an error string or an array of error strings. An edit of a field asks to remove the key of that field with `update:errors`.

<<< ../examples/forms/ServerErrors.vue{15,19,24}

A demo on the [Form page](/components/form#submit-to-a-server) shows the errors of a server after a submission.

## Displaying errors

Use `<Field.Error>` with no content to show the native error message of the field while it is invalid. The `match` prop customizes the message for a validity state, so that you can manage internationalization in your application:

<<< ../examples/forms/ErrorMatch.vue{9}

## VeeValidate

[VeeValidate](https://vee-validate.logaretm.com/v4/) is a form library for Vue. You can integrate it with Vase UI to manage the form state and the field state outside the components.

<DemoFrame>
  <template #tailwind>
    <DemoVeeValidate />
  </template>
</DemoFrame>

::: code-group

<<< ../demos/handbook-forms/vee-validate/tailwind/index.vue

<<< ../demos/handbook-forms/vee-validate/tailwind/VeeValidateForm.vue

:::

### Initialize the form

Initialize the form with the `useForm` function. Give the initial value of each field, by its name, in `initialValues`:

<<< ../examples/forms/VeeValidateInit.vue{10-13}

### Integrate components

Put the `<Field>` component of VeeValidate around `<Field.Root>`. Its default slot gives the state of the field. Give the slot props to these parts:

- `componentField.name` goes to the `name` prop of `<Field.Root>`.
- `errorMessage` is the text of `<Field.Error>`. `!!errorMessage` goes to `invalid` of `<Field.Root>`, and the error then shows.
- `meta.touched` and `meta.dirty` go to `touched` and `dirty` of `<Field.Root>`.
- Bind `componentField.modelValue` to `<Input>`. Use `componentField['onUpdate:modelValue']` for its model update and `componentField.onBlur` for blur. VeeValidate then receives each accepted edit once.

<<< ../examples/forms/VeeValidateField.vue{10,12-15,23-25}

For a composite control, pass `value` to `modelValue` and `handleChange` to `update:modelValue`. Attach `handleBlur` to the part that takes focus.

### Field validation

Give `<Field>` a `rules` function. It returns `true` when the value is valid, or an error message. Give `!!errorMessage` to `invalid` of `<Field.Root>` to show the message:

<<< ../examples/forms/VeeValidateRules.vue{8-16,23,33-35,37}

VeeValidate gives the function a value of the type `unknown`. Check the type in the function.

### Submitting data

Wrap your submit function with `handleSubmit`. It validates the form. When the form is valid, it calls your function with the values as an object. Bind the result to the `submit` event of a native `<form>`.

`handleSubmit` takes a second function. VeeValidate calls it when the form is not valid, with the errors by field name. The names are in the sequence in which the fields mount. Find the element of the form that has the first name. Move the focus to that element:

<<< ../examples/forms/VeeValidateSubmit.vue{17,19-22,26}

Where a part has a hidden input, as `Select` and `NumberField` have, that input has the name. It gives the focus to the control of the part.

Do not use `Form` here. A field that shows an error stops the `submit` event of `Form`. `handleSubmit` then does not run, and VeeValidate does not show the errors of the other fields. Add `novalidate`, as `Form` does, so that the browser shows no message of its own.

## TanStack Form

[TanStack Form](https://tanstack.com/form/latest/docs/framework/vue/quick-start) is a form library with a function-based API for validation. It also works with Vase UI.

<DemoFrame>
  <template #tailwind>
    <DemoTanstackForm />
  </template>
</DemoFrame>

::: code-group

<<< ../demos/handbook-forms/tanstack-form/tailwind/index.vue

<<< ../demos/handbook-forms/tanstack-form/tailwind/TanstackForm.vue

:::

### Initialize the form

Create a form instance with the `useForm` function. Give the initial value of each field, by its name, in `defaultValues`:

<<< ../examples/forms/TanstackInit.vue#init{11-13 ts}

### Integrate components

Use the `<form.Field>` component of the form instance. Its default slot gives `field`. Give its members to these parts:

- `field.name` goes to the `name` prop of `<Field.Root>`.
- `field.state.meta.isValid`, `isDirty` and `isTouched` go to `invalid`, `dirty` and `touched` of `<Field.Root>`. `invalid` takes the opposite of `isValid`.
- `field.state.value`, `field.handleChange` and `field.handleBlur` go to the `modelValue` prop, the `valueChange` event and the `blur` event of the control.

<<< ../examples/forms/TanstackField.vue{11-17,20,22,23,25}

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
3. Give a function to `onSubmitInvalid` in `useForm`. TanStack Form calls it when the form is not valid. Vase UI gives `aria-invalid="true"` to the control of a field that is invalid. Find the first such element in the form. Move the focus to that element.

<<< ../examples/forms/TanstackSubmit.vue{5,9-17,22,24}
