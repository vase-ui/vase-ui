import { afterEach, describe, expect, test } from 'vitest';
import { hasTabStop, tabbables } from './tabbable';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
});

function ids(markup: string, setup?: (container: HTMLElement) => void) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  setup?.(root);
  return tabbables(root).map((element) => element.id);
}

describe('tabbables', () => {
  test.each([
    {
      name: 'the controls in the order of the document',
      markup: '<button id="a">A</button><input id="b" aria-label="B"><a id="c" href="#c">C</a>',
      stops: ['a', 'b', 'c'],
    },
    {
      name: 'no disabled control, also in a disabled fieldset',
      markup:
        '<button id="a" disabled>A</button><fieldset disabled><input id="b" aria-label="B"></fieldset><button id="c">C</button>',
      stops: ['c'],
    },
    {
      name: 'no element with a negative tabindex',
      markup: '<button id="a" tabindex="-1">A</button><div id="b" tabindex="0">B</div>',
      stops: ['b'],
    },
    {
      name: 'no element in an inert or a hidden branch, or with display: none',
      markup:
        '<div inert><button id="a">A</button></div><div hidden><button id="b">B</button></div><button id="c" style="display: none">C</button><button id="d" style="visibility: hidden">D</button><button id="e">E</button>',
      stops: ['e'],
    },
    {
      name: 'the summary of a closed details and not its content',
      markup: '<details><summary id="a">A</summary><button id="b">B</button></details>',
      stops: ['a'],
    },
    {
      name: 'the checked radio of a group, else the first one, for each group',
      markup:
        '<input id="a" type="radio" name="x" aria-label="A"><input id="b" type="radio" name="x" aria-label="B" checked><input id="c" type="radio" name="y" aria-label="C"><input id="d" type="radio" name="y" aria-label="D">',
      stops: ['b', 'c'],
    },
    {
      name: 'one radio for each form of a name',
      markup:
        '<form><input id="a" type="radio" name="x" aria-label="A"></form><form><input id="b" type="radio" name="x" aria-label="B"></form>',
      stops: ['a', 'b'],
    },
    {
      name: 'an element with contenteditable, and no hidden input',
      markup: '<div id="a" contenteditable="true">A</div><input id="b" type="hidden">',
      stops: ['a'],
    },
  ])('gives $name', ({ markup, stops }) => {
    expect(ids(markup)).toEqual(stops);
  });

  test('gives the controls of an open shadow root at the place of its host', () => {
    const stops = ids(
      '<button id="a">A</button><div id="host"></div><button id="c">C</button>',
      (container) => {
        const button = document.createElement('button');
        button.id = 'b';
        container.querySelector('#host')!.attachShadow({ mode: 'open' }).append(button);
      },
    );
    expect(stops).toEqual(['a', 'b', 'c']);
  });
});

describe('hasTabStop', () => {
  test('is true for a tab stop in the container or in an open shadow root, and false for no tab stop', () => {
    ids('<div id="host"></div><button tabindex="-1">A</button><button disabled>B</button>');
    const container = root!;
    expect(hasTabStop(container)).toBe(false);
    const shadow = container.querySelector('#host')!.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<input>';
    expect(hasTabStop(container)).toBe(true);
    shadow.innerHTML = '';
    expect(hasTabStop(container)).toBe(false);
    container.appendChild(document.createElement('button'));
    expect(hasTabStop(container)).toBe(true);
  });
});
