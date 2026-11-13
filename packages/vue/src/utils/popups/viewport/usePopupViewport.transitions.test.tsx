import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { createSSRApp, defineComponent, h, inject, onMounted, shallowRef, toRaw } from 'vue';
import type { Component } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  nextEvent,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import PopupPart from '../../../../test/fixtures/PopupPart.vue';
import PopupPositionerPart from '../../../../test/fixtures/PopupPositionerPart.vue';
import PopupRootPart from '../../../../test/fixtures/PopupRootPart.vue';
import PopupViewportPart from '../../../../test/fixtures/PopupViewportPart.vue';
import {
  createPopupFixtureHandle,
  PopupFixtureContext,
} from '../../../../test/fixtures/PopupFixture';
import {
  createKeptScene,
  placeTrigger,
  scene,
} from '../../../../test/fixtures/popupViewportHarness';
import type {
  ViewportRootInstance,
  ViewportScene,
} from '../../../../test/fixtures/popupViewportHarness';
import type { HTMLProps } from '../../../internals/types';
import { adaptiveOrigin } from '../positioning/adaptiveOriginMiddleware';
import PopupViewportHydration from './PopupViewportHydration.test.vue';
import PopupViewportReplace from './PopupViewportReplace.test.vue';

const MORPH_TRANSITION_STYLES = `
  [data-transitioning] [data-current] {
    transition: transform 10s linear, opacity 10s linear;
  }
  [data-transitioning] [data-current][data-starting-style] {
    transform: translateX(30%);
    opacity: 0;
  }
  [data-transitioning] [data-previous] {
    transition: transform 10s linear, opacity 10s linear;
  }
  [data-transitioning] [data-previous][data-ending-style] {
    transform: translateX(-30%);
    opacity: 0;
  }
`;

