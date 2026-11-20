<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Toolbar } from '../../src/toolbar';

// With `as`, each part renders another tag. With `slots`, each part renders its element in the
// `element` slot, with its state as an attribute.
defineProps({
  scene: { type: Object as PropType<{ as?: boolean; slots?: boolean }>, required: true },
});
const root = useTemplateRef('root');
const group = useTemplateRef('group');
const button = useTemplateRef('button');
const link = useTemplateRef('link');
const input = useTemplateRef('input');
const separator = useTemplateRef('separator');
defineExpose({ root, group, button, link, input, separator });
</script>

<template>
  <Toolbar.Root v-if="scene.slots" ref="root" disabled orientation="vertical">
    <template #element="{ props, elementRef, state }">
      <nav class="Root" v-bind="props" :ref="elementRef" :data-state="JSON.stringify(state)">
        <Toolbar.Group ref="group">
          <template #element="{ props: groupProps, elementRef: groupRef, state: groupState }">
            <div
              class="Group"
              v-bind="groupProps"
              :ref="groupRef"
              :data-state="JSON.stringify(groupState)"
            >
              <Toolbar.Button ref="button">
                <template
                  #element="{ props: buttonProps, elementRef: buttonRef, state: buttonState }"
                >
                  <button
                    class="Button"
                    v-bind="buttonProps"
                    :ref="buttonRef"
                    :data-state="JSON.stringify(buttonState)"
                  />
                </template>
              </Toolbar.Button>
            </div>
          </template>
        </Toolbar.Group>
        <Toolbar.Link ref="link">
          <template #element="{ props: linkProps, elementRef: linkRef, state: linkState }">
            <a
              class="Link"
              href="#link"
              v-bind="linkProps"
              :ref="linkRef"
              :data-state="JSON.stringify(linkState)"
            />
          </template>
        </Toolbar.Link>
        <Toolbar.Input ref="input" :focusable-when-disabled="false">
          <template #element="{ props: inputProps, elementRef: inputRef, state: inputState }">
            <input
              class="Input"
              aria-label="Input"
              v-bind="inputProps"
              :ref="inputRef"
              :data-state="JSON.stringify(inputState)"
            />
          </template>
        </Toolbar.Input>
        <Toolbar.Separator ref="separator">
          <template
            #element="{ props: separatorProps, elementRef: separatorRef, state: separatorState }"
          >
            <hr
              class="Separator"
              v-bind="separatorProps"
              :ref="separatorRef"
              :data-state="JSON.stringify(separatorState)"
            />
          </template>
        </Toolbar.Separator>
      </nav>
    </template>
  </Toolbar.Root>
  <Toolbar.Root v-else ref="root" class="Root" as="section">
    <Toolbar.Group ref="group" class="Group" as="section">
      <Toolbar.Button ref="button" class="Button" as="span">Button</Toolbar.Button>
    </Toolbar.Group>
    <Toolbar.Link ref="link" class="Link" as="span">Link</Toolbar.Link>
    <Toolbar.Input ref="input" class="Input" aria-label="Input" />
    <Toolbar.Separator ref="separator" class="Separator" />
  </Toolbar.Root>
</template>
