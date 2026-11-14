const base = import.meta.env.BASE_URL;

export const audienceMenus = [
  {
    value: 'developers',
    label: 'Developers',
    hint: 'Go from idea to UI faster.',
    title: 'Build product UI without giving up control',
    description:
      'Start with accessible parts and shape them to your app instead of working around a preset design system.',
    links: [
      {
        href: `${base}quick-start`,
        title: 'Quick start',
        description: 'Install Vase UI and get your first interactive component on screen fast.',
      },
      {
        href: `${base}handbook/composition`,
        title: 'Composition',
        description: 'Wrap and combine parts to match your product structure without hacks.',
      },
    ],
  },
  {
    value: 'systems',
    label: 'Design Systems',
    hint: 'Keep patterns aligned across teams.',
    title: 'Turn shared standards into working components',
    description:
      'Connect tokens, states, and accessibility rules once, then give every product team the same solid starting point.',
    links: [
      {
        href: `${base}handbook/styling`,
        title: 'Styling',
        description: 'Map tokens and component states to your own CSS or utility setup.',
      },
      {
        href: `${base}components/tooltip`,
        title: 'Tooltip',
        description: 'Set one clear pattern for lightweight help, hints, and field guidance.',
      },
      {
        href: `${base}components/preview-card`,
        title: 'Preview Card',
        description: 'Preview the page behind a link in a popup.',
      },
    ],
  },
  {
    value: 'managers',
    label: 'Engineering Leads',
    hint: 'Roll out shared UI without drag.',
    title: 'Give squads clear defaults and room to move',
    description:
      'Use the docs to align on quality bars, upgrades, and extension points while still leaving teams space to customize.',
    links: [
      {
        href: `${base}parity`,
        title: 'Parity',
        description:
          'Track which changes are mirrored and which are queued before upgrades surprise teams.',
      },
      {
        href: `${base}handbook/typescript`,
        title: 'TypeScript',
        description: 'See how Vase UI types custom wrappers and shared abstractions.',
      },
      {
        href: `${base}handbook/forms`,
        title: 'Forms',
        description: 'Standardize validation and field patterns teams reach for constantly.',
      },
    ],
  },
  {
    value: 'startups',
    label: 'Startups',
    hint: 'Ship polished basics while things change.',
    title: 'Get sturdy UI foundations in place early',
    description:
      'Cover the hard interaction details now so your team can spend more time on the product ideas that actually differentiate you.',
    links: [
      {
        href: `${base}quick-start`,
        title: 'Quick start',
        description: 'Get the package installed and your first component working in minutes.',
      },
      {
        href: `${base}components/navigation-menu`,
        title: 'Navigation Menu',
        description: 'Add navigation menus with keyboard support and focus handling already done.',
      },
      {
        href: `${base}components/dialog`,
        title: 'Dialog',
        description: 'Launch settings or upgrade flows without rebuilding focus management.',
      },
    ],
  },
] as const;

export const guidesPanel = {
  title: 'Where teams usually start',
  description:
    'These are the docs people reach for first when they are turning a prototype into shared UI.',
} as const;

export const guideLinks = [
  {
    href: `${base}quick-start`,
    title: 'Quick start',
    description: 'Install the package and put your first component on the page.',
  },
  {
    href: `${base}handbook/composition`,
    title: 'Composition',
    description: 'Learn when to wrap parts, share behavior, and expose flexible APIs.',
  },
  {
    href: `${base}handbook/styling`,
    title: 'Styling',
    description: 'Apply tokens and state styles without fighting the underlying markup.',
  },
] as const;
