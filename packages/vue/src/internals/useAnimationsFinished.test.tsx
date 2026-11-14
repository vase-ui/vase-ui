import { afterEach, beforeEach, expect, vi, describe, it, onTestFinished } from 'vitest';
import { Teleport, defineComponent, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { createRenderer, flushMicrotasks, isJSDOM, screen, waitFor } from '#test-utils';
import { useAnimationsFinished } from './useAnimationsFinished';

const mockedAnimations = new Map<Element, () => Animation[]>();

afterEach(() => {
  mockedAnimations.clear();
  Reflect.deleteProperty(document, 'getAnimations');
});

/**
 * Mocks the element's animations. Elements checked in the same frame can be looked up through
 * `document.getAnimations()`, so it returns the mocked animations too.
 */
function mockAnimations(element: Element, getAnimations: () => Animation[]) {
  element.getAnimations = getAnimations;
  mockedAnimations.set(element, getAnimations);
  document.getAnimations = () =>
    Array.from(mockedAnimations, ([target, getTargetAnimations]) =>
      getTargetAnimations().map(
        (animation) =>
          // eslint-disable-next-line @typescript-eslint/no-misused-spread -- The mock copies each `Animation` into a plain object on purpose.
          ({ ...animation, effect: { ...animation.effect, target } }) as unknown as Animation,
      ),
    ).flat();
}

function createAnimation(iterations = 1, duration = 1) {
  let resolveFinished!: () => void;
  let rejectFinished!: () => void;

  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  return {
    animation: {
      finished,
      effect: { getTiming: () => ({ duration, iterations }) },
      pending: false,
      playState: 'running',
    } as unknown as Animation,
    finish: resolveFinished,
    cancel: rejectFinished,
  };
}

interface TestProps {
  getAnimations: () => Animation[];
  onFinished: () => void;
  signal?: AbortSignal;
  batch?: boolean;
}

const Test = defineComponent(
  (props: TestProps) => {
    const element = shallowRef<HTMLDivElement | null>(null);
    const runOnceAnimationsFinish = useAnimationsFinished(element, false, props.batch);

    onMounted(() => {
      if (element.value) {
        mockAnimations(element.value, props.getAnimations);
      }
    });

    onMounted(() => {
      runOnceAnimationsFinish(props.onFinished, props.signal ?? null);
    });

    return () => <div ref={element} />;
  },
  { props: ['getAnimations', 'onFinished', 'signal', 'batch'] },
);

describe('useAnimationsFinished', () => {
  const { render } = createRenderer();

  it.each(['finish', 'cancel'] as const)(
    'ignores infinite animations when a finite animation completes via %s',
    async (completion) => {
      const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const finite = createAnimation();
      const infinite = createAnimation(Infinity);
      const onFinished = vi.fn();
      let animations = [finite.animation, infinite.animation];
      const getAnimations = vi.fn(() => animations);

      try {
        await render(<Test getAnimations={getAnimations} onFinished={onFinished} />);
        await waitFor(() => expect(getAnimations).toHaveBeenCalled());
        expect(onFinished).not.toHaveBeenCalled();

        animations = [infinite.animation];
        finite[completion]();
        await flushMicrotasks();

        expect(onFinished).toHaveBeenCalledTimes(1);
      } finally {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
      }
    },
  );

  it.each([
    ['iteration count', Infinity, 1],
    ['duration', 1, Infinity],
  ] as const)(
    'finishes when the element only has an animation with an infinite %s',
    async (_timing, iterations, duration) => {
      const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const infinite = createAnimation(iterations, duration);
      const onFinished = vi.fn();

      try {
        await render(<Test getAnimations={() => [infinite.animation]} onFinished={onFinished} />);
        await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));
      } finally {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
      }
    },
  );

  it('waits for a replacement animation after an animation is canceled', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const initialAnimation = createAnimation();
    const replacementAnimation = createAnimation();
    const infiniteAnimation = createAnimation(Infinity);
    const onFinished = vi.fn();
    let animations: Animation[] = [initialAnimation.animation, infiniteAnimation.animation];
    let getAnimationsCallCount = 0;

    try {
      await render(
        <Test
          getAnimations={() => {
            getAnimationsCallCount += 1;
            return animations;
          }}
          onFinished={onFinished}
        />,
      );

      await waitFor(() => {
        expect(getAnimationsCallCount).toBeGreaterThan(0);
      });

      animations = [replacementAnimation.animation, infiniteAnimation.animation];

      initialAnimation.cancel();
      await flushMicrotasks();

      expect(onFinished).not.toHaveBeenCalled();

      animations = [];

      replacementAnimation.finish();
      await flushMicrotasks();

      expect(onFinished).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('finishes when a canceled animation has no replacement', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const initialAnimation = createAnimation();
    const onFinished = vi.fn();
    let animations: Animation[] = [initialAnimation.animation];
    let getAnimationsCallCount = 0;

    try {
      await render(
        <Test
          getAnimations={() => {
            getAnimationsCallCount += 1;
            return animations;
          }}
          onFinished={onFinished}
        />,
      );

      await waitFor(() => {
        expect(getAnimationsCallCount).toBeGreaterThan(0);
      });

      animations = [];

      initialAnimation.cancel();
      await flushMicrotasks();

      expect(onFinished).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('batches opted-in callbacks that finish in the same microtask into a single commit', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const first = createAnimation();
    const second = createAnimation();
    const getAnimationsCallCounts = [0, 0];

    const Item = defineComponent(
      (props: { index: number; animation: Animation }) => {
        const element = shallowRef<HTMLDivElement | null>(null);
        const runOnceAnimationsFinish = useAnimationsFinished(element, false, true);
        const mounted = shallowRef(true);

        onMounted(() => {
          if (element.value) {
            mockAnimations(element.value, () => {
              getAnimationsCallCounts[props.index] += 1;
              return [props.animation];
            });
          }
        });

        onMounted(() => {
          runOnceAnimationsFinish(() => {
            mounted.value = false;
          });
        });

        return () =>
          mounted.value ? <div data-testid={`item-${props.index}`} ref={element} /> : null;
      },
      { props: ['index', 'animation'] },
    );

    try {
      const { container } = await render(
        <>
          <Item index={0} animation={first.animation} />
          <Item index={1} animation={second.animation} />
        </>,
      );

      // One Vue flush changes the DOM in one task, so it calls the observer one time.
      let commitCount = 0;
      const observer = new MutationObserver(() => {
        commitCount += 1;
      });
      observer.observe(container, { childList: true, subtree: true });
      onTestFinished(() => observer.disconnect());

      await waitFor(() => {
        expect(getAnimationsCallCounts[0]).toBeGreaterThan(0);
      });
      await waitFor(() => {
        expect(getAnimationsCallCounts[1]).toBeGreaterThan(0);
      });

      const commitCountBefore = commitCount;

      first.finish();
      second.finish();
      await flushMicrotasks();

      expect(screen.queryByTestId('item-0')).toBeNull();
      expect(screen.queryByTestId('item-1')).toBeNull();
      expect(commitCount).toBe(commitCountBefore + 1);
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('skips a callback whose signal aborts while the batch is flushing', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const first = createAnimation();
    const second = createAnimation();
    const secondController = new AbortController();
    const onFirstFinished = vi.fn(() => secondController.abort());
    const onSecondFinished = vi.fn();
    const firstGetAnimations = vi.fn(() => [first.animation]);
    const secondGetAnimations = vi.fn(() => [second.animation]);

    try {
      await render(
        <>
          <Test batch getAnimations={firstGetAnimations} onFinished={onFirstFinished} />
          <Test
            batch
            getAnimations={secondGetAnimations}
            onFinished={onSecondFinished}
            signal={secondController.signal}
          />
        </>,
      );

      await waitFor(() => {
        expect(firstGetAnimations).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(secondGetAnimations).toHaveBeenCalled();
      });

      first.finish();
      second.finish();
      await flushMicrotasks();

      expect(onFirstFinished).toHaveBeenCalledTimes(1);
      expect(onSecondFinished).not.toHaveBeenCalled();
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('commits each callback separately by default so later callbacks observe earlier updates', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const first = createAnimation();
    const second = createAnimation();
    const firstGetAnimations = vi.fn(() => [first.animation]);
    const secondGetAnimations = vi.fn(() => [second.animation]);
    const onSecondUnmount = vi.fn();

    interface PopupProps {
      open: boolean;
      getAnimations: () => Animation[];
      onCloseComplete: () => void;
    }

    // Mirrors `useOpenChangeComplete`: the completion reads the latest `open` and only
    // unmounts while the popup is still closed.
    const Popup = defineComponent(
      (props: PopupProps) => {
        const element = shallowRef<HTMLDivElement | null>(null);
        const runOnceAnimationsFinish = useAnimationsFinished(element);

        const onComplete = () => {
          if (!props.open) {
            props.onCloseComplete();
          }
        };

        onMounted(() => {
          if (element.value) {
            mockAnimations(element.value, props.getAnimations);
          }
        });

        let abortController: AbortController | undefined;
        function run() {
          abortController?.abort();
          abortController = new AbortController();
          runOnceAnimationsFinish(onComplete, abortController.signal);
        }
        onMounted(run);
        watch(() => props.open, run, { flush: 'post' });
        onBeforeUnmount(() => abortController?.abort());

        return () => <div ref={element} />;
      },
      { props: ['open', 'getAnimations', 'onCloseComplete'] },
    );

    const App = defineComponent(() => {
      const secondOpen = shallowRef(false);
      return () => (
        <>
          <Popup
            open={false}
            getAnimations={firstGetAnimations}
            onCloseComplete={() => {
              secondOpen.value = true;
            }}
          />
          <Popup
            open={secondOpen.value}
            getAnimations={secondGetAnimations}
            onCloseComplete={onSecondUnmount}
          />
        </>
      );
    });

    try {
      await render(<App />);

      await waitFor(() => {
        expect(firstGetAnimations).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(secondGetAnimations).toHaveBeenCalled();
      });

      // Both popups are closing. The first popup's close completion reopens the second,
      // which must prevent the second popup's queued completion from unmounting it.
      first.finish();
      second.finish();
      await flushMicrotasks();

      expect(onSecondUnmount).not.toHaveBeenCalled();
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('skips a callback whose signal aborts while an earlier callback runs by default', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const first = createAnimation();
    const second = createAnimation();
    const secondController = new AbortController();
    const onFirstFinished = vi.fn(() => secondController.abort());
    const onSecondFinished = vi.fn();
    const firstGetAnimations = vi.fn(() => [first.animation]);
    const secondGetAnimations = vi.fn(() => [second.animation]);

    try {
      await render(
        <>
          <Test getAnimations={firstGetAnimations} onFinished={onFirstFinished} />
          <Test
            getAnimations={secondGetAnimations}
            onFinished={onSecondFinished}
            signal={secondController.signal}
          />
        </>,
      );

      await waitFor(() => {
        expect(firstGetAnimations).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(secondGetAnimations).toHaveBeenCalled();
      });

      first.finish();
      second.finish();
      await flushMicrotasks();

      expect(onFirstFinished).toHaveBeenCalledTimes(1);
      expect(onSecondFinished).not.toHaveBeenCalled();
    } finally {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('reports the error of a callback that throws and runs the callbacks after it by default', async () => {
    const animationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

    const first = createAnimation();
    const second = createAnimation();
    const error = new Error('The first callback failed.');
    const onFirstFinished = vi.fn(() => {
      throw error;
    });
    const onSecondFinished = vi.fn();
    const firstGetAnimations = vi.fn(() => [first.animation]);
    const secondGetAnimations = vi.fn(() => [second.animation]);
    // Without a spy, the error reaches the page and the test run fails.
    const reportErrorSpy = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {});

    try {
      await render(
        <>
          <Test getAnimations={firstGetAnimations} onFinished={onFirstFinished} />
          <Test getAnimations={secondGetAnimations} onFinished={onSecondFinished} />
        </>,
      );

      await waitFor(() => {
        expect(firstGetAnimations).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(secondGetAnimations).toHaveBeenCalled();
      });

      first.finish();
      second.finish();
      await flushMicrotasks();

      expect(onFirstFinished).toHaveBeenCalledTimes(1);
      expect(onSecondFinished).toHaveBeenCalledTimes(1);
      expect(reportErrorSpy).toHaveBeenCalledExactlyOnceWith(error);
    } finally {
      reportErrorSpy.mockRestore();
      globalThis.VASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  describe.skipIf(isJSDOM)('elements checked in the same frame', () => {
    const FADE: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

    interface WatchedElement {
      onFinished: () => void;
      animate?: ((element: HTMLElement) => Animation | Animation[]) | undefined;
      signal?: AbortSignal | undefined;
    }

    const Watched = defineComponent(
      (props: WatchedElement) => {
        const element = shallowRef<HTMLDivElement | null>(null);
        const runOnceAnimationsFinish = useAnimationsFinished(element);

        let animations: Animation[] = [];
        onMounted(() => {
          animations = [props.animate?.(element.value!) ?? []].flat();
        });
        onBeforeUnmount(() => {
          animations.forEach((animation) => animation.cancel());
        });

        onMounted(() => {
          runOnceAnimationsFinish(props.onFinished, props.signal ?? null);
        });

        return () => <div ref={element} />;
      },
      { props: ['onFinished', 'animate', 'signal'] },
    );

    function createWatchedElements(timings: (KeyframeAnimationOptions | null)[]) {
      const animations: Animation[] = [];
      const elements: WatchedElement[] = timings.map((timing, index) => ({
        onFinished: vi.fn(),
        animate: timing
          ? (element: HTMLElement) => {
              animations[index] = element.animate(FADE, timing);
              return animations[index];
            }
          : undefined,
      }));
      return { animations, elements };
    }

    function renderWatched(elements: WatchedElement[]) {
      return (
        <>
          {elements.map((element, index) => (
            <Watched key={index} {...element} />
          ))}
        </>
      );
    }

    function spyOnLookups() {
      const getDocumentAnimations = vi.spyOn(document, 'getAnimations');
      const getElementAnimations = vi.spyOn(Element.prototype, 'getAnimations');
      onTestFinished(() => {
        getDocumentAnimations.mockRestore();
        getElementAnimations.mockRestore();
      });
      return { getDocumentAnimations, getElementAnimations };
    }

    beforeEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
    });

    it('serves the other elements of the tree with one root lookup once one has animations', async () => {
      const { getDocumentAnimations, getElementAnimations } = spyOnLookups();

      const { animations, elements } = createWatchedElements([
        { duration: 1000, iterations: Infinity },
        { duration: 10_000 },
        { duration: 10_000 },
      ]);
      await render(renderWatched(elements));

      await waitFor(() => {
        expect(getDocumentAnimations).toHaveBeenCalledTimes(1);
      });
      expect(getElementAnimations).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(elements[0].onFinished).toHaveBeenCalledTimes(1);
      });
      expect(elements[1].onFinished).not.toHaveBeenCalled();
      expect(elements[2].onFinished).not.toHaveBeenCalled();

      animations[2].finish();
      await flushMicrotasks();

      expect(elements[2].onFinished).toHaveBeenCalledTimes(1);
      expect(elements[1].onFinished).not.toHaveBeenCalled();
    });

    it('ignores animations of pseudo-elements in the root lookup', async () => {
      const { getDocumentAnimations } = spyOnLookups();

      const { elements } = createWatchedElements([
        { duration: 10_000 },
        { duration: 10_000, pseudoElement: '::after' },
        null,
      ]);
      await render(renderWatched(elements));

      await waitFor(() => {
        expect(elements[1].onFinished).toHaveBeenCalledTimes(1);
      });
      expect(getDocumentAnimations).toHaveBeenCalledTimes(1);
      expect(elements[0].onFinished).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'no animations', timing: null },
      {
        name: 'only pseudo-element animations',
        timing: { duration: 10_000, pseudoElement: '::after' },
      },
    ])('looks up each element on its own when they have $name', async ({ timing }) => {
      const { getDocumentAnimations } = spyOnLookups();

      const { elements } = createWatchedElements([timing, timing, timing]);
      await render(renderWatched(elements));

      await waitFor(() => {
        expect(elements[2].onFinished).toHaveBeenCalledTimes(1);
      });
      expect(elements[0].onFinished).toHaveBeenCalledTimes(1);
      expect(elements[1].onFinished).toHaveBeenCalledTimes(1);
      expect(getDocumentAnimations).not.toHaveBeenCalled();
    });

    it('waits for every animation of an element served by the root lookup', async () => {
      const { getDocumentAnimations } = spyOnLookups();
      let firstAnimation: Animation;
      let secondAnimation: Animation;
      const { elements } = createWatchedElements([{ duration: 10_000 }, null, null]);
      elements[1].animate = (element) => {
        firstAnimation = element.animate(FADE, 10_000);
        secondAnimation = element.animate(FADE, 10_000);
        return [firstAnimation, secondAnimation];
      };
      await render(renderWatched(elements));

      await waitFor(() => {
        expect(getDocumentAnimations).toHaveBeenCalledTimes(1);
      });

      secondAnimation!.finish();
      await flushMicrotasks();
      expect(elements[1].onFinished).not.toHaveBeenCalled();

      firstAnimation!.finish();
      await flushMicrotasks();
      expect(elements[1].onFinished).toHaveBeenCalledTimes(1);
    });

    it.each([
      { name: 'a single animated element', timings: [{ duration: 10_000 }] },
      {
        name: 'two animated elements',
        timings: [{ duration: 10_000 }, { duration: 10_000 }],
      },
      {
        name: 'an animated element followed by a nonanimated element',
        timings: [{ duration: 10_000 }, null],
      },
      {
        name: 'a nonanimated element followed by an animated element',
        timings: [null, { duration: 10_000 }],
      },
      {
        name: 'three elements with one left after the animated one',
        timings: [null, { duration: 10_000 }, null],
      },
    ])('looks up $name individually without scanning the root', async ({ timings }) => {
      const { getDocumentAnimations, getElementAnimations } = spyOnLookups();

      const { animations, elements } = createWatchedElements(timings);
      await render(renderWatched(elements));

      await waitFor(() => {
        expect(getElementAnimations).toHaveBeenCalledTimes(elements.length);
      });
      expect(getDocumentAnimations).not.toHaveBeenCalled();
      const animatedIndex = timings.findIndex((timing) => timing !== null);
      expect(elements[animatedIndex].onFinished).not.toHaveBeenCalled();

      animations.forEach((animation) => animation.finish());
      await flushMicrotasks();

      expect(elements[0].onFinished).toHaveBeenCalledTimes(1);
      expect(elements.at(-1)!.onFinished).toHaveBeenCalledTimes(1);
    });

    it('looks up an element checked twice once and counts it once toward the root lookup', async () => {
      const { getDocumentAnimations, getElementAnimations } = spyOnLookups();
      const onFirstFinished = vi.fn();
      const onSecondFinished = vi.fn();
      const { elements } = createWatchedElements([null]);
      let animation: Animation | undefined;

      const TwiceWatched = defineComponent(() => {
        const element = shallowRef<HTMLDivElement | null>(null);
        const runFirst = useAnimationsFinished(element);
        const runSecond = useAnimationsFinished(element);

        onMounted(() => {
          animation = element.value!.animate(FADE, { duration: 10_000 });
        });
        onBeforeUnmount(() => animation?.cancel());

        onMounted(() => {
          runFirst(onFirstFinished);
          runSecond(onSecondFinished);
        });

        return () => <div ref={element} />;
      });

      await render(
        <>
          <TwiceWatched />
          {renderWatched(elements)}
        </>,
      );

      await waitFor(() => {
        expect(elements[0].onFinished).toHaveBeenCalledTimes(1);
      });
      expect(getElementAnimations).toHaveBeenCalledTimes(2);
      expect(getDocumentAnimations).not.toHaveBeenCalled();
      expect(onFirstFinished).not.toHaveBeenCalled();
      expect(onSecondFinished).not.toHaveBeenCalled();

      animation!.finish();
      await flushMicrotasks();

      expect(onFirstFinished).toHaveBeenCalledTimes(1);
      expect(onSecondFinished).toHaveBeenCalledTimes(1);
    });

    it('skips the callback of an aborted element that was looked up with others', async () => {
      const { getDocumentAnimations } = spyOnLookups();
      const abortController = new AbortController();
      const { animations, elements } = createWatchedElements([
        { duration: 10_000 },
        { duration: 10_000 },
        { duration: 10_000 },
      ]);
      elements[1] = { ...elements[1], signal: abortController.signal };
      await render(renderWatched(elements));

      await waitFor(() => {
        expect(getDocumentAnimations).toHaveBeenCalledTimes(1);
      });
      abortController.abort();

      animations.forEach((animation) => animation.finish());
      await flushMicrotasks();

      expect(elements[0].onFinished).toHaveBeenCalledTimes(1);
      expect(elements[1].onFinished).not.toHaveBeenCalled();
      expect(elements[2].onFinished).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        name: 'a shadow root',
        createContainer() {
          const host = document.createElement('div');
          document.body.append(host);
          return { container: host.attachShadow({ mode: 'open' }), remove: () => host.remove() };
        },
      },
      {
        name: 'an iframe',
        createContainer() {
          const iframe = document.createElement('iframe');
          document.body.append(iframe);
          return { container: iframe.contentDocument!.body, remove: () => iframe.remove() };
        },
      },
    ])('looks up elements in $name through their own root', async ({ createContainer }) => {
      const { container, remove } = createContainer();
      const root = container.getRootNode() as Document | ShadowRoot;
      const getRootAnimations = vi.spyOn(root, 'getAnimations');
      const { getDocumentAnimations } = spyOnLookups();
      onTestFinished(remove);

      const { animations, elements } = createWatchedElements([
        { duration: 10_000 },
        { duration: 10_000 },
        { duration: 10_000 },
      ]);
      await render(<Teleport to={container}>{renderWatched(elements)}</Teleport>);

      await waitFor(() => {
        expect(getRootAnimations).toHaveBeenCalledTimes(1);
      });
      expect(getDocumentAnimations).not.toHaveBeenCalled();
      await flushMicrotasks();
      expect(elements[0].onFinished).not.toHaveBeenCalled();
      expect(elements[1].onFinished).not.toHaveBeenCalled();

      animations[1].finish();
      await flushMicrotasks();

      expect(elements[1].onFinished).toHaveBeenCalledTimes(1);
      expect(elements[0].onFinished).not.toHaveBeenCalled();
    });
  });
});
