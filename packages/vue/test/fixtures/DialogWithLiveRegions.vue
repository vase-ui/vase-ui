<script setup lang="ts">
import { Autocomplete } from '../../src/autocomplete';
import { Dialog } from '../../src/dialog';
import { Toast } from '../../src/toast';

// `position: relative; z-index: 1` puts the popup above the fixed element of the dialog.
defineProps({ inPlace: Boolean });
</script>

<template>
  <p data-testid="text">Text</p>
  <div><div data-testid="page-live" aria-live="polite"></div></div>
  <div data-testid="page-alert" role="alert"></div>
  <Toast.Provider>
    <Dialog.Root default-open>
      <Dialog.Portal>
        <Dialog.Viewport>
          <button data-testid="beside">Beside</button>
          <Dialog.Popup
            data-testid="popup"
            aria-label="Dialog"
            style="position: relative; z-index: 1"
          >
            <div aria-live="polite"></div>
            <ul>
              <li><button data-testid="option">Option</button></li>
            </ul>
            <Toast.Viewport aria-label="Notifications" />
            <button data-testid="after-viewport">After</button>
            <Autocomplete.Root :items="['Apple', 'Banana']">
              <Autocomplete.Input data-testid="input" aria-label="Fruit" />
              <Autocomplete.Portal :disabled="inPlace">
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.Empty>No fruit</Autocomplete.Empty>
                    <Autocomplete.List>
                      <template #item="{ item }">
                        <Autocomplete.Item :value="item" :data-testid="`item-${item}`">
                          {{ item }}
                        </Autocomplete.Item>
                      </template>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  </Toast.Provider>
</template>
