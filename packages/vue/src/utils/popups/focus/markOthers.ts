// Modified to add conditional `aria-hidden` support:
// https://github.com/theKashey/aria-hidden/blob/9220c8f4a4fd35f63bee5510a9f41a37264382d4/src/index.ts
import { getNodeName, isShadowRoot } from '@floating-ui/utils/dom';
import { ownerDocument } from '../../../common/owner';
import { createAttribute } from '../createAttribute';

type Undo = () => void;

interface MarkOthersOptions {
  ariaHidden?: boolean | undefined;
  /**
   * Whether the outside elements get `inert`, so that the Tab key and a press cannot reach them.
   * They are the elements that `ariaHidden` hides: live regions, their ancestors and scripts do
   * not get it.
   */
  inert?: boolean | undefined;
  mark?: boolean | undefined;
}

const markerName = createAttribute('inert');

interface Mark {
  name: string;
  value: string;
  isSet: (element: Element) => boolean;
}

const MARKS: Mark[] = [
  {
    name: 'aria-hidden',
    value: 'true',
    isSet(element) {
      const attr = element.getAttribute('aria-hidden');
      return attr !== null && attr !== 'false';
    },
  },
  { name: 'inert', value: '', isSet: (element) => element.hasAttribute('inert') },
  { name: markerName, value: '', isSet: (element) => element.hasAttribute(markerName) },
];

interface Lock {
  /** The elements that the lock keeps free of its attributes. */
  avoid: Set<Node>;
  /** The elements of `avoid` and their ancestors. */
  keep: Set<Node>;
  /** The elements that get each attribute, by the name of the attribute. */
  targets: Record<string, Element[]>;
}

interface ModalMarks {
  version: 1;
  /** The locks that are held, the oldest first. */
  locks: Lock[];
  /**
   * The elements that have each attribute because of a lock, by the name of the attribute. An
   * element that had the attribute before is not in the set, and keeps the attribute.
   */
  written: Record<string, Set<Element>>;
}

const MODAL_MARKS_KEY = Symbol.for('vase-ui.modal-marks');

// Two copies of the library on one page mark the same elements, so the key is a `Symbol.for` key.
// With a registry for each copy, the first copy that releases an element removes the attribute
// while the popup of the other copy is still open.
function getModalMarks(): ModalMarks {
  const holder = globalThis as { [MODAL_MARKS_KEY]?: ModalMarks };
  holder[MODAL_MARKS_KEY] ??= {
    version: 1,
    locks: [],
    written: Object.fromEntries(MARKS.map(({ name }) => [name, new Set<Element>()])),
  };
  return holder[MODAL_MARKS_KEY];
}

function unwrapHost(node: Node | null): Element | null {
  if (!node) {
    return null;
  }

  return isShadowRoot(node) ? node.host : unwrapHost(node.parentNode);
}

const correctElements = (parent: HTMLElement, targets: Element[]): Element[] =>
  targets
    .map((target) => {
      if (parent.contains(target)) {
        return target;
      }

      const correctedTarget = unwrapHost(target);

      if (parent.contains(correctedTarget)) {
        return correctedTarget;
      }

      return null;
    })
    .filter((x): x is Element => x != null);

const buildKeepSet = (targets: Element[]): Set<Node> => {
  const keep = new Set<Node>();

  targets.forEach((target) => {
    let node: Node | null = target;
    while (node && !keep.has(node)) {
      keep.add(node);
      node = node.parentNode;
    }
  });

  return keep;
};

const collectOutsideElements = (
  root: Element,
  keepElements: Set<Node>,
  stopElements: Set<Node>,
): Element[] => {
  const outside: Element[] = [];

  const walk = (parent: Element | null) => {
    if (!parent || stopElements.has(parent)) {
      return;
    }

    Array.from(parent.children).forEach((node: Element) => {
      if (getNodeName(node) === 'script') {
        return;
      }

      if (keepElements.has(node)) {
        walk(node);
      } else {
        outside.push(node);
      }
    });
  };

  walk(root);

  return outside;
};

// A lock that is taken later lifts the attributes of the older locks from its own elements and
// their ancestors. Each lifted ancestor passes the attribute to its children that hold no element
// of the lock, so the rest of the page keeps it. Base UI keeps the attributes on these elements,
// and a popup that opens later in a marked container is hidden:
// https://github.com/mui/base-ui/issues/5577
function applyLocks(marks: ModalMarks) {
  MARKS.forEach(({ name, value, isSet }) => {
    const wanted = new Set<Element>();
    marks.locks.forEach((lock) => {
      Array.from(wanted).forEach((element) => {
        if (lock.keep.has(element)) {
          wanted.delete(element);
          collectOutsideElements(element, lock.keep, lock.avoid).forEach((child) => {
            wanted.add(child);
          });
        }
      });
      lock.targets[name]?.forEach((element) => {
        wanted.add(element);
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- `written` has a set for each name in `MARKS`.
    const written = marks.written[name]!;
    written.forEach((element) => {
      if (!wanted.has(element)) {
        element.removeAttribute(name);
        written.delete(element);
      }
    });
    wanted.forEach((element) => {
      if (!written.has(element) && !isSet(element)) {
        element.setAttribute(name, value);
        written.add(element);
      }
    });
  });
}

export function markOthers(avoidElements: Element[], options: MarkOthersOptions = {}): Undo {
  const { ariaHidden = false, inert = false, mark = true } = options;
  const body = ownerDocument(avoidElements[0]).body;
  const avoid = correctElements(body, avoidElements);
  const lock: Lock = { avoid: new Set<Node>(avoid), keep: buildKeepSet(avoid), targets: {} };

  if (mark) {
    lock.targets[markerName] = collectOutsideElements(body, lock.keep, lock.avoid);
  }

  if (ariaHidden || inert) {
    const ariaLiveElements = correctElements(
      body,
      Array.from(body.querySelectorAll('[aria-live]')),
    );
    const controlElements = avoid.concat(ariaLiveElements);
    const controlTargets = collectOutsideElements(
      body,
      buildKeepSet(controlElements),
      new Set<Node>(controlElements),
    );
    if (ariaHidden) {
      lock.targets['aria-hidden'] = controlTargets;
    }
    if (inert) {
      lock.targets.inert = controlTargets;
    }
  }

  const marks = getModalMarks();
  marks.locks.push(lock);
  applyLocks(marks);

  return () => {
    const index = marks.locks.indexOf(lock);
    if (index !== -1) {
      marks.locks.splice(index, 1);
      applyLocks(marks);
    }
  };
}
