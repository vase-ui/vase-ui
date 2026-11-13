<script setup lang="ts">
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { Tabs } from '@vase-ui/vue/tabs';

// Inline styles, so that the layout is in the server HTML and does not wait for a file of the app.
const LIST_STYLE = 'display: flex; position: relative; width: 300px';
const TAB_STYLE = 'width: 100px; height: 40px; padding: 0; border: 0';
const INDICATOR_STYLE =
  'position: absolute; left: 0; top: 0; translate: var(--active-tab-left); width: var(--active-tab-width); height: 100%';
</script>

<template>
  <main>
    <CSPProvider nonce="test-nonce">
      <Tabs.Root data-testid="panels-after" default-value="b">
        <Tabs.List :style="LIST_STYLE">
          <Tabs.Tab value="a" :style="TAB_STYLE">A</Tabs.Tab>
          <Tabs.Tab value="b" data-testid="tab-b" :style="TAB_STYLE">B</Tabs.Tab>
          <Tabs.Tab value="c" data-testid="tab-c" :style="TAB_STYLE">C</Tabs.Tab>
          <Tabs.Indicator
            render-before-hydration
            data-testid="indicator"
            :style="INDICATOR_STYLE"
          />
        </Tabs.List>
        <Tabs.Panel value="a">Panel A</Tabs.Panel>
        <Tabs.Panel value="b">Panel B</Tabs.Panel>
        <Tabs.Panel value="c" data-testid="panel-c" keep-mounted>Panel C</Tabs.Panel>
      </Tabs.Root>
      <Tabs.Root data-testid="panels-before" default-value="b">
        <Tabs.Panel value="a">Panel A</Tabs.Panel>
        <Tabs.Panel value="b">Panel B</Tabs.Panel>
        <Tabs.List>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>
    </CSPProvider>
  </main>
</template>
