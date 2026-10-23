import {
  Antenna, Blocks, CalendarRange, ClipboardList, Database, FlaskConical, Gauge,
  Globe2, History, LayoutDashboard, MapPin, Radar, Rocket, Satellite,
  ScrollText, TrendingDown, UserCog, Users,
} from 'lucide-react';

/**
 * The navigation tree.
 *
 * `capability` gates a group against the role capabilities in AuthContext, so
 * the privilege table in SRS section 2.6 is expressed once and the sidebar,
 * the route guards and the roles screen all read from it.
 *
 * One screen per job. Where two screens used to show the same data from
 * slightly different angles, the weaker one was removed rather than folded in:
 * the look-up view duplicated the tracker's look angles, watchlists only
 * existed to feed plans, and the exports and preferences screens each held a
 * handful of controls that belong next to the thing they affect.
 */
export const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    capability: 'observe',
    items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    id: 'observe',
    label: 'Observe',
    capability: 'observe',
    items: [
      { to: '/app/tracker', label: 'Live tracker', icon: Radar },
      { to: '/app/planner', label: 'Observation planner', icon: CalendarRange },
      { to: '/app/locations', label: 'Observer locations', icon: MapPin },
      { to: '/app/log', label: 'Observation log', icon: ClipboardList },
    ],
  },
  {
    id: 'discover',
    label: 'Discover',
    capability: 'public',
    items: [
      { to: '/catalog', label: 'Object catalogue', icon: Satellite },
      { to: '/launches', label: 'Launch schedule', icon: Rocket },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    capability: 'research',
    items: [{ to: '/app/research', label: 'Workspaces', icon: FlaskConical }],
  },
  {
    id: 'engineering',
    label: 'Engineering',
    capability: 'engineering',
    items: [
      { to: '/app/engineering/element-sets', label: 'Element sets', icon: History },
      { to: '/app/engineering/decay', label: 'Decay watch', icon: TrendingDown },
      { to: '/app/engineering/stations', label: 'Ground stations', icon: Antenna },
      { to: '/app/engineering/vehicles', label: 'Vehicle builder', icon: Blocks },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    capability: 'admin',
    items: [
      { to: '/app/admin/users', label: 'Accounts', icon: Users },
      { to: '/app/admin/catalogue', label: 'Catalogue', icon: Database },
      { to: '/app/admin/sources', label: 'Data sources', icon: Globe2 },
      { to: '/app/admin/settings', label: 'Platform settings', icon: Gauge },
      { to: '/app/admin/audit', label: 'Audit log', icon: ScrollText },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    capability: 'observe',
    items: [{ to: '/app/profile', label: 'Profile', icon: UserCog }],
  },
];

/** Links in the public header, for signed-out visitors. */
export const PUBLIC_NAV = [
  { to: '/catalog', label: 'Catalogue' },
  { to: '/launches', label: 'Launches' },
];
