import { Toast } from '@base-ui/react/toast';
import { toastTimeout } from '../../../harness/toastTimeout.ts';
import '../../../behavior/style.css';
import '../../../behavior/toasts.css';

/** The stack and the motion of the example "Stacking and animations" of the docs. */
const STACK = `
.bench-toast {
  --gap: 0.75rem;
  --peek: 0.75rem;
  --scale: calc(max(0, 1 - (var(--toast-index) * 0.1)));
  --shrink: calc(1 - var(--scale));
  --height: var(--toast-frontmost-height, var(--toast-height));
  --offset-y: calc(
    var(--toast-offset-y) * -1 + (var(--toast-index) * var(--gap) * -1) +
      var(--toast-swipe-movement-y)
  );

  position: absolute;
  right: 0;
  bottom: 0;
  z-index: calc(1000 - var(--toast-index));
  width: 100%;
  height: var(--height);
  transform: translateX(var(--toast-swipe-movement-x))
    translateY(
      calc(
        var(--toast-swipe-movement-y) - (var(--toast-index) * var(--peek)) -
          (var(--shrink) * var(--height))
      )
    )
    scale(var(--scale));
  transform-origin: bottom center;
  transition:
    transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.5s,
    height 0.15s;
  user-select: none;
}

.bench-toast[data-expanded] {
  height: var(--toast-height);
  transform: translateX(var(--toast-swipe-movement-x)) translateY(var(--offset-y));
}

.bench-toast[data-starting-style],
.bench-toast[data-ending-style] {
  transform: translateY(150%);
}

.bench-toast[data-limited] {
  opacity: 0;
}

.bench-toast[data-ending-style] {
  opacity: 0;
}

.bench-toast[data-ending-style][data-swipe-direction='up'] {
  transform: translateY(calc(var(--toast-swipe-movement-y) - 150%));
}

.bench-toast[data-ending-style][data-swipe-direction='left'] {
  transform: translateX(calc(var(--toast-swipe-movement-x) - 150%)) translateY(var(--offset-y));
}

.bench-toast[data-ending-style][data-swipe-direction='right'] {
  transform: translateX(calc(var(--toast-swipe-movement-x) + 150%)) translateY(var(--offset-y));
}

.bench-toast[data-ending-style][data-swipe-direction='down'] {
  transform: translateY(calc(var(--toast-swipe-movement-y) + 150%));
}

.bench-toast::after {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  height: calc(var(--gap) + 1px);
  content: '';
}

.bench-toast .bench-toast-content {
  overflow: hidden;
  transition: opacity 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.bench-toast .bench-toast-content[data-behind] {
  opacity: 0;
}

.bench-toast .bench-toast-content[data-expanded] {
  opacity: 1;
}
`;

const toastManager = Toast.createToastManager();

function addToast(priority?: 'high') {
  toastManager.add({
    title: 'Saved',
    description: 'The file is saved.',
    timeout: toastTimeout,
    priority,
    actionProps: { children: 'Undo' },
  });
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className="bench-toast" data-bench="toast">
      <Toast.Content className="bench-toast-content">
        <div className="bench-toast-text">
          <Toast.Title className="bench-toast-title" />
          <Toast.Description className="bench-toast-description" />
        </div>
        <Toast.Action data-bench="toast-action" />
        <Toast.Close data-bench="toast-close">Close</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

export default function Toasts() {
  return (
    <Toast.Provider toastManager={toastManager}>
      <div className="bench-page">
        <style>{STACK}</style>
        <button
          type="button"
          data-bench="add-toast"
          onClick={() => {
            addToast();
          }}
        >
          Add toast
        </button>
        <button
          type="button"
          data-bench="add-important-toast"
          onClick={() => {
            addToast('high');
          }}
        >
          Add important toast
        </button>
      </div>
      <Toast.Portal>
        <Toast.Viewport className="bench-toast-viewport" aria-label="Notifications">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
