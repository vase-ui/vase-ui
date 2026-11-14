import { defineComponent, shallowRef } from 'vue';
import type { CSSProperties } from 'vue';
import { getEmptyRootStore } from '../../src/utils/popups/floating-root/getEmptyRootStore';
import FloatingFocusManager from '../../src/utils/popups/focus/FloatingFocusManager.vue';
import { safePolygon } from '../../src/utils/popups/interactions/safePolygon';
import { useDismiss } from '../../src/utils/popups/interactions/useDismiss';
import { useFocus } from '../../src/utils/popups/interactions/useFocus';
import { useHoverPopupInteraction } from '../../src/utils/popups/interactions/useHoverPopupInteraction';
import { useHoverTriggerInteraction } from '../../src/utils/popups/interactions/useHoverTriggerInteraction';
import FloatingPortal from '../../src/utils/popups/portal/FloatingPortal.vue';
import { provideFloatingNode, useFloatingNodeId } from '../../src/utils/popups/tree/FloatingTree';
import type { InteractionProps } from '../../src/utils/popups/types';
import { useTestInteractions } from '../useTestInteractions';
import { useFloating } from '../floating-ui-tests/useFloating';

// The rules of the style sheet of Base UI, as style objects. The package has no type for a CSS
// module. The media rule of the container has no counterpart, because a style object holds no
// media query.
const styles = {
  Heading: { marginBottom: '2rem', fontSize: '3rem', fontWeight: 700 },
  Container: {
    marginBottom: '1rem',
    display: 'grid',
    height: '20rem',
    placeItems: 'center',
    border: '1px solid #94a3b8',
    borderRadius: '0.25rem',
  },
  Item: {
    background: '#f1f5f9',
    marginTop: '4px',
    marginBottom: '4px',
    display: 'flex',
    width: '12rem',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: '0.25rem',
    padding: '8px',
  },
  SubItem: {
    display: 'block',
    padding: '0.5rem 0.75rem',
    color: '#111827',
    textDecoration: 'none',
    borderRadius: '0.25rem',
  },
  Subnav: {
    background: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    borderRadius: '0.25rem',
    padding: '8px 16px',
    backdropFilter: 'blur(4px)',
    outline: 'none',
  },
  SubnavList: { display: 'flex', flexDirection: 'column' },
} satisfies Record<string, CSSProperties>;

/**
 * The test component `NavigationSubItem` of Base UI: a link of a subnavigation.
 */
export const NavigationSubItem = defineComponent({
  props: {
    label: { type: String, required: true },
    href: { type: String, required: true },
  },
  setup(props) {
    return () => (
      <a href={props.href} style={styles.SubItem}>
        {props.label}
      </a>
    );
  },
});

/**
 * The test component `NavigationItem` of Base UI: a link that opens its subnavigation on hover and
 * on focus, when it has children.
 */
export const NavigationItem = defineComponent({
  inheritAttrs: false,
  props: {
    label: { type: String, required: true },
    href: { type: String, required: true },
  },
  setup(props, { attrs, slots }) {
    const open = shallowRef(false);
    const hasChildren = !!slots.default;
    const fallbackStore = getEmptyRootStore();

    const nodeId = useFloatingNodeId();

    const { refs, context } = useFloating({
      open,
      nodeId,
      onOpenChange(nextOpen) {
        open.value = nextOpen;
      },
      placement: 'right-start',
    });

    const hoverStore = hasChildren ? context.rootStore : fallbackStore;
    const handleClose = safePolygon();
    const hoverReferenceProps = useHoverTriggerInteraction(hoverStore, {
      handleClose: () => handleClose,
      triggerElement: hasChildren ? refs.reference : undefined,
    });
    useHoverPopupInteraction(hoverStore);

    const focusProps = useFocus(context.rootStore, { enabled: hasChildren });
    const { getReferenceProps, getFloatingProps } = useTestInteractions([
      { reference: hoverReferenceProps },
      useDismiss(context.rootStore, { enabled: hasChildren }),
    ]);

    provideFloatingNode(nodeId);

    return () => (
      <>
        <li>
          <a
            href={props.href}
            ref={refs.setReference}
            style={styles.Item}
            {...focusProps}
            {...getReferenceProps(attrs as InteractionProps)}
          >
            {props.label}
          </a>
        </li>
        <FloatingPortal>
          {open.value && (
            <FloatingFocusManager store={context.rootStore} modal={false} initialFocus={false}>
              <div
                data-testid="subnavigation"
                ref={refs.setFloating}
                style={styles.Subnav}
                {...getFloatingProps()}
              >
                <button
                  type="button"
                  onClick={() => {
                    open.value = false;
                  }}
                >
                  Close
                </button>
                <ul style={styles.SubnavList}>{slots.default?.()}</ul>
              </div>
            </FloatingFocusManager>
          )}
        </FloatingPortal>
      </>
    );
  },
});

/**
 * The test component `Navigation` of Base UI: a list of navigation items.
 */
export const Navigation = defineComponent({
  setup(_, { slots }) {
    return () => (
      <nav>
        <ul>{slots.default?.()}</ul>
      </nav>
    );
  },
});

/**
 * The test component `Main` of Base UI: a navigation with one item that has a subnavigation.
 */
export const Main = defineComponent({
  setup() {
    return () => (
      <>
        <h1 style={styles.Heading}>Navigation</h1>
        <div style={styles.Container}>
          <Navigation>
            <NavigationItem label="Home" href="#" />
            <NavigationItem label="Product" href="#">
              <NavigationSubItem label="Link 1" href="#" />
              <NavigationSubItem label="Link 2" href="#" />
              <NavigationSubItem label="Link 3" href="#" />
            </NavigationItem>
            <NavigationItem label="About" href="#" />
          </Navigation>
        </div>
      </>
    );
  },
});
