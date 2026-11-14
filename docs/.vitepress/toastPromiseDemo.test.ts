import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';

const DEMO = join(import.meta.dirname, '../demos/toast/promise/css-modules/PromiseDemo.vue');

// `promise()` of the toast manager returns a promise that rejects when the promise of the caller
// rejects. The demo rejects its promise in 3 of 10 runs, and a page reports an uncaught error when
// the demo leaves that rejection unhandled.
test('the Toast promise demo handles the rejection of the promise that the manager returns', () => {
  const { descriptor } = parse(readFileSync(DEMO, 'utf8'));
  assert.ok(descriptor.scriptSetup);
  const script = ts.createSourceFile(
    DEMO,
    descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'promise'
    ) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(script);

  assert.equal(calls.length, 1);
  const handler = calls[0].parent;
  assert.ok(
    ts.isPropertyAccessExpression(handler) &&
      handler.name.text === 'catch' &&
      ts.isCallExpression(handler.parent),
  );
});
