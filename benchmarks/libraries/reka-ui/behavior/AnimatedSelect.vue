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
import { options } from '../../../harness/options.ts';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Label>
      Label
      <SelectRoot default-value="Option 1">
        <SelectTrigger data-bench="trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectPortal>
          <Transition
            enter-active-class="bench-motion"
            leave-active-class="bench-motion"
            enter-from-class="bench-hidden"
            leave-to-class="bench-hidden"
          >
            <SelectContent data-bench="popup">
              <SelectViewport>
                <SelectItem v-for="option in options" :key="option" :value="option">
                  <SelectItemText>{{ option }}</SelectItemText>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </Transition>
        </SelectPortal>
      </SelectRoot>
    </Label>
  </div>
</template>
