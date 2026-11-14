import { render as renderVue, type VNode } from 'vue';
import { expect, describe, it, onTestFinished } from 'vitest';
import { isJSDOM } from './testUtils';
import { visuallyHidden, visuallyHiddenInput, visuallyHiddenInputPinned } from './visuallyHidden';

function render(node: VNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  renderVue(node, container);
  onTestFinished(() => {
    renderVue(null, container);
    container.remove();
  });
}

const screen = {
  getByTestId(id: string) {
    const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (element === null) {
      throw new Error(`Unable to find an element with the test id "${id}".`);
    }
    return element;
  },
};

describe.skipIf(isJSDOM)('visuallyHidden', () => {
  describe.each([
    { name: 'visuallyHidden', style: visuallyHidden },
    { name: 'visuallyHiddenInputPinned', style: visuallyHiddenInputPinned },
  ])('$name', ({ style }) => {
    it.each([
      ['ltr', 'ltr'],
      ['ltr', 'rtl'],
      ['rtl', 'ltr'],
      ['rtl', 'rtl'],
    ])('does not overflow a %s scroller with %s content', (scrollerDirection, contentDirection) => {
      render(
        <div
          data-testid="scroller"
          dir={scrollerDirection}
          style={{ width: '100px', height: '100px', overflow: 'auto' }}
        >
          {/* Establish a fixed-position containing block below the scroller's top edge. */}
          <div dir={contentDirection} style={{ transform: 'translateY(20px)' }}>
            <input type="radio" style={style} />
          </div>
        </div>,
      );

      const scroller = screen.getByTestId('scroller');
      expect(scroller.scrollWidth).toBe(scroller.clientWidth);
    });

    // Label clicks and native validation focus hidden inputs.
    it('does not scroll the page when focused', ({ onTestFinished }) => {
      onTestFinished(() => window.scrollTo(0, 0));
      render(
        <div style={{ paddingTop: '2000px', height: '5000px' }}>
          <input type="checkbox" data-testid="input" style={style} />
        </div>,
      );
      window.scrollTo(0, 1500);
      expect(window.scrollY).toBe(1500);

      screen.getByTestId('input').focus();
      expect(window.scrollY).toBe(1500);
    });
  });

  it('places visuallyHidden just above the viewport', () => {
    render(<span data-testid="hidden" style={visuallyHidden} />);
    expect(screen.getByTestId('hidden').getBoundingClientRect().bottom).toBe(0);
  });
});

describe('visuallyHidden styles', () => {
  // A browser drops a length that has no unit, and Vue does not add one.
  it.each([
    { name: 'visuallyHidden', style: visuallyHidden },
    { name: 'visuallyHiddenInput', style: visuallyHiddenInput },
  ])('applies each style of $name', ({ style }) => {
    render(<span data-testid="hidden" style={style} />);
    const element = screen.getByTestId('hidden');

    const dropped = Object.keys(style).filter((name) => Reflect.get(element.style, name) === '');
    expect(dropped).toEqual([]);
  });
});
