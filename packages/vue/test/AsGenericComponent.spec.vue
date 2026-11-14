<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Fieldset from '../src/fieldset/index.parts';
import * as Menu from '../src/menu/index.parts';
import { RadioGroup } from '../src/radio-group';
import * as Select from '../src/select/index.parts';
import { ToggleGroup } from '../src/toggle-group';
import * as Toolbar from '../src/toolbar/index.parts';
</script>

<template>
  <Toolbar.Button :as="Select.Trigger" />
  <Toolbar.Button :as="Menu.Trigger" />
  <Toolbar.Group :as="ToggleGroup" />
  <Fieldset.Root :as="RadioGroup" />
</template>
