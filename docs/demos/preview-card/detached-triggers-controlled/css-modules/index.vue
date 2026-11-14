<script setup lang="ts">
import { shallowRef } from 'vue';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import styles from '../../index.module.css';

type CardContent = 'typography' | 'design' | 'art';

const demoPreviewCard = PreviewCard.createHandle<CardContent>();

const open = shallowRef(false);
const triggerId = shallowRef<string | null>(null);

function handleOpenChange(isOpen: boolean, eventDetails: PreviewCard.Root.ChangeEventDetails) {
  open.value = isOpen;
  triggerId.value = eventDetails.trigger?.id ?? null;
}

function openProgrammatically() {
  triggerId.value = 'trigger-2';
  open.value = true;
}
</script>

<template>
  <div>
    <div :class="styles.Container">
      <p :class="styles.Paragraph">
        Discover
        <PreviewCard.Trigger
          id="trigger-1"
          :class="styles.Link"
          :handle="demoPreviewCard"
          href="https://en.wikipedia.org/wiki/Typography"
          payload="typography"
          >typography</PreviewCard.Trigger
        >,
        <PreviewCard.Trigger
          id="trigger-2"
          :class="styles.Link"
          :handle="demoPreviewCard"
          href="https://en.wikipedia.org/wiki/Industrial_design"
          payload="design"
          >design</PreviewCard.Trigger
        >, or
        <PreviewCard.Trigger
          id="trigger-3"
          :class="styles.Link"
          :handle="demoPreviewCard"
          href="https://en.wikipedia.org/wiki/Art"
          payload="art"
          >art</PreviewCard.Trigger
        >.
      </p>
      <button type="button" :class="styles.Button" @click="openProgrammatically">
        Open programmatically
      </button>
    </div>

    <PreviewCard.Root
      :handle="demoPreviewCard"
      :open="open"
      :trigger-id="triggerId"
      @open-change="handleOpenChange"
    >
      <template #default="{ payload }">
        <PreviewCard.Portal>
          <PreviewCard.Positioner :side-offset="8" :class="styles.Positioner">
            <PreviewCard.Popup :class="styles.Popup">
              <PreviewCard.Arrow :class="styles.Arrow" />
              <div v-if="payload === 'typography'" :class="styles.PopupContent">
                <img
                  width="224"
                  height="150"
                  :class="styles.Image"
                  src="https://images.unsplash.com/photo-1619615391095-dfa29e1672ef?q=80&w=448&h=300"
                  alt="Station Hofplein signage in Rotterdam, Netherlands"
                />
                <p :class="styles.Summary">
                  <strong>Typography</strong> is the art and science of arranging type.
                </p>
              </div>
              <div v-else-if="payload === 'design'" :class="styles.PopupContent">
                <img
                  width="241"
                  height="240"
                  :class="styles.Image"
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Braun_ABW30_%28schwarz%29.jpg/250px-Braun_ABW30_%28schwarz%29.jpg"
                  alt="Braun ABW30"
                />
                <p :class="styles.Summary">
                  A <strong>design</strong> is the concept or proposal for an object, process, or
                  system.
                </p>
              </div>
              <div v-else-if="payload === 'art'" :class="styles.PopupContent">
                <img
                  width="206"
                  height="240"
                  :class="styles.Image"
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/MonaLisa_sfumato.jpeg/250px-MonaLisa_sfumato.jpeg"
                  alt="Mona Lisa"
                />
                <p :class="styles.Summary">
                  <strong>Art</strong> is a diverse range of cultural activity centered around works
                  utilizing creative or imaginative talents, which are expected to evoke a
                  worthwhile experience, generally through an expression of emotional power,
                  conceptual ideas, technical proficiency, or beauty.
                </p>
              </div>
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </template>
    </PreviewCard.Root>
  </div>
</template>
