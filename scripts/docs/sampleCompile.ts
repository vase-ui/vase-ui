import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc';
import { REPOSITORY_ROOT } from '../parity/repository.ts';

const IGNORED_DOCS_FOLDERS = new Set(['.vitepress', 'node_modules']);
const SAMPLE_SCOPE_ID = 'sample';

const SNIPPET_LINE = /^\s*<<<\s*(.+?)\s*$/;
const SNIPPET_TITLE = /\s*\[[^\]]+\]$/;
const SNIPPET_BRACES = /\s*\{[^}]*\}$/;
const SNIPPET_REGION = /#[\w.-]+$/;

export interface PageSnippet {
  line: number;
  path: string;
}

export interface SampleFiles {
  files: string[];
  problems: string[];
}

function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function readPageSnippets(text: string): PageSnippet[] {
  return text.split(/\r?\n/).flatMap((rawLine, index) => {
    const match = SNIPPET_LINE.exec(rawLine);
    if (!match) {
      return [];
    }
    // VitePress removes the title, the braces and the region from the right, in that sequence.
    const path = match[1]
      .replace(SNIPPET_TITLE, '')
      .replace(SNIPPET_BRACES, '')
      .replace(SNIPPET_REGION, '')
      .trim();
    return path === '' ? [] : [{ line: index + 1, path }];
  });
}

function walkDocsDirectory(
  root: string,
  directory: string,
  vueFiles: Set<string>,
  pages: string[],
): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (IGNORED_DOCS_FOLDERS.has(entry.name)) {
      continue;
    }
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      walkDocsDirectory(root, fullPath, vueFiles, pages);
    } else if (entry.isFile()) {
      const relativePath = toPosixPath(relative(root, fullPath));
      if (entry.name.endsWith('.vue')) {
        vueFiles.add(relativePath);
      } else if (entry.name.endsWith('.md')) {
        pages.push(relativePath);
      }
    }
  }
}

export function listSampleFiles(root = REPOSITORY_ROOT): SampleFiles {
  const docsRoot = join(root, 'docs');
  const vueFiles = new Set<string>();
  const pages: string[] = [];
  const problems: string[] = [];
  if (existsSync(docsRoot)) {
    walkDocsDirectory(root, docsRoot, vueFiles, pages);
  }
  pages.sort();
  for (const page of pages) {
    const pageFile = join(root, page);
    for (const { line, path: snippetPath } of readPageSnippets(readFileSync(pageFile, 'utf8'))) {
      const target = snippetPath.startsWith('@')
        ? resolve(docsRoot, snippetPath.replace(/^@[\\/]?/, ''))
        : resolve(dirname(pageFile), snippetPath);
      if (!target.endsWith('.vue')) {
        continue;
      }
      const relativeTarget = toPosixPath(relative(root, target));
      if (!existsSync(target)) {
        problems.push(`${page}:${line}: ${relativeTarget} does not exist.`);
      } else {
        vueFiles.add(relativeTarget);
      }
    }
  }
  return { files: [...vueFiles].sort(), problems };
}

export function compileSampleFile(
  filename: string,
  text: string,
  root = REPOSITORY_ROOT,
): string | undefined {
  const pathFromRoot = toPosixPath(relative(root, filename));
  const { descriptor, errors } = parse(text, { filename });
  if (errors.length > 0) {
    return `${pathFromRoot}: ${errors.map(errorMessage).join('\n')}`;
  }
  try {
    if (descriptor.script || descriptor.scriptSetup) {
      compileScript(descriptor, {
        id: SAMPLE_SCOPE_ID,
        isProd: true,
        inlineTemplate: true,
      });
    }
    // compileScript compiles the template inline only for <script setup>, and throws when the file has no script block.
    if (descriptor.template && !descriptor.scriptSetup) {
      const template = compileTemplate({
        source: descriptor.template.content,
        filename,
        id: SAMPLE_SCOPE_ID,
        isProd: true,
        ast: descriptor.template.ast,
      });
      if (template.errors.length > 0) {
        return `${pathFromRoot}: ${template.errors.map(errorMessage).join('\n')}`;
      }
    }
  } catch (error) {
    return `${pathFromRoot}: ${errorMessage(error)}`;
  }
  return undefined;
}

function main(): void {
  const { files, problems } = listSampleFiles(REPOSITORY_ROOT);
  for (const file of files) {
    const fullPath = join(REPOSITORY_ROOT, file);
    const problem = compileSampleFile(fullPath, readFileSync(fullPath, 'utf8'), REPOSITORY_ROOT);
    if (problem !== undefined) {
      problems.push(problem);
    }
  }
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(problem);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`The SFC compiler accepted ${files.length} Vue files.`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  }
}
