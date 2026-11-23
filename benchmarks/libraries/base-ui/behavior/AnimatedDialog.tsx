import { Dialog } from '@base-ui/react/dialog';
import '../../../behavior/style.css';

const ANIMATION = `
.bench-motion[data-starting-style],
.bench-motion[data-ending-style] {
  opacity: var(--bench-hidden-opacity);
  transform: var(--bench-hidden-transform);
}
`;

export default function AnimatedDialog() {
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <Dialog.Root>
        <Dialog.Trigger data-bench="trigger">Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Viewport>
            <Dialog.Popup data-bench="popup" className="bench-motion">
              <Dialog.Title>Title</Dialog.Title>
              <Dialog.Description>Description</Dialog.Description>
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
