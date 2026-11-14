import { describe } from 'vitest';
import { createRenderer, describeConformance } from '#test-utils';
import PopupPart from './PopupPart.vue';
import PopupPositionerPart from './PopupPositionerPart.vue';
import PopupRootPart from './PopupRootPart.vue';
import PopupViewportPart from './PopupViewportPart.vue';

describe('<PopupViewportPart />', () => {
  const { render } = createRenderer();

  describeConformance(<PopupViewportPart />, () => ({
    render(node) {
      return render(
        <PopupRootPart open>
          <PopupPositionerPart>
            <PopupPart>{node}</PopupPart>
          </PopupPositionerPart>
        </PopupRootPart>,
      );
    },
    refInstanceof: window.HTMLDivElement,
    childrenSelector: '[data-current]',
  }));
});
