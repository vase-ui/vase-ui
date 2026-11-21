import { Menu } from '@base-ui/react/menu';

export default function MenuScenario() {
  return (
    <Menu.Root>
      <Menu.Trigger data-bench="trigger">Open</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-bench="popup">
            <Menu.Item>Item 1</Menu.Item>
            <Menu.Item>Item 2</Menu.Item>
            <Menu.Item>Item 3</Menu.Item>
            <Menu.Item>Item 4</Menu.Item>
            <Menu.Item>Item 5</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
