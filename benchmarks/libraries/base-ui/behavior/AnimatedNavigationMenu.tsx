import { NavigationMenu } from '@base-ui/react/navigation-menu';
import '../../../behavior/style.css';

const ANIMATION = `
.nav-positioner {
  width: var(--positioner-width);
  height: var(--positioner-height);
}

[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}

.bench-motion[data-starting-style],
.bench-motion[data-ending-style] {
  opacity: var(--bench-hidden-opacity);
  transform: var(--bench-hidden-transform);
}
`;

export default function AnimatedNavigationMenu() {
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger data-bench="trigger">Open</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#item-1">Item 1</NavigationMenu.Link>
              <NavigationMenu.Link href="#item-2">Item 2</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner className="nav-positioner">
            <NavigationMenu.Popup data-bench="popup" className="bench-motion">
              <NavigationMenu.Arrow />
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    </div>
  );
}
