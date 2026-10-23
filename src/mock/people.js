/**
 * Accounts, Phase 1 fixtures.
 * The five user classes come straight from SRS section 2.6.
 */

import { rng, slug } from '../lib/random.js';

export const ROLES = {
  guest: {
    key: 'guest',
    label: 'Guest',
    rank: 0,
    description: 'Not signed in. Public catalogue, launches, events and space weather.',
  },
  user: {
    key: 'user',
    label: 'Observer',
    rank: 1,
    description: 'Live tracking, observation planning and the observation log.',
  },
  researcher: {
    key: 'researcher',
    label: 'Researcher',
    rank: 2,
    description: 'Everything an observer has, plus private workspaces and citable datasets.',
  },
  engineer: {
    key: 'engineer',
    label: 'Engineer',
    rank: 2,
    description: 'Everything an observer has, plus element-set diagnostics, ground stations and the vehicle builder.',
  },
  admin: {
    key: 'admin',
    label: 'Administrator',
    rank: 3,
    description: 'Accounts and roles, catalogue, data sources, settings and the audit log.',
  },
};

/** Role privileges, rendered as the table on the roles screen. */
export const ROLE_MATRIX = [
  ['Browse the public catalogue and launch schedule', ['guest', 'user', 'researcher', 'engineer', 'admin']],
  ['Live tracking', ['user', 'researcher', 'engineer', 'admin']],
  ['Observer locations', ['user', 'researcher', 'engineer', 'admin']],
  ['Observation planning and logs', ['user', 'researcher', 'engineer', 'admin']],
  ['Private research workspaces', ['researcher']],
  ['Immutable dataset snapshots and citation export', ['researcher']],
  ['Upload a dataset to a project', ['researcher']],
  ['Invite collaborators to a project', ['researcher']],
  ['Element-set history and staleness diagnostics', ['engineer']],
  ['Decay and re-entry estimates', ['engineer']],
  ['Ground station configuration', ['engineer']],
  ['Launch vehicle design and staging analysis', ['engineer']],
  ['Manage accounts and set roles', ['admin']],
  ['Manage catalogue, data sources and ingestion', ['admin']],
  ['Edit global thresholds and settings', ['admin']],
  ['Read the audit log', ['admin']],
];

const NAMES = [
  ['Mohammed Essam', 'mohammed.essam', 'researcher'],
  ['Layla Haddad', 'layla.haddad', 'user'],
  ['Omar Farouk', 'omar.farouk', 'admin'],
  ['Nadia Petrova', 'nadia.petrova', 'engineer'],
  ['Tomas Lindqvist', 'tomas.lindqvist', 'researcher'],
  ['Priya Raghunathan', 'priya.raghunathan', 'engineer'],
  ['Daniel Okafor', 'daniel.okafor', 'user'],
  ['Hana Suzuki', 'hana.suzuki', 'researcher'],
  ['Marco Bellini', 'marco.bellini', 'user'],
  ['Sofia Alvarez', 'sofia.alvarez', 'engineer'],
  ['Yusuf Demir', 'yusuf.demir', 'user'],
  ['Ingrid Moen', 'ingrid.moen', 'researcher'],
  ['Chen Wei', 'chen.wei', 'user'],
  ['Amara Nwosu', 'amara.nwosu', 'user'],
  ['Lucas Moreau', 'lucas.moreau', 'engineer'],
  ['Elena Vasquez', 'elena.vasquez', 'admin'],
  ['Rohan Mehta', 'rohan.mehta', 'user'],
  ['Freya Nilsen', 'freya.nilsen', 'researcher'],
  ['Khalid Al-Mansouri', 'khalid.almansouri', 'user'],
  ['Mei Tanaka', 'mei.tanaka', 'user'],
  ['Pavel Novak', 'pavel.novak', 'engineer'],
  ['Zara Iqbal', 'zara.iqbal', 'user'],
  ['Thabo Molefe', 'thabo.molefe', 'user'],
  ['Clara Wolff', 'clara.wolff', 'researcher'],
];

const INSTITUTIONS = [
  'Misr International University',
  'Independent',
  'Royal Observatory Outreach',
  'Technical University of Munich',
  'National Institute of Astrophysics',
  'Kyoto Observatory Group',
  'Amateur Radio Satellite Corporation',
  'Delft Space Systems Laboratory',
];

export function buildUsers(now = new Date()) {
  return NAMES.map(([name, handle, role], i) => {
    const random = rng(`user-${handle}`);
    const created = new Date(now.getTime() - random.range(20, 900) * 86400000);
    return {
      id: slug(handle),
      name,
      email: `${handle}@example.org`,
      role,
      roleLabel: ROLES[role].label,
      status: i === 11 ? 'suspended' : i === 19 ? 'unverified' : 'active',
      emailVerified: i !== 19,
      institution: random.pick(INSTITUTIONS),
      timezone: random.pick([
        'Africa/Cairo', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo',
        'America/New_York', 'Asia/Kolkata', 'Europe/Stockholm', 'Africa/Lagos',
      ]),
      createdAt: created.toISOString(),
      lastSeenAt: new Date(now.getTime() - random.range(0.1, 400) * 3600000).toISOString(),
      sessionCount: random.int(4, 620),
      observationCount: random.int(0, 180),
      workspaceCount: role === 'researcher' ? random.int(1, 5) : 0,
      stationCount: role === 'engineer' ? random.int(1, 3) : 0,
      twoFactor: random.bool(0.3),
    };
  });
}
