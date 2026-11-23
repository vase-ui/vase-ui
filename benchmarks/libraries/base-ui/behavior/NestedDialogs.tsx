import { Dialog } from '@base-ui/react/dialog';
import { useState } from 'react';
import '../../../behavior/style.css';

const ANIMATION = `
.bench-motion[data-starting-style],
.bench-motion[data-ending-style] {
  opacity: var(--bench-hidden-opacity);
  transform: var(--bench-hidden-transform);
}
`;

export default function NestedDialogs() {
  const [pageCount, setPageCount] = useState(0);
  const [dialogCount, setDialogCount] = useState(0);
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <button
        type="button"
        data-bench="page-action"
        onClick={() => {
          setPageCount((count) => count + 1);
        }}
      >
        Page action
      </button>
      <span data-bench="page-count">{pageCount}</span>
      <Dialog.Root>
        <Dialog.Trigger data-bench="dialog-1-trigger">Open dialog 1</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="bench-backdrop" />
          <Dialog.Popup data-bench="dialog-1" className="bench-motion">
            <div className="bench-corner">
              <button
                type="button"
                data-bench="dialog-1-action"
                onClick={() => {
                  setDialogCount((count) => count + 1);
                }}
              >
                Dialog 1 action
              </button>
              <span data-bench="dialog-1-count">{dialogCount}</span>
            </div>
            <Dialog.Title>Dialog 1</Dialog.Title>
            <Dialog.Description>Description 1</Dialog.Description>
            <Dialog.Root>
              <Dialog.Trigger data-bench="dialog-2-trigger">Open dialog 2</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className="bench-backdrop" />
                <Dialog.Popup data-bench="dialog-2" className="bench-motion">
                  <Dialog.Title>Dialog 2</Dialog.Title>
                  <Dialog.Description>Description 2</Dialog.Description>
                  <button type="button" data-bench="dialog-2-action">
                    Dialog 2 action
                  </button>
                  <Dialog.Close>Close</Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
