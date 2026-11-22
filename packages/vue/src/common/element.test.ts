import { expect, test, onTestFinished } from 'vitest';
import { inDocumentOrder } from './element';

function tree() {
  const page = document.createElement('div');
  page.innerHTML =
    '<p id="before"></p><div id="root"><p id="a"></p><p id="b"><span id="c"></span></p></div><p id="after"></p>';
  document.body.append(page);
  onTestFinished(() => page.remove());
  return {
    root: page.querySelector<HTMLElement>('#root')!,
    byId: (id: string) => page.querySelector(`#${id}`)!,
  };
}

test('gives the order of the document, also for an element outside the root', () => {
  const { root, byId } = tree();
  expect(inDocumentOrder(['c', 'a', 'b'], byId, root)).toEqual(['a', 'b', 'c']);
  expect(inDocumentOrder(['after', 'c', 'before'], byId, root)).toEqual(['before', 'c', 'after']);
});
