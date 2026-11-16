import { parse } from 'vue/compiler-sfc';

// `vue/compiler-sfc` does not export the enum `NodeTypes`, so the code compares its values.
export const ELEMENT = 1;
export const TEXT = 2;
export const INTERPOLATION = 5;
export const ATTRIBUTE = 6;
export const DIRECTIVE = 7;

interface TemplateProp {
  type: number;
  name: string;
  /** The name of a directive as the file writes it, such as `:class` or `#tailwind`. */
  rawName?: string | undefined;
  value?: { content: string } | undefined;
  arg?: { content?: string } | undefined;
  exp?: { content?: string } | undefined;
}

export interface TemplateNode {
  type?: number | undefined;
  tag?: string | undefined;
  props?: TemplateProp[] | undefined;
  /** The text of a text node. An interpolation has its expression in `content.content`. */
  content?: string | { content?: string } | undefined;
  children?: unknown[] | undefined;
}

export interface VueFile {
  /** The nodes of the template in tree order. */
  nodes: TemplateNode[];
  /** The code of the `script` block and of the `script setup` block. */
  scripts: string[];
}

/** The nodes of the template of a Vue file in tree order, and the code of its script blocks. */
export function readVueFile(text: string): VueFile {
  const { descriptor } = parse(text);
  const nodes: TemplateNode[] = [];
  const visit = (node: TemplateNode): void => {
    for (const child of node.children ?? []) {
      if (typeof child === 'object' && child !== null) {
        nodes.push(child);
        visit(child);
      }
    }
  };
  if (descriptor.template?.ast) {
    visit(descriptor.template.ast);
  }
  return {
    nodes,
    scripts: [descriptor.script, descriptor.scriptSetup].flatMap((block) =>
      block ? [block.content] : [],
    ),
  };
}
