<script setup lang="ts">
import { Menu } from '../../src/menu';

// Two open menus where each part that renders an element renders it in its `element` slot. Each
// part has the class `part`, which reaches the element of the slot through `props`.
</script>

<template>
  <Menu.Root default-open>
    <Menu.Trigger class="part">
      <template #element="{ props, elementRef }">
        <button v-bind="props" :ref="elementRef">Menu</button>
      </template>
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Backdrop class="part">
        <template #element="{ props, elementRef }"
          ><div v-bind="props" :ref="elementRef"
        /></template>
      </Menu.Backdrop>
      <Menu.Positioner class="part">
        <template #element="{ props, elementRef }">
          <div v-bind="props" :ref="elementRef">
            <Menu.Popup class="part">
              <template #element="{ props: popup, elementRef: popupRef }">
                <div v-bind="popup" :ref="popupRef">
                  <Menu.Arrow class="part">
                    <template #element="{ props: arrow, elementRef: arrowRef }">
                      <div v-bind="arrow" :ref="arrowRef" />
                    </template>
                  </Menu.Arrow>
                  <Menu.Viewport class="part">
                    <template #element="{ props: viewport, elementRef: viewportRef }">
                      <div v-bind="viewport" :ref="viewportRef">
                        <Menu.List class="part">
                          <template #element="{ props: list, elementRef: listRef }">
                            <div v-bind="list" :ref="listRef">
                              <Menu.Item class="part">
                                <template #element="{ props: item, elementRef: itemRef }">
                                  <div v-bind="item" :ref="itemRef">Item</div>
                                </template>
                              </Menu.Item>
                              <Menu.LinkItem class="part" href="#link">
                                <template #element="{ props: link, elementRef: linkRef }">
                                  <a v-bind="link" :ref="linkRef">Link</a>
                                </template>
                              </Menu.LinkItem>
                              <Menu.CheckboxItem class="part">
                                <template #element="{ props: check, elementRef: checkRef }">
                                  <div v-bind="check" :ref="checkRef">Check</div>
                                </template>
                              </Menu.CheckboxItem>
                              <Menu.RadioGroup class="part">
                                <template #element="{ props: group, elementRef: groupRef }">
                                  <div v-bind="group" :ref="groupRef">
                                    <Menu.RadioItem class="part" value="a">
                                      <template #element="{ props: radio, elementRef: radioRef }">
                                        <div v-bind="radio" :ref="radioRef">A</div>
                                      </template>
                                    </Menu.RadioItem>
                                  </div>
                                </template>
                              </Menu.RadioGroup>
                              <Menu.Group class="part">
                                <template #element="{ props: group, elementRef: groupRef }">
                                  <div v-bind="group" :ref="groupRef">
                                    <Menu.GroupLabel class="part">
                                      <template #element="{ props: label, elementRef: labelRef }">
                                        <div v-bind="label" :ref="labelRef">Group</div>
                                      </template>
                                    </Menu.GroupLabel>
                                  </div>
                                </template>
                              </Menu.Group>
                              <Menu.SubmenuRoot>
                                <Menu.SubmenuTrigger class="part">
                                  <template #element="{ props: sub, elementRef: subRef }">
                                    <div v-bind="sub" :ref="subRef">More</div>
                                  </template>
                                </Menu.SubmenuTrigger>
                              </Menu.SubmenuRoot>
                            </div>
                          </template>
                        </Menu.List>
                      </div>
                    </template>
                  </Menu.Viewport>
                </div>
              </template>
            </Menu.Popup>
          </div>
        </template>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <Menu.FilterProvider default-value="zz">
    <Menu.Root default-open>
      <Menu.Trigger>Filter</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Input class="part" aria-label="Filter">
              <template #element="{ props, elementRef }">
                <input v-bind="props" :ref="elementRef" />
              </template>
            </Menu.Input>
            <Menu.Clear class="part">
              <template #element="{ props, elementRef }">
                <button v-bind="props" :ref="elementRef">Clear</button>
              </template>
            </Menu.Clear>
            <Menu.List>
              <Menu.Item>Apple</Menu.Item>
            </Menu.List>
            <Menu.Empty class="part">
              <template #element="{ props, elementRef }">
                <div v-bind="props" :ref="elementRef">No match</div>
              </template>
            </Menu.Empty>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menu.FilterProvider>
</template>
