export type SidebarItem = {
  /** stable key used for active highlighting and expansion */
  key: string;
  /** i18n key, used with t(labelKey) */
  labelKey: string;
  icon?: string;
  /** navigation target; if omitted and expandable=true, it acts as a pure expander */
  to?: string;
  /** if true, clicking the parent toggles children */
  expandable?: boolean;
  /** child items (rendered as subNav) */
  children?: SidebarItem[];
  /** disabled items are visible but not clickable and visually de-emphasized */
  disabled?: boolean;
};

export const authorSidebarConfig: SidebarItem[] = [
  {
    key: 'home',
    labelKey: 'nav.home',
    icon: '🏠',
    to: '/writers-zone?nav=home',
  },
  {
    key: 'workManagement',
    labelKey: 'nav.workManagement',
    icon: '📚',
    expandable: true,
    children: [
      {
        key: 'novels',
        labelKey: 'nav.novel',
        to: '/writers-zone?nav=novels',
      },
      {
        key: 'script',
        labelKey: 'nav.script',
        disabled: true,
      },
    ],
  },
  {
    key: 'interactionManagement',
    labelKey: 'nav.interactionManagement',
    icon: '💬',
    expandable: true,
    children: [
      {
        key: 'commentManagement',
        labelKey: 'nav.commentManagement',
        to: '/writers-zone?nav=commentManagement',
      },
      {
        key: 'readerCorrections',
        labelKey: 'nav.readerCorrections',
        disabled: true,
      },
    ],
  },
  {
    key: 'workData',
    labelKey: 'nav.workData',
    icon: '📊',
    to: '/writers-zone?nav=workData',
  },
  {
    key: 'incomeManagement',
    labelKey: 'nav.incomeManagement',
    icon: '💰',
    to: '/writers-zone?nav=incomeManagement',
  },
  {
    key: 'personalInfo',
    labelKey: 'nav.personalInfo',
    icon: '👤',
    to: '/writers-zone?nav=personalInfo',
  },
];


