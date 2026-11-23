import { Popover } from '@base-ui/react/popover';
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

export default function AnimatedPopover() {
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <Popover.Root>
        <Popover.Trigger data-bench="trigger">Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-bench="popup" className="bench-motion">
              <Popover.Arrow />
              <Popover.Title>Title</Popover.Title>
              <Popover.Description>Description</Popover.Description>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
