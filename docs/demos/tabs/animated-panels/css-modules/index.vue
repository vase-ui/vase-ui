<script setup lang="ts">
import { Tabs } from '@vase-ui/vue/tabs';
import styles from './index.module.css';

const enterFromClass = styles.PanelEnterFrom;
const leaveToClass = styles.PanelLeaveTo;
</script>

<template>
  <Tabs.Root :class="styles.Root" default-value="overview">
    <Tabs.List :class="styles.List">
      <Tabs.Tab :class="styles.Tab" value="overview">Overview</Tabs.Tab>
      <Tabs.Tab :class="styles.Tab" value="projects">Projects</Tabs.Tab>
      <Tabs.Tab :class="styles.Tab" value="account">Account</Tabs.Tab>
      <Tabs.Indicator :class="styles.Indicator" />
    </Tabs.List>
    <div :class="styles.PanelViewport">
      <Transition :enter-from-class="enterFromClass" :leave-to-class="leaveToClass">
        <Tabs.Panel :class="styles.Panel" value="overview">
          <p :class="styles.Paragraph">Workspace stats and activity.</p>
        </Tabs.Panel>
      </Transition>
      <Transition :enter-from-class="enterFromClass" :leave-to-class="leaveToClass">
        <Tabs.Panel :class="styles.Panel" value="projects">
          <p :class="styles.Paragraph">Milestones and deadlines.</p>
        </Tabs.Panel>
      </Transition>
      <Transition :enter-from-class="enterFromClass" :leave-to-class="leaveToClass">
        <Tabs.Panel :class="styles.Panel" value="account">
          <p :class="styles.Paragraph">Profile and preferences.</p>
        </Tabs.Panel>
      </Transition>
    </div>
  </Tabs.Root>
</template>