function getMorphAnimationStyles(duration: string) {
  return `
    [data-transitioning] [data-previous] {
      animation: slide-out ${duration} ease-out forwards;
    }
    [data-transitioning] [data-current] {
      animation: slide-in ${duration} ease-out forwards;
    }
    @keyframes slide-out {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(-30%); opacity: 0; }
    }
    @keyframes slide-in {
      from { transform: translateX(30%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
}

function getActivationDirectionTokens(viewport: HTMLElement) {
  return (viewport.getAttribute('data-activation-direction') ?? '').split(' ').filter(Boolean);
}

function getCurrentContainer() {
  return document.querySelector<HTMLElement>('[data-current]');
}

function getPreviousContainer() {
  return document.querySelector<HTMLElement>('[data-previous]');
}

/**
 * Records the `transitionrun` events of the containers. The containers exist for the whole
 * transition, so a listener on the viewport gets each event.
 */
function recordTransitionRuns(viewport: HTMLElement) {
  const runs: Array<{ target: Element; property: string }> = [];
  viewport.addEventListener('transitionrun', (event) => {
    runs.push({ target: event.target as Element, property: event.propertyName });
  });
  return runs;
}

function getRunProperties(runs: ReturnType<typeof recordTransitionRuns>, target: Element | null) {
  return runs
    .filter((run) => run.target === target)
    .map((run) => run.property)
    .sort();
}

function finishAnimations() {
  for (const container of document.querySelectorAll('[data-previous], [data-current]')) {
    container.getAnimations().forEach((animation) => animation.finish());
  }
}

const content = (payload: unknown) => <div data-testid="content">Content {String(payload)}</div>;

describe('usePopupViewport', () => {
  const { render } = createRenderer();

  // A style element and the scene. The text of the content is `Content <payload>`.
  function renderMorph(
    styles: string,
    triggers: Array<{ id?: string; payload?: unknown; style?: Record<string, string> }>,
    options: Partial<ViewportScene> = {},
  ) {
    return render(() => (
      <div>
        <style>{styles}</style>
        {scene({ triggers, content, ...options })}
      </div>
    ));
  }

  describe('containers', () => {
    it('renders the content in the current container, and no transition attribute', async () => {
      await render(() =>
        scene({
          root: { defaultOpen: true, defaultTriggerId: 'first' },
          triggers: [{ id: 'first', payload: 'one' }],
          content,
        }),
      );

      const currentContainer = screen.getByTestId('content').closest('[data-current]');
      expect(currentContainer).not.toBe(null);
      expect(currentContainer).toHaveAttribute('data-current', 'true');
      expect(currentContainer!.textContent).toBe('Content one');
      expect(getPreviousContainer()).toBe(null);

      const viewport = screen.getByTestId('viewport');
      expect(viewport).not.toHaveAttribute('data-transitioning');
      expect(viewport).not.toHaveAttribute('data-activation-direction');
    });

    it('mounts the current container again when the active trigger changes', async () => {
      const { user } = await render(() =>
        scene({ triggers: [{ payload: 'one' }, { payload: 'two' }], content }),
      );

      await user.click(screen.getByTestId('trigger1'));
      const firstContainer = getCurrentContainer();
      expect(firstContainer!.textContent).toBe('Content one');

      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getCurrentContainer()!.textContent).toBe('Content two');
      });
      expect(getCurrentContainer()).not.toBe(firstContainer);
    });

    it('renders the containers in the element of the render slot', async () => {
      await render(() => (
        <PopupRootPart defaultOpen>
          <PopupPositionerPart>
            <PopupPart>
              <PopupViewportPart
                v-slots={{
                  render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                    <section {...props} data-testid="consumer">
                      {h(children, null, () => 'Content')}
                    </section>
                  ),
                }}
              />
            </PopupPart>
          </PopupPositionerPart>
        </PopupRootPart>
      ));

      const element = screen.getByTestId('consumer');
      expect(element.tagName).toBe('SECTION');
      expect(element.querySelector(':scope > [data-current]')!.textContent).toBe('Content');
    });
  });

  describe('morph', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    function renderPositioned(first: [number, number], second: [number, number], duration: string) {
      return renderMorph(getMorphAnimationStyles(duration), [
        { payload: 0, style: placeTrigger(...first) },
        { payload: 1, style: placeTrigger(...second) },
      ]);
    }

    it('shows the old content in the previous container while the new content enters', async () => {
      const { user } = await renderPositioned([10, 10], [100, 200], '0.3s');

      await user.click(screen.getByTestId('trigger1'));
      await waitFor(() => {
        expect(screen.getByText('Content 0')).toBeVisible();
      });
      const viewport = screen.getByTestId('viewport');
      expect(viewport).not.toHaveAttribute('data-transitioning');

      await user.click(screen.getByTestId('trigger2'));

      let previousContainer: HTMLElement | null = null;
      await waitFor(() => {
        previousContainer = getPreviousContainer();
        expect(previousContainer).not.toBe(null);
      });

      expect(viewport).toHaveAttribute('data-transitioning', '');
      expect(viewport.firstElementChild).toBe(previousContainer);
      expect(previousContainer).toHaveAttribute('inert');
      expect(previousContainer).toHaveAttribute('data-previous', 'true');
      expect(previousContainer!.textContent).toBe('Content 0');
      expect(previousContainer!.style.position).toBe('absolute');
      expect(previousContainer!.style.getPropertyValue('--popup-width')).toMatch(
        /^\d+(?:\.\d+)?px$/,
      );
      expect(previousContainer!.style.getPropertyValue('--popup-height')).toMatch(
        /^\d+(?:\.\d+)?px$/,
      );
      expect(getCurrentContainer()!.textContent).toBe('Content 1');

      await waitFor(() => {
        expect(getPreviousContainer()).toBe(null);
      });
      expect(viewport).not.toHaveAttribute('data-transitioning');
      expect(screen.getByText('Content 1')).toBeVisible();
    });

    it('gives the starting style to the new content, and the ending style to the old content one frame later', async () => {
      const { user } = await renderPositioned([10, 10], [100, 200], '0.3s');
      await user.click(screen.getByTestId('trigger1'));
      await waitFor(() => {
        expect(screen.getByText('Content 0')).toBeVisible();
      });

      const states: Array<{ starting: boolean; ending: boolean }> = [];
      const observer = new MutationObserver(() => {
        const previous = getPreviousContainer();
        const current = getCurrentContainer();
        if (previous && current) {
          states.push({
            starting: current.hasAttribute('data-starting-style'),
            ending: previous.hasAttribute('data-ending-style'),
          });
        }
      });
      observer.observe(screen.getByTestId('viewport'), {
        subtree: true,
        childList: true,
        attributes: true,
      });
      onTestFinished(() => observer.disconnect());

      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(states.at(-1)).toEqual({ starting: false, ending: true });
      });
      expect(states[0]).toEqual({ starting: true, ending: false });
    });

    it('sets the activation direction from the old trigger to the new trigger', async () => {
      const { user } = await renderPositioned([100, 200], [10, 10], '0.2s');

      await user.click(screen.getByTestId('trigger1'));
      await waitFor(() => {
        expect(screen.getByText('Content 0')).toBeVisible();
      });
      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getActivationDirectionTokens(screen.getByTestId('viewport'))).toEqual([
          'left',
          'up',
        ]);
      });
    });

    // The anchor does not change with the trigger, so no position pass reads the layout after the
    // render. The viewport itself must make the browser compute the starting style.
    it('computes the starting style, so that each container starts a transition', async () => {
      const { user } = await render(() => (
        <div>
          <style>{MORPH_TRANSITION_STYLES}</style>
          <div data-testid="anchor" style={{ position: 'absolute', top: '300px', left: '300px' }} />
          {scene({
            triggers: [{}, {}],
            positioner: { anchor: () => screen.getByTestId('anchor') },
            content: () => 'Content',
          })}
        </div>
      ));
      await user.click(screen.getByTestId('trigger1'));
      const runs = recordTransitionRuns(screen.getByTestId('viewport'));

      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getRunProperties(runs, getCurrentContainer())).toEqual(['opacity', 'transform']);
      });
      expect(getRunProperties(runs, getPreviousContainer())).toEqual(['opacity', 'transform']);
    });

    it('keeps the latest transition active during rapid trigger changes', async () => {
      const { user } = await renderMorph(getMorphAnimationStyles('10s'), [
        { payload: 1 },
        { payload: 2 },
        { payload: 3 },
      ]);
      await user.click(screen.getByTestId('trigger1'));
      await nextEvent(screen.getByTestId('viewport'), 'animationstart', {
        action: () => user.click(screen.getByTestId('trigger2')),
      });
      // The wait for the end of the animations must begin before the next change.
      await waitSingleFrame();

      await user.click(screen.getByTestId('trigger3'));
      await waitSingleFrame();

      expect(getCurrentContainer()!.textContent).toBe('Content 3');
      expect(getCurrentContainer()!.getAnimations()).toHaveLength(1);
      expect(screen.getByTestId('viewport')).toHaveAttribute('data-transitioning', '');
      expect(getPreviousContainer()!.textContent).toBe('Content 2');

      await waitFor(() => {
        expect(getPreviousContainer()).toHaveAttribute('data-ending-style', '');
      });
      expect(getCurrentContainer()).not.toHaveAttribute('data-starting-style');
    });

    it('cleans up the transition when a payload that comes later mounts the current container again', async () => {
      const payload = shallowRef<string | undefined>(undefined);
      const { user } = await render(() => (
        <div>
          <style>{MORPH_TRANSITION_STYLES}</style>
          {scene({
            triggers: [{}, { payload: payload.value }],
            content,
          })}
        </div>
      ));
      await user.click(screen.getByTestId('trigger1'));
      const runs = recordTransitionRuns(screen.getByTestId('viewport'));
      await user.click(screen.getByTestId('trigger2'));
      await waitFor(() => {
        expect(getRunProperties(runs, getPreviousContainer())).toEqual(['opacity', 'transform']);
      });
      // The wait for the end of the animations must begin before the container is replaced.
      await waitSingleFrame();
      await waitSingleFrame();
      const containerBeforePayload = getCurrentContainer();

      payload.value = 'ready';

      await waitFor(() => {
        expect(getCurrentContainer()).not.toBe(containerBeforePayload);
      });
      expect(getCurrentContainer()!.textContent).toBe('Content ready');
      await waitFor(() => {
        expect(getRunProperties(runs, getCurrentContainer())).toEqual(['opacity', 'transform']);
      });
      for (let frame = 0; frame < 4; frame += 1) {
        await waitSingleFrame();
      }
      expect(getPreviousContainer()).not.toBe(null);

      finishAnimations();

      await waitFor(() => {
        expect(getPreviousContainer()).toBe(null);
      });
      expect(screen.getByTestId('viewport')).not.toHaveAttribute('data-transitioning');
    });
  });

  describe('closed popup', () => {
    it('starts no transition when the active trigger mounts again while a kept popup is closed', async () => {
      const triggerKey = shallowRef('a');
      const root = shallowRef<ViewportRootInstance | null>(null);
      await render(() =>
        scene({
          root: {
            defaultOpen: true,
            defaultTriggerId: 'trigger',
            ref: root,
            onOpenChange(open: boolean, details: { preventUnmountOnClose(): void }) {
              if (!open) {
                details.preventUnmountOnClose();
              }
            },
          },
          triggers: [{ key: triggerKey.value, id: 'trigger' }],
          content,
        }),
      );

      root.value!.close();
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      });

      triggerKey.value = 'b';
      await flushMicrotasks();

      expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      expect(screen.getByTestId('viewport')).not.toHaveAttribute('data-transitioning');
      expect(getPreviousContainer()).toBe(null);
    });

    it('morphs again when a kept popup closes and opens again', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const root = shallowRef<ViewportRootInstance | null>(null);
      const { user } = await renderMorph(
        getMorphAnimationStyles('0.2s'),
        [
          { payload: 0, style: placeTrigger(10, 10) },
          { payload: 1, style: placeTrigger(100, 200) },
        ],
        { keepMounted: true, root: { ref: root } },
      );
      await user.click(screen.getByTestId('trigger1'));
      await waitFor(() => {
        expect(screen.getByText('Content 0')).toBeVisible();
      });
      await user.click(screen.getByTestId('trigger2'));
      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });
      await waitFor(() => {
        expect(getPreviousContainer()).toBe(null);
      });

      root.value!.close();
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('hidden');
      });

      await user.click(screen.getByTestId('trigger1'));
      await waitFor(() => {
        expect(screen.getByText('Content 0')).toBeVisible();
      });
      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });
      expect(getPreviousContainer()!.textContent).toBe('Content 0');
      expect(getCurrentContainer()!.textContent).toBe('Content 1');
    });
  });

  describe('the old content in the previous container', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    // The viewport copies the old content before Vue renders the change, in each order of the
    // trigger and the popup.
    it('has the old content when the triggers are in the root before the popup', async () => {
      const { user } = await renderMorph(getMorphAnimationStyles('10s'), [
        { payload: 'first' },
        { payload: 'second' },
      ]);
      await user.click(screen.getByTestId('trigger1'));

      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });
      expect(getPreviousContainer()!.textContent).toBe('Content first');
      expect(getCurrentContainer()!.textContent).toBe('Content second');
    });

    it('has the old content when the triggers are detached and come after the popup', async () => {
      const handle = createPopupFixtureHandle<unknown>();
      const { user } = await renderMorph(
        getMorphAnimationStyles('10s'),
        [{ payload: 'first' }, { payload: 'second' }],
        { handle },
      );
      await user.click(screen.getByTestId('trigger1'));

      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });
      expect(getPreviousContainer()!.textContent).toBe('Content first');
      expect(getCurrentContainer()!.textContent).toBe('Content second');
    });

    it('has the old content when the payload comes one flush later', async () => {
      const payload = shallowRef<string | undefined>(undefined);
      const { user } = await render(() => (
        <div>
          <style>{getMorphAnimationStyles('10s')}</style>
          {scene({ triggers: [{ payload: 'first' }, { payload: payload.value }], content })}
        </div>
      ));
      await user.click(screen.getByTestId('trigger1'));
      await user.click(screen.getByTestId('trigger2'));
      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });

      payload.value = 'second';

      await waitFor(() => {
        expect(getCurrentContainer()!.textContent).toBe('Content second');
      });
      expect(getPreviousContainer()!.textContent).toBe('Content first');
    });
  });

  describe('VUE-39: mounts of the content for a change of the trigger', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    function createTrackedContent() {
      const mounted: Array<string | undefined> = [];
      const Tracked = defineComponent({
        props: { payload: { type: String, default: undefined } },
        setup(props) {
          onMounted(() => {
            mounted.push(props.payload);
          });
          return () => <span>Content {props.payload}</span>;
        },
      });
      return {
        mounted,
        renderContent: (payload: unknown) => <Tracked payload={payload as string | undefined} />,
      };
    }

    it.each([
      { name: 'in the root before the popup', detached: false },
      { name: 'that is detached after the popup', detached: true },
    ])('mounts the content one time for a trigger $name', async ({ detached }) => {
      const { mounted, renderContent } = createTrackedContent();
      const handle = detached ? createPopupFixtureHandle<unknown>() : undefined;
      const { user } = await render(() => (
        <div>
          <style>{getMorphAnimationStyles('10s')}</style>
          {scene({
            handle,
            triggers: [{ payload: 'first' }, { payload: 'second' }],
            content: renderContent,
          })}
        </div>
      ));
      await user.click(screen.getByTestId('trigger1'));
      await waitFor(() => {
        expect(getCurrentContainer()!.textContent).toBe('Content first');
      });
      mounted.length = 0;

      await user.click(screen.getByTestId('trigger2'));
      await waitFor(() => {
        expect(getCurrentContainer()!.textContent).toBe('Content second');
      });
      await waitSingleFrame();

      expect(mounted).toEqual(['second']);
    });

    // The key of a popup with no active trigger starts with `current`. A trigger with that id
    // would keep the key if the count did not rise.
    it('mounts the content again when the first trigger has the id `current`', async () => {
      const { mounted, renderContent } = createTrackedContent();
      await render(() =>
        scene({
          root: { defaultOpen: true },
          triggers: [{ id: 'current', payload: 'first' }],
          content: renderContent,
        }),
      );

      await waitFor(() => {
        expect(getCurrentContainer()!.textContent).toBe('Content first');
      });

      expect(mounted).toEqual([undefined, 'first']);
    });

    it('mounts the content again when the payload comes after the change of the trigger', async () => {
      const { mounted, renderContent } = createTrackedContent();
      const payload = shallowRef<string | undefined>(undefined);
      const { user } = await render(() => (
        <div>
          <style>{getMorphAnimationStyles('10s')}</style>
          {scene({ triggers: [{}, { payload: payload.value }], content: renderContent })}
        </div>
      ));
      await user.click(screen.getByTestId('trigger1'));
      await waitFor(() => {
        expect(getCurrentContainer()!.textContent).toBe('Content ');
      });
      mounted.length = 0;

      await user.click(screen.getByTestId('trigger2'));
      await waitSingleFrame();
      payload.value = 'ready';
      await waitFor(() => {
        expect(getCurrentContainer()!.textContent).toBe('Content ready');
      });
      await waitSingleFrame();

      expect(mounted).toEqual([undefined, 'ready']);
    });
  });

  describe('the picture of the old content', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    it('VUE-38: has the DOM of the time of the change, with what a component changed by itself', async () => {
      const Counter = defineComponent({
        setup() {
          const count = shallowRef(0);
          return () => (
            <button
              type="button"
              data-testid="counter"
              onClick={() => {
                count.value += 1;
              }}
            >
              Count {count.value}
            </button>
          );
        },
      });
      const { user } = await renderMorph(
        getMorphAnimationStyles('10s'),
        [{ payload: 'first' }, { payload: 'second' }],
        { content: () => <Counter /> },
      );
      await user.click(screen.getByTestId('trigger1'));
      await user.click(screen.getByTestId('counter'));
      await user.click(screen.getByTestId('counter'));
      await user.click(screen.getByTestId('counter'));
      expect(screen.getByTestId('counter')).toHaveTextContent('Count 3');

      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });
      expect(getPreviousContainer()!.textContent).toBe('Count 3');
      expect(getCurrentContainer()!.textContent).toBe('Count 0');
    });
  });

  describe('VUE-40: the picture has no id and no control name', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    it('has the id of an HTML element one time during the morph, in the current container', async () => {
      const { user } = await renderMorph(
        getMorphAnimationStyles('10s'),
        [{ payload: 'first' }, { payload: 'second' }],
        { content: (payload) => <h2 id="title">Title {String(payload)}</h2> },
      );
      await user.click(screen.getByTestId('trigger1'));

      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });
      expect(getPreviousContainer()!.textContent).toBe('Title first');
      const titles = document.querySelectorAll('[id="title"]');
      expect(titles).toHaveLength(1);
      expect(getCurrentContainer()!.contains(titles[0])).toBe(true);
    });

    it('keeps the id of an SVG element, because url(#id) paints by it', async () => {
      const { user } = await renderMorph(
        getMorphAnimationStyles('10s'),
        [{ payload: 'first' }, { payload: 'second' }],
        {
          content: () => (
            <svg width="10" height="10">
              <defs>
                <linearGradient id="gradient" />
              </defs>
              <rect width="10" height="10" fill="url(#gradient)" />
            </svg>
          ),
        },
      );
      await user.click(screen.getByTestId('trigger1'));

      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });
      expect(getPreviousContainer()!.querySelector('linearGradient')).toHaveAttribute(
        'id',
        'gradient',
      );
    });

    it('keeps the radio of the current container checked while the picture has a checked radio', async () => {
      const { user } = await renderMorph(
        getMorphAnimationStyles('10s'),
        [{ payload: 'first' }, { payload: 'second' }],
        { content: () => <input type="radio" name="choice" checked /> },
      );
      await user.click(screen.getByTestId('trigger1'));
      expect(getCurrentContainer()!.querySelector('input')!.checked).toBe(true);

      await user.click(screen.getByTestId('trigger2'));

      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });
      expect(getPreviousContainer()!.querySelector('input')).not.toHaveAttribute('name');
      expect(getCurrentContainer()!.querySelector('input')!.checked).toBe(true);
    });
  });

  describe('a viewport that replaces another viewport', () => {
    it('leaves the middleware of the adaptive origin in the store', async () => {
      const swapped = shallowRef(false);
      const root = shallowRef<ViewportRootInstance | null>(null);
      await render(() => (
        <PopupRootPart open ref={root}>
          <PopupPositionerPart>
            <PopupViewportReplace swapped={swapped.value} />
          </PopupPositionerPart>
        </PopupRootPart>
      ));
      const store = root.value!.store;
      expect(screen.getByTestId('old')).toBeInTheDocument();
      expect(toRaw(store.state).adaptiveOrigin).toBe(adaptiveOrigin);

      swapped.value = true;
      await flushMicrotasks();

      expect(screen.queryByTestId('old')).toBe(null);
      expect(screen.getByTestId('new')).toBeInTheDocument();
      expect(toRaw(store.state).adaptiveOrigin).toBe(adaptiveOrigin);
    });

    it('writes the middleware of the adaptive origin before the content mounts', async () => {
      const seen: unknown[] = [];
      const Probe = defineComponent({
        setup() {
          seen.push(toRaw(inject(PopupFixtureContext)!.state).adaptiveOrigin);
          return () => null;
        },
      });
      await render(() =>
        scene({
          root: { defaultOpen: true, defaultTriggerId: 'trigger' },
          triggers: [{ id: 'trigger' }],
          content: () => <Probe />,
        }),
      );

      expect(seen).toEqual([adaptiveOrigin]);
    });

    it('clears the middleware of the adaptive origin when the viewport unmounts', async () => {
      const shown = shallowRef(true);
      const root = shallowRef<ViewportRootInstance | null>(null);
      await render(() => (
        <PopupRootPart open ref={root}>
          <PopupPositionerPart>{shown.value ? <PopupViewportPart /> : null}</PopupPositionerPart>
        </PopupRootPart>
      ));
      const store = root.value!.store;
      expect(toRaw(store.state).adaptiveOrigin).toBe(adaptiveOrigin);

      shown.value = false;
      await flushMicrotasks();

      expect(toRaw(store.state).adaptiveOrigin).toBe(undefined);
    });
  });

  describe('the position of the popup', () => {
    it('anchors the positioner from the far edge while it transitions', async () => {
      await render(() => (
        <div>
          <style>{'[data-testid="positioner"] { transition: transform 100ms; }'}</style>
          {scene({
            root: { defaultOpen: true, defaultTriggerId: 'trigger' },
            // The trigger leaves room on the left, so the popup does not flip.
            triggers: [
              {
                id: 'trigger',
                style: { position: 'fixed', top: '200px', left: '300px' },
              },
            ],
            positioner: { side: 'left', positionMethod: 'fixed' },
            content: () => 'Content',
          })}
        </div>
      ));
      const positioner = screen.getByTestId('positioner');

      await waitFor(() => {
        expect(positioner).toHaveAttribute('data-side', 'left');
      });
      await waitFor(() => {
        expect(positioner.style.right).not.toBe('');
      });
      expect(positioner.style.left).toBe('');
    });
  });

  describe('KeepAlive', () => {
    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    it('has no morph when the popup comes back after a deactivation during the morph', async () => {
      const kept = createKeptScene(() => ({
        root: { defaultOpen: true, defaultTriggerId: 'first' },
        triggers: [
          { id: 'first', payload: 0, style: placeTrigger(10, 10) },
          { id: 'second', payload: 1, style: placeTrigger(100, 200) },
        ],
        content,
      }));
      const { user } = await render(() => (
        <div>
          <style>{getMorphAnimationStyles('10s')}</style>
          {kept.render()}
        </div>
      ));
      await user.click(screen.getByTestId('trigger2'));
      await waitFor(() => {
        expect(getPreviousContainer()).not.toBe(null);
      });

      kept.visible.value = false;
      await flushMicrotasks();
      kept.visible.value = true;
      await flushMicrotasks();

      await waitFor(() => {
        expect(getPreviousContainer()).toBe(null);
      });
      expect(screen.getByTestId('viewport')).not.toHaveAttribute('data-transitioning');
    });
  });

  describe('hydration', () => {
    const file = 'src/utils/popups/viewport/PopupViewportHydration.test.vue';

    it('keeps the server node of the current container', async () => {
      // The popup gets its position after the two ticks of the `hydrate` helper, so the test
      // hydrates by hand and waits for the position.
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = await renderOnServer(file);
      const current = container.querySelector('[data-current]')!;
      expect(current).toHaveAttribute('data-current', 'true');
      expect(current.textContent).toBe('content');

      const app = createSSRApp(PopupViewportHydration);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitFor(() => {
        expect(
          container.querySelector<HTMLElement>('[data-testid="positioner"]')!.style.opacity,
        ).toBe('');
      });
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(container.querySelector('[data-current]')).toBe(current);
      expect(takeReportedMessages()).toEqual([]);
    });
  });
});
