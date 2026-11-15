import axe from 'axe-core';

interface AxeOptions extends axe.RunOptions {
  /**
   * Says whether an element that axe reports for a rule is correct. The helper then ignores the
   * report of that rule for that element.
   */
  accept?: (rule: string, element: Element) => boolean;
}

/**
 * Throws when axe finds a violation in the element.
 */
export async function expectNoAxeViolations(
  element: Element,
  { accept, ...options }: AxeOptions = {},
): Promise<void> {
  const results = await axe.run(element, { ...options, elementRef: true });
  const violations = results.violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter(
        (node) => !(accept && node.element && accept(violation.id, node.element)),
      ),
    }))
    .filter((violation) => violation.nodes.length > 0);

  if (violations.length > 0) {
    const report = violations.map(
      (violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.html).join('\n')}`,
    );
    throw new Error(`axe found ${violations.length} violation(s):\n\n${report.join('\n\n')}`);
  }
}
