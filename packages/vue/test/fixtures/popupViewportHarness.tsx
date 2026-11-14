import { defineComponent, KeepAlive, shallowRef } from 'vue';
import type { VNode } from 'vue';
import type { PopupFixtureHandle, PopupFixtureStore } from './PopupFixture';
import PopupPart from './PopupPart.vue';
import PopupPositionerPart from './PopupPositionerPart.vue';
import PopupRootPart from './PopupRootPart.vue';
import PopupTriggerPart from './PopupTriggerPart.vue';
import PopupViewportPart from './PopupViewportPart.vue';

export interface ViewportTrigger {
  id?: string;
  key?: string;
  payload?: unknown;
  style?: Record<string, string>;
}

/**
 * What the popup root exposes, as a test reads it through a function ref.
 */
export interface ViewportRootInstance {
  store: PopupFixtureStore<unknown>;
  close(): void;
}

export interface ViewportScene {
  /** The props of the root. A function `ref` gives the instance of the root. */
  root?: Record<string, unknown>;
  /** A handle for the root. The triggers then come after the root and take the handle. */
  handle?: PopupFixtureHandle<unknown>;
  /** The test ids of the triggers are `trigger1`, `trigger2` and so on. */
  triggers: ViewportTrigger[];
  /** Whether the positioner and the popup stay in the DOM while the popup is closed. */
  keepMounted?: boolean;
  positioner?: Record<string, unknown>;
  popup?: Record<string, unknown>;
  /** The children of the viewport. They get the payload of the active trigger. */
  content: (payload: unknown) => unknown;
}

/**
 * Makes the parts of a popup with a viewport: a root, its triggers, and the positioner, the popup
 * and the viewport. The test ids are `positioner`, `popup` and `viewport`. Call it in the render
 * function of the test, so that a change of the options renders the scene again.
 */
export function scene({
  root,
  handle,
  triggers,
  keepMounted,
  positioner,
  popup,
  content,
}: ViewportScene): VNode {
  const renderTriggers = () =>
    triggers.map(({ key, ...trigger }, index) => (
      <PopupTriggerPart key={key} handle={handle} data-testid={`trigger${index + 1}`} {...trigger}>
        Trigger {index + 1}
      </PopupTriggerPart>
    ));

  const parts = (
    <PopupRootPart
      {...root}
      handle={handle}
      v-slots={{
        default: ({ payload }: { payload: unknown }) => [
          handle === undefined && renderTriggers(),
          <PopupPositionerPart keepMounted={keepMounted} data-testid="positioner" {...positioner}>
            <PopupPart keepMounted={keepMounted} data-testid="popup" {...popup}>
              <PopupViewportPart
                data-testid="viewport"
                v-slots={{ default: () => content(payload) }}
              />
            </PopupPart>
          </PopupPositionerPart>,
        ],
      }}
    />
  );

  return handle === undefined ? (
    parts
  ) : (
    <>
      {parts}
      {renderTriggers()}
    </>
  );
}

/**
 * The style of a trigger that the test places in the page, 100 by 50 pixels.
 */
export function placeTrigger(top: number, left: number): Record<string, string> {
  return {
    position: 'absolute',
    top: `${top}px`,
    left: `${left}px`,
    width: '100px',
    height: '50px',
  };
}

/**
 * A scene inside `KeepAlive`. Set `visible` to `false` to deactivate the scene, and to `true` to
 * activate it. Call `render()` in the render function of the test.
 */
export function createKeptScene(getScene: () => ViewportScene) {
  const visible = shallowRef(true);
  const Scene = defineComponent({ setup: () => () => scene(getScene()) });
  return {
    visible,
    render: () => (
      <KeepAlive>{visible.value ? <Scene key="scene" /> : <div key="empty" />}</KeepAlive>
    ),
  };
}
