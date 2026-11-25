import { Drawer } from '@base-ui/react/drawer';
import '../../../behavior/style.css';

const ANIMATION = `
.bench-motion[data-starting-style],
.bench-motion[data-ending-style] {
  opacity: var(--bench-hidden-opacity);
  transform: var(--bench-hidden-transform);
}
`;

export default function AnimatedDrawer() {
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <Drawer.Root>
        <Drawer.Trigger data-bench="trigger">Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop />
          <Drawer.Viewport>
            <Drawer.Popup data-bench="popup" className="bench-motion">
              <Drawer.Content>
                <Drawer.Title>Title</Drawer.Title>
                <Drawer.Description>Description</Drawer.Description>
                <Drawer.Close>Close</Drawer.Close>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
