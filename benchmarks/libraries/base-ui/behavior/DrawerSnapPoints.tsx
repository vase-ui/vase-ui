import { Drawer } from '@base-ui/react/drawer';
import { useState } from 'react';
import '../../../behavior/style.css';
import '../../../behavior/drawers.css';

// The motion of the snap point example of the docs.
const MOTION = `
.drawer-viewport {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  touch-action: none;
}

.drawer-popup {
  position: relative;
  touch-action: none;
  transition: transform 450ms cubic-bezier(0.32, 0.72, 0, 1);
  transform: translateY(calc(var(--drawer-snap-point-offset) + var(--drawer-swipe-movement-y)));
  will-change: transform;
}

.drawer-popup[data-starting-style],
.drawer-popup[data-ending-style] {
  transform: translateY(calc(100% + 2px));
}

.drawer-popup[data-ending-style] {
  transition-duration: calc(var(--drawer-swipe-strength) * 400ms);
}
`;

const SNAP_POINTS = ['240px', '480px'];

export default function DrawerSnapPoints() {
  const [snapPoint, setSnapPoint] = useState<Drawer.Root.SnapPoint | null>('480px');
  return (
    <div className="bench-page">
      <style>{MOTION}</style>
      <Drawer.Root snapPoints={SNAP_POINTS} snapPoint={snapPoint} onSnapPointChange={setSnapPoint}>
        <Drawer.Trigger data-bench="drawer-trigger">Open drawer</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop className="bench-backdrop" />
          <Drawer.Viewport className="drawer-viewport">
            <Drawer.Popup data-bench="drawer" className="drawer-popup">
              <div data-bench="drawer-handle" />
              <Drawer.Content>
                <div className="bench-drawer-row">
                  <Drawer.Close>Close</Drawer.Close>
                </div>
                <Drawer.Title className="bench-drawer-title">Drawer</Drawer.Title>
                <Drawer.Description className="bench-drawer-description">
                  Description
                </Drawer.Description>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
