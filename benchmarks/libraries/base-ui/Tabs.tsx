import { Tabs } from '@base-ui/react/tabs';

export default function TabsScenario() {
  return (
    <Tabs.Root defaultValue="1">
      <Tabs.List>
        <Tabs.Tab value="1">Tab 1</Tabs.Tab>
        <Tabs.Tab value="2">Tab 2</Tabs.Tab>
        <Tabs.Tab value="3">Tab 3</Tabs.Tab>
        <Tabs.Indicator />
      </Tabs.List>
      <Tabs.Panel value="1">Panel 1</Tabs.Panel>
      <Tabs.Panel value="2">Panel 2</Tabs.Panel>
      <Tabs.Panel value="3">Panel 3</Tabs.Panel>
    </Tabs.Root>
  );
}
