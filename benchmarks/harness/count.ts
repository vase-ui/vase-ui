/** The number of instances of the scenario: the URL parameter `count`, else 1. */
export const count = Number(new URLSearchParams(location.search).get('count') ?? 1);
