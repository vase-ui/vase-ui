<script setup lang="ts">
import {
  Label,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui';
import { options } from '../../harness/options.ts';
</script>

<template>
  <Label>
    Label
    <SelectRoot>
      <SelectTrigger data-bench="trigger">
        <SelectValue />
      </SelectTrigger>
      <SelectPortal>
        <SelectContent data-bench="popup">
          <SelectViewport>
            <SelectItem v-for="option in options" :key="option" :value="option">
              <SelectItemText>{{ option }}</SelectItemText>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </Label>
</template>
