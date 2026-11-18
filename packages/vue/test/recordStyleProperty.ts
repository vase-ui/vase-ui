import { onTestFinished } from 'vitest';

export function recordStyleProperty(element: HTMLElement, property: string) {
  const read = () => element.style.getPropertyValue(property);
  const values = [read()];
  const observer = new MutationObserver(() => {
    const value = read();
    if (values.at(-1) !== value) {
      values.push(value);
    }
  });
  observer.observe(element, { attributes: true, attributeFilter: ['style'] });
  onTestFinished(() => observer.disconnect());
  return values;
}
