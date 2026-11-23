import { Drawer } from '@base-ui/react/drawer';
import { useState } from 'react';
import '../../../behavior/style.css';
import '../../../behavior/drawers.css';

// The motion of the nested drawer example of the docs, with no stack look.
const MOTION = `
.drawer-viewport {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.drawer-popup {
  position: relative;
  transition: transform 450ms cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform;
  transform: translateY(var(--drawer-swipe-movement-y));
}

.drawer-popup[data-swiping] {
  transition-duration: 0ms;
}

.drawer-popup[data-starting-style],
.drawer-popup[data-ending-style] {
  transform: translateY(calc(100% + 2px));
}

.drawer-popup[data-ending-style] {
  transition-duration: calc(var(--drawer-swipe-strength) * 400ms);
}
`;

export default function NestedDrawers() {
  const [drawerCount, setDrawerCount] = useState(0);
  return (
    <div className="bench-page">
      <style>{MOTION}</style>
      <Drawer.Root>
        <Drawer.Trigger data-bench="drawer-1-trigger">Open drawer 1</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Backdrop className="bench-backdrop" />
          <Drawer.Viewport className="drawer-viewport">
            <Drawer.Popup data-bench="drawer-1" className="drawer-popup">
              <div data-bench="drawer-1-handle" />
              <Drawer.Content>
                <div className="bench-drawer-row">
                  <button
                    type="button"
                    data-bench="drawer-1-action"
                    onClick={() => {
                      setDrawerCount((count) => count + 1);
                    }}
                  >
                    Drawer 1 action
                  </button>
                  <span data-bench="drawer-1-count">{drawerCount}</span>
                  <Drawer.Root>
                    <Drawer.Trigger data-bench="drawer-2-trigger">Open drawer 2</Drawer.Trigger>
                    <Drawer.Portal>
                      <Drawer.Viewport className="drawer-viewport">
                        <Drawer.Popup data-bench="drawer-2" className="drawer-popup">
                          <div data-bench="drawer-2-handle" />
                          <Drawer.Content>
                            <div className="bench-drawer-row">
                              <button type="button" data-bench="drawer-2-action">
                                Drawer 2 action
                              </button>
                              <Drawer.Close>Close</Drawer.Close>
                            </div>
                            <Drawer.Title className="bench-drawer-title">Drawer 2</Drawer.Title>
                            <Drawer.Description className="bench-drawer-description">
                              Description 2
                            </Drawer.Description>
                          </Drawer.Content>
                        </Drawer.Popup>
                      </Drawer.Viewport>
                    </Drawer.Portal>
                  </Drawer.Root>
                  <Drawer.Close>Close</Drawer.Close>
                </div>
                <Drawer.Title className="bench-drawer-title">Drawer 1</Drawer.Title>
                <Drawer.Description className="bench-drawer-description">
                  Description 1
                </Drawer.Description>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
