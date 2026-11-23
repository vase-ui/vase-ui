import { Menu } from '@base-ui/react/menu';
import '../../../behavior/style.css';

const ANIMATION = `
[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}

.bench-motion[data-starting-style],
.bench-motion[data-ending-style] {
  opacity: var(--bench-hidden-opacity);
  transform: var(--bench-hidden-transform);
}
`;

export default function AnimatedMenu() {
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <Menu.Root>
        <Menu.Trigger data-bench="trigger">Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-bench="popup" className="bench-motion">
              <Menu.Item>Item 1</Menu.Item>
              <Menu.Item>Item 2</Menu.Item>
              <Menu.Item>Item 3</Menu.Item>
              <Menu.Item>Item 4</Menu.Item>
              <Menu.Item>Item 5</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
