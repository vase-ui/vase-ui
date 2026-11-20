/**
 * A place of the drawer: a number from 0 to 1 is a part of the height of the viewport, a larger
 * number is pixels, and a string has the unit `px` or `rem`.
 */
export type DrawerSnapPoint = number | string;

/** The direction of the swipe that closes the drawer. */
export type DrawerSwipeDirection = 'up' | 'down' | 'left' | 'right';
