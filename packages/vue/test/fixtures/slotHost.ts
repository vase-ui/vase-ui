import { onTestFinished } from 'vitest';

export function createSlotHost(...children: Element[]) {
  if (!customElements.get('test-slot-host')) {
    customElements.define('test-slot-host', class extends HTMLElement {});
  }
  const host = document.createElement('test-slot-host');
  const root = host.attachShadow({ mode: 'open' });
  host.append(...children);
  document.body.append(host);
  onTestFinished(() => host.remove());
  return root;
}
