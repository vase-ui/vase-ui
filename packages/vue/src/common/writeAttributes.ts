/**
 * Writes the attributes of a part again after the mount. While Vue hydrates, it keeps the
 * attributes and the style of each element that it keeps, so a server with other `Intl` data
 * leaves its own attributes (test/measurements/date-time-field.test.ts). Of a style object, the
 * function writes the custom properties: the only style that a part makes from that data.
 *
 * Vue writes the `value` of an input while it hydrates. A range input then clamps that value to the
 * `min` and `max` of the server, so the function writes the value again after the other attributes.
 */
export function writeAttributes(element: HTMLElement, attributes: Record<string, unknown>) {
  for (const [name, value] of Object.entries(attributes)) {
    if (/^on[A-Z]/.test(name) || name === 'value') continue;
    if (name === 'style' && typeof value === 'object' && value !== null) {
      for (const [property, text] of Object.entries(value)) {
        if (property.startsWith('--')) element.style.setProperty(property, String(text));
      }
    } else if (value == null || value === false) element.removeAttribute(name);
    else if (value === true) element.setAttribute(name, '');
    else if (typeof value === 'string' || typeof value === 'number') {
      element.setAttribute(name, String(value));
    }
  }
  const { value } = attributes;
  if ((typeof value === 'string' || typeof value === 'number') && 'value' in element) {
    const input = element as HTMLInputElement;
    if (input.value !== String(value)) input.value = String(value);
  }
}
