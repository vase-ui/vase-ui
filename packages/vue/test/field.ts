/** The `data-*` attributes of an element, sorted. */
export function dataAttributes(element: Element) {
  return element
    .getAttributeNames()
    .filter((name) => name.startsWith('data-'))
    .sort();
}

/** Props of `Field.Root` whose `validate` writes each value that it validates in `log`. */
export function recordValidate(
  log: unknown[],
  props: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    validate: (value: unknown) => {
      log.push(value);
    },
    ...props,
  };
}
