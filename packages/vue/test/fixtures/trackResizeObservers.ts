import { onTestFinished, vi } from 'vitest';

export function trackResizeObservers() {
  const targets = new Set<Set<Element>>();
  class TrackedResizeObserver extends ResizeObserver {
    private readonly elements = new Set<Element>();

    constructor(callback: ResizeObserverCallback) {
      super(callback);
      targets.add(this.elements);
    }

    override observe(target: Element, options?: ResizeObserverOptions) {
      targets.add(this.elements);
      this.elements.add(target);
      super.observe(target, options);
    }

    override unobserve(target: Element) {
      this.elements.delete(target);
      super.unobserve(target);
    }

    override disconnect() {
      targets.delete(this.elements);
      this.elements.clear();
      super.disconnect();
    }
  }
  vi.stubGlobal('ResizeObserver', TrackedResizeObserver);
  onTestFinished(() => vi.unstubAllGlobals());
  return () => Array.from(targets, (elements) => [...elements]);
}
