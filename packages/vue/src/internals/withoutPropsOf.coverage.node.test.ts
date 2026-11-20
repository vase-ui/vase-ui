import { expect, it } from 'vitest';
import { parse, walkIdentifiers } from 'vue/compiler-sfc';
import type { SFCTemplateBlock } from 'vue/compiler-sfc';

const sources = import.meta.glob<string>(
  ['../**/*.vue', '!../**/*.test.vue', '!../**/*.spec.vue'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

// https://github.com/vuejs/core/blob/v3.5.45/packages/compiler-core/src/ast.ts#L29
const ELEMENT = 1;
const COMMENT = 3;
const DIRECTIVE = 7;
const builtIns = new Set(['Teleport', 'KeepAlive', 'Suspense', 'Transition', 'TransitionGroup']);
const exceptions: Record<string, { reason: string }> = {
  '../toolbar/ToolbarInput.vue': {
    reason:
      'The wrapper declares each prop of `Input` that it gives on, so an attribute cannot set a prop of `Input`. The attributes fall through to `Input`.',
  },
  '../toolbar/ToolbarSeparator.vue': {
    reason:
      'Each prop of `Separator` is a prop of the wrapper, so an attribute cannot set a prop that the wrapper does not have. The attributes fall through to `Separator`.',
  },
};

type TemplateNode = NonNullable<SFCTemplateBlock['ast']>['children'][number];
type ElementNode = Extract<TemplateNode, { type: typeof ELEMENT }>;
type Directive = Extract<ElementNode['props'][number], { type: typeof DIRECTIVE }>;

function hasType<T extends number>(node: { type: number }, type: T): node is { type: T } {
  return node.type === type;
}

function isPart(node: TemplateNode): node is ElementNode {
  return hasType(node, ELEMENT) && /^[A-Z]/.test(node.tag) && !builtIns.has(node.tag);
}

function objectBindings(node: ElementNode) {
  return node.props.filter(
    (prop): prop is Directive => hasType(prop, DIRECTIVE) && prop.name === 'bind' && !prop.arg,
  );
}

function filtersAttributes(binding: Directive, tag: string) {
  const expression = binding.exp;
  if (!expression || !('ast' in expression) || !expression.ast) {
    return false;
  }
  let found = false;
  walkIdentifiers(expression.ast, (id, parent) => {
    if (
      id.name === '$attrs' &&
      parent?.type === 'CallExpression' &&
      parent.callee.type === 'Identifier' &&
      parent.callee.name === 'withoutPropsOf' &&
      parent.arguments[0] === id &&
      parent.arguments[1]?.type === 'Identifier' &&
      parent.arguments[1].name === tag
    ) {
      found = true;
    }
  });
  return found;
}

it('each wrapper filters the attributes it gives to another part', () => {
  const failures: string[] = [];
  let checked = 0;
  for (const [file, source] of Object.entries(sources)) {
    if (Object.hasOwn(exceptions, file)) {
      continue;
    }
    const { descriptor } = parse(source, { filename: file });
    const roots =
      descriptor.template?.ast?.children.filter((node) => !hasType(node, COMMENT)) ?? [];
    const partRoots = roots.length > 0 && roots.every(isPart);
    let hasBinding = false;
    function visit(node: TemplateNode) {
      if (!hasType(node, ELEMENT)) {
        return;
      }
      if (isPart(node)) {
        for (const binding of objectBindings(node)) {
          hasBinding = true;
          if (!filtersAttributes(binding, node.tag)) {
            failures.push(
              `${file}:${binding.loc.start.line} must bind withoutPropsOf($attrs, ${node.tag})`,
            );
          }
        }
      }
      node.children.forEach(visit);
    }

    roots.forEach(visit);
    if (partRoots || hasBinding) {
      checked += 1;
      if (partRoots && roots.some((node) => objectBindings(node).length === 0)) {
        failures.push(`${file}: each root part must bind the filtered attributes`);
      }
      const scripts = [descriptor.scriptSetup, descriptor.script];
      if (!scripts.some((block) => /\binheritAttrs\s*:\s*false\b/.test(block?.content ?? ''))) {
        failures.push(`${file}: the wrapper must set inheritAttrs to false`);
      }
    }
  }
  expect(checked).toBeGreaterThanOrEqual(24);
  expect(failures).toEqual([]);
});
