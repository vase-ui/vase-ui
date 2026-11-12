import axe from 'axe-core';

/**
 * Throws when axe finds a violation in the element.
 */
export async function expectNoAxeViolations(
  element: Element,
  options: axe.RunOptions = {},
): Promise<void> {
  const { violations } = await axe.run(element, options);

  if (violations.length > 0) {
    const report = violations.map(
      (violation) =>
        `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.html).join('\n')}`,
    );
    throw new Error(`axe found ${violations.length} violation(s):\n\n${report.join('\n\n')}`);
  }
}
