<script setup lang="ts">
import LabelableControl from '../../../test/fixtures/LabelableControl.vue';
import LabelableInput from '../../../test/fixtures/LabelableInput.vue';
import LabelableLabel from '../../../test/fixtures/LabelableLabel.vue';
import LabelableMessage from '../../../test/fixtures/LabelableMessage.vue';
import LabelableScope from '../../../test/fixtures/LabelableScope.vue';

type Part = 'label' | 'control' | 'input' | 'description' | 'error';

const props = withDefaults(
  defineProps<{
    parts: Part[];
    provider?: boolean | undefined;
    labelId?: string | undefined;
    labelShown?: boolean | undefined;
    ariaLabelledby?: string | undefined;
  }>(),
  { provider: true, labelShown: true },
);

// An attribute with the value `undefined` replaces the value of the part. So the control gets the
// attribute only when the prop has a value.
function names() {
  return props.ariaLabelledby === undefined ? {} : { 'aria-labelledby': props.ariaLabelledby };
}

// In the template, the control holds a message in a provider of its own. The message does not
// describe the control, and its id comes from the `useId` boundary of the control.
</script>

<template>
  <component :is="provider ? LabelableScope : 'div'">
    <template v-for="part in parts" :key="part">
      <LabelableLabel
        v-if="part === 'label' && labelShown"
        :id="labelId"
        :native="false"
        data-testid="label"
      >
        Label
      </LabelableLabel>
      <LabelableControl v-else-if="part === 'control'" v-bind="names()" data-testid="control">
        <LabelableScope>
          <LabelableMessage data-testid="inside">Inside</LabelableMessage>
        </LabelableScope>
      </LabelableControl>
      <LabelableInput v-else-if="part === 'input'" data-testid="control" />
      <LabelableMessage v-else-if="part === 'description'" data-testid="description">
        Description
      </LabelableMessage>
      <LabelableMessage v-else-if="part === 'error'" data-testid="error">Error</LabelableMessage>
    </template>
  </component>
</template>
