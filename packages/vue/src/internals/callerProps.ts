import { camelize } from 'vue';
// eslint-disable-next-line no-restricted-imports -- Vue has no other API that tells a component which props its caller set. Vue exports `getCurrentInstance`. In a Vapor component it gives no instance of that component.
import { getCurrentInstance } from 'vue';

/** One declared prop, as Vue keeps it after it reads the `props` option. */
export interface DeclaredProp {
  type?: unknown;
  default?: unknown;
}

/**
 * The fields of a virtual DOM component instance that these functions read. Vue types `type`,
 * `props`, `slots` and `vnode.props`. It does not type `propsOptions`, `emitsOptions`, `vnode.ctx`
 * and the `_n` flag of a slot.
 */
export interface CallerInstance {
  type: { __name?: string; name?: string };
  props: Record<string, unknown>;
  slots: Record<string, unknown>;
  vnode: {
    props: Record<string, unknown> | null;
    /** The component whose render made the vnode. `null` for a vnode that no render made. */
    ctx?: CallerInstance | null;
  };
  /** The declared props, with mixins and `extends`. A component with no props has an empty list. */
  propsOptions: [Record<string, DeclaredProp | null>?, unknown?];
  /** The declared events, with mixins and `extends`. `null` for a component with no declared event. */
  emitsOptions: Record<string, unknown> | null;
}

/** The virtual DOM component whose `setup` runs, or `null`. */
export function getCallerInstance(): CallerInstance | null {
  const instance = getCurrentInstance() as CallerInstance | null;
  return instance?.vnode ? instance : null;
}

export function readOwner(instance: CallerInstance): CallerInstance | null {
  const owner = instance.vnode.ctx;
  return owner?.vnode ? owner : null;
}

export function readComponentName(instance: CallerInstance): string {
  const name = instance.type.__name ?? instance.type.name;
  return name ? `<${name}>` : 'A component with no name';
}

export function hasUnboundSlot(instance: CallerInstance): boolean {
  return Object.values(instance.slots).some(
    (slot) => typeof slot === 'function' && !(slot as { _n?: boolean })._n,
  );
}

export function readPropValue(instance: CallerInstance, prop: string): unknown {
  return instance.props[prop];
}

export function readDeclaredEvents(instance: CallerInstance): string[] {
  return Object.keys(instance.emitsOptions ?? {});
}

export function readDeclaredProps(instance: CallerInstance): Record<string, DeclaredProp | null> {
  return instance.propsOptions[0] ?? {};
}

/** Whether Vue gives the prop the value `false` when the caller does not set it. */
export function isCastToFalseWhenAbsent(option: DeclaredProp | null | undefined): boolean {
  if (!option || Object.hasOwn(option, 'default')) {
    return false;
  }
  return hasBooleanType(option);
}

export function hasBooleanType(option: DeclaredProp): boolean {
  return Array.isArray(option.type) ? option.type.includes(Boolean) : option.type === Boolean;
}

/**
 * What the caller of the component set for `prop`, which is a camel case name. A template can
 * give the name in kebab case.
 */
export function readGivenProp(
  instance: CallerInstance,
  prop: string,
): { isSet: boolean; value: unknown } {
  for (const [key, value] of Object.entries(instance.vnode.props ?? {})) {
    if (camelize(key) === prop) {
      return { isSet: true, value };
    }
  }
  return { isSet: false, value: undefined };
}

export function readGivenProps(instance: CallerInstance): [string, unknown][] {
  return Object.entries(instance.vnode.props ?? {}).map(([key, value]) => [camelize(key), value]);
}

/** The names that the caller of the component set, in camel case. */
export function readSetKeys(instance: CallerInstance): string[] {
  return Object.keys(instance.vnode.props ?? {}).map(camelize);
}
