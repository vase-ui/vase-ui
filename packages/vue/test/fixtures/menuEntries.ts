type Props = Record<string, unknown>;

/**
 * An entry of `MenuFilterTree.vue`. An item has the `data-key` of its key, and its text, else the
 * key as text. A submenu has the parts of its key: `<key>-popup`, `<key>-positioner`,
 * `<key>-input` and `<key>-list` as `data-testid`.
 */
export interface MenuEntry {
  key: string;
  /** `item` when not given. A `radio` entry goes in a `radio-group` entry. */
  kind?:
    | 'item'
    | 'checkbox'
    | 'radio'
    | 'link'
    | 'button'
    | 'group'
    | 'radio-group'
    | 'submenu'
    | undefined;
  text?: string | undefined;
  attrs?: Props | undefined;
  /** The entries of a group, a radio group or a submenu. */
  items?: MenuEntry[] | undefined;
  /** The text of the label of a group. */
  label?: string | undefined;
  /** A submenu: the props of a `Menu.FilterProvider` around its root. */
  filter?: Props | undefined;
  root?: Props | undefined;
  trigger?: Props | undefined;
  portal?: Props | undefined;
  positioner?: Props | undefined;
  popup?: Props | undefined;
  /** A submenu: its `Menu.Input`. A submenu with `filter` has one unless this is `false`. */
  input?: Props | false | undefined;
  /** A submenu: its `Menu.List`. A submenu with `filter` has one unless this is `false`. */
  list?: Props | false | undefined;
  /** A submenu: the text of its `Menu.Empty`. */
  empty?: string | undefined;
}
