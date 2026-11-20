<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Menu } from '../../src/menu';

type Props = Record<string, unknown>;
type Item = { key: string; text?: string; attrs?: Props };

// Each item has the `data-key` of its key, and its text, else the key as text. Text inputs stand
// before and after the root. The input after it and the outside button are at the bottom right of
// the view, so the popup under the trigger covers neither.
defineProps({
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
  backdrop: Object as PropType<Props>,
  arrow: Object as PropType<Props>,
  items: {
    type: Array as PropType<Item[]>,
    default: () => [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
  },
  /** A checkbox item after the items. */
  checkbox: Object as PropType<Props>,
  /** A radio group with three items after the items. */
  radio: Object as PropType<{ group?: Props; items?: Props }>,
  /** A link item after the items. */
  link: Object as PropType<Props>,
  /** A group with a label around the items. */
  group: Boolean,
  /** The items are in a `Menu.List`, after a text. */
  list: Object as PropType<Props>,
  /** A submenu after the items, with a submenu in it when `nested` is set. */
  submenu: Object as PropType<{
    root?: Props;
    trigger?: Props;
    portal?: Props;
    positioner?: Props;
    popup?: Props;
    items?: Item[];
    nested?: { root?: Props; trigger?: Props; items?: Item[] };
  }>,
  /** A second submenu after the first one. */
  sibling: Object as PropType<{ trigger?: Props; items?: Item[] }>,
  /** The root is in a disabled `<fieldset>`. */
  fieldset: Boolean,
});
const defaultItems = (prefix: string): Item[] => [{ key: `${prefix}1` }, { key: `${prefix}2` }];
const rootPart = useTemplateRef('rootPart');
const popupPart = useTemplateRef('popupPart');
const triggerPart = useTemplateRef('triggerPart');
defineExpose({ root: rootPart, popup: popupPart, trigger: triggerPart });
</script>

<template>
  <input id="before" aria-label="Before" />
  <fieldset v-if="fieldset" disabled>
    <Menu.Root v-bind="root">
      <Menu.Trigger data-testid="trigger" v-bind="trigger" v-slot="{ state }">
        {{ state.disabled }}
      </Menu.Trigger>
    </Menu.Root>
  </fieldset>
  <Menu.Root v-else ref="rootPart" v-bind="root">
    <Menu.Trigger ref="triggerPart" data-testid="trigger" v-bind="trigger">Menu</Menu.Trigger>
    <Menu.Portal v-bind="portal">
      <Menu.Backdrop v-if="backdrop" data-testid="backdrop" v-bind="backdrop" />
      <Menu.Positioner data-testid="positioner" v-bind="positioner">
        <Menu.Popup ref="popupPart" data-testid="popup" v-bind="popup">
          <Menu.Arrow v-if="arrow" data-testid="arrow" v-bind="arrow" />
          <span v-if="list">Text</span>
          <component :is="list ? Menu.List : 'div'" data-testid="list" v-bind="list">
            <component :is="group ? Menu.Group : 'div'" data-testid="group">
              <Menu.GroupLabel v-if="group" data-testid="group-label">Group</Menu.GroupLabel>
              <Menu.Item
                v-for="item in items"
                :key="item.key"
                :data-key="item.key"
                v-bind="item.attrs"
              >
                {{ item.text ?? item.key }}
              </Menu.Item>
            </component>
            <Menu.CheckboxItem v-if="checkbox" data-key="checkbox" v-bind="checkbox">
              <template #default="{ state }">Checkbox {{ state.checked }}</template>
            </Menu.CheckboxItem>
            <Menu.RadioGroup v-if="radio" data-testid="radio-group" v-bind="radio.group">
              <Menu.RadioItem
                v-for="value in ['r1', 'r2', 'r3']"
                :key="value"
                :data-key="value"
                :value="value"
                v-bind="radio.items"
              >
                <template #default="{ state }">{{ value }} {{ state.checked }}</template>
              </Menu.RadioItem>
            </Menu.RadioGroup>
            <Menu.LinkItem v-if="link" data-key="link" href="#link" v-bind="link">
              Link
            </Menu.LinkItem>
            <Menu.SubmenuRoot v-if="submenu" v-bind="submenu.root">
              <Menu.SubmenuTrigger data-key="sub" v-bind="submenu.trigger">More</Menu.SubmenuTrigger>
              <Menu.Portal v-bind="submenu.portal">
                <Menu.Positioner data-testid="sub-positioner" v-bind="submenu.positioner">
                  <Menu.Popup data-testid="sub-popup" v-bind="submenu.popup">
                    <Menu.Item
                      v-for="item in submenu.items ?? defaultItems('s')"
                      :key="item.key"
                      :data-key="item.key"
                      v-bind="item.attrs"
                    >
                      {{ item.text ?? item.key }}
                    </Menu.Item>
                    <Menu.SubmenuRoot v-if="submenu.nested" v-bind="submenu.nested.root">
                      <Menu.SubmenuTrigger data-key="deep" v-bind="submenu.nested.trigger">
                        Deep
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="deep-popup">
                            <Menu.Item
                              v-for="item in submenu.nested.items ?? defaultItems('d')"
                              :key="item.key"
                              :data-key="item.key"
                              v-bind="item.attrs"
                            >
                              {{ item.text ?? item.key }}
                            </Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
            <Menu.SubmenuRoot v-if="sibling">
              <Menu.SubmenuTrigger data-key="sibling" v-bind="sibling.trigger">
                Other
              </Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="sibling-popup">
                    <Menu.Item
                      v-for="item in sibling.items ?? [{ key: 'o1' }, { key: 'o2' }]"
                      :key="item.key"
                      :data-key="item.key"
                    >
                      {{ item.key }}
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </component>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <input id="after" aria-label="After" style="position: fixed; right: 0; bottom: 30px" />
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
