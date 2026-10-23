/**
 * Authentication, accounts and role management (SRS module 1).
 *
 * Phase 1 accepts any password for a seeded account so every role can be
 * demonstrated. No credential is stored or transmitted, and the session lives
 * in memory plus one key in sessionStorage. Phase 2 replaces this module with
 * calls to the Express auth routes, which issue an httpOnly cookie.
 */

import { db } from '../mock/db.js';
import { ROLES } from '../mock/people.js';
import { call, envelope, ApiError } from './client.js';

const SESSION_KEY = 'spacenova.session';

/** The account each role demonstration signs in as. */
const DEMO_ACCOUNTS = {
  user: 'layla-haddad',
  researcher: 'mohammed-essam',
  engineer: 'nadia-petrova',
  admin: 'omar-farouk',
};

function readStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* Private browsing or blocked storage: the session simply does not persist. */
  }
}

function publicUser(user) {
  if (!user) return null;
  const { id, name, email, role, institution, timezone, emailVerified, twoFactor, createdAt } = user;
  return {
    id,
    name,
    email,
    role,
    roleLabel: ROLES[role].label,
    institution,
    timezone,
    emailVerified,
    twoFactor,
    createdAt,
  };
}

export const auth = {
  /** Resume a session from storage, if one is there. */
  current() {
    return call(() => {
      const stored = readStoredSession();
      if (!stored) return envelope(null, { source: 'session' });
      const user = db().users.find((u) => u.id === stored.userId);
      return envelope(publicUser(user), { source: 'session' });
    }, { scale: 0.3 });
  },

  /**
   * Sign in. Phase 1 matches on the email only; the password is validated for
   * shape and then discarded.
   */
  login({ email, password }) {
    return call(() => {
      const fields = {};
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        fields.email = 'Enter a valid email address.';
      }
      if (!password || password.length < 8) {
        fields.password = 'Passwords are at least eight characters.';
      }
      if (Object.keys(fields).length) {
        throw new ApiError('Check the details below.', { status: 422, code: 'validation', fields });
      }

      const user = db().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) {
        // A real server answers identically whether or not the account exists.
        throw new ApiError('Those details do not match an account.', {
          status: 401,
          code: 'invalid_credentials',
        });
      }
      if (user.status === 'suspended') {
        throw new ApiError('This account is suspended. Contact an administrator.', {
          status: 403,
          code: 'suspended',
        });
      }
      if (!user.emailVerified) {
        throw new ApiError('Confirm your email address before signing in.', {
          status: 403,
          code: 'unverified',
        });
      }

      writeStoredSession({ userId: user.id });
      return envelope(publicUser(user), { source: 'session' });
    });
  },

  /** Sign in as one of the demonstration accounts, for reviewing each role. */
  loginAs(role) {
    return call(() => {
      const id = DEMO_ACCOUNTS[role];
      if (!id) {
        writeStoredSession(null);
        return envelope(null, { source: 'session' });
      }
      const user = db().users.find((u) => u.id === id);
      writeStoredSession({ userId: user.id });
      return envelope(publicUser(user), { source: 'session' });
    }, { scale: 0.3 });
  },

  logout() {
    return call(() => {
      writeStoredSession(null);
      return envelope(true, { source: 'session' });
    }, { scale: 0.3 });
  },

  register({ name, email, password, confirmPassword, acceptedTerms }) {
    return call(() => {
      const fields = {};
      if (!name || name.trim().length < 2) fields.name = 'Enter your full name.';
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fields.email = 'Enter a valid email address.';
      if (!password || password.length < 8) fields.password = 'Use at least eight characters.';
      else if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) {
        fields.password = 'Mix letters and numbers.';
      }
      if (password !== confirmPassword) fields.confirmPassword = 'The two passwords do not match.';
      if (!acceptedTerms) fields.acceptedTerms = 'Accept the terms to continue.';

      const existing = db().users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
      if (existing) fields.email = 'An account already exists for this address.';

      if (Object.keys(fields).length) {
        throw new ApiError('Check the details below.', { status: 422, code: 'validation', fields });
      }

      // A new account is always an observer. The role is never taken from the
      // registration request (SRS SYS-AUTH requirement on role assignment).
      const user = {
        id: `new-${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'user',
        status: 'unverified',
        emailVerified: false,
        institution: 'Independent',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        sessionCount: 0,
        observationCount: 0,
        workspaceCount: 0,
        stationCount: 0,
        twoFactor: false,
      };
      db().users.push(user);

      return envelope(
        { user: publicUser(user), verificationRequired: true },
        { source: 'fixture' },
      );
    });
  },

  verifyEmail({ token }) {
    return call(() => {
      if (!token || token.length < 6) {
        throw new ApiError('That verification link is not valid.', { status: 400, code: 'bad_token' });
      }
      return envelope({ verified: true }, { source: 'fixture' });
    });
  },

  requestPasswordReset({ email }) {
    return call(() => {
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new ApiError('Enter a valid email address.', {
          status: 422,
          code: 'validation',
          fields: { email: 'Enter a valid email address.' },
        });
      }
      // Identical response whether or not the address is registered.
      return envelope({ sent: true }, { source: 'fixture' });
    });
  },

  resetPassword({ token, password, confirmPassword }) {
    return call(() => {
      const fields = {};
      if (!token) fields.token = 'This reset link is incomplete.';
      if (!password || password.length < 8) fields.password = 'Use at least eight characters.';
      if (password !== confirmPassword) fields.confirmPassword = 'The two passwords do not match.';
      if (Object.keys(fields).length) {
        throw new ApiError('Check the details below.', { status: 422, code: 'validation', fields });
      }
      return envelope({ reset: true }, { source: 'fixture' });
    });
  },

  updateProfile({ userId, patch }) {
    return call(() => {
      const user = db().users.find((u) => u.id === userId);
      if (!user) throw new ApiError('Account not found.', { status: 404, code: 'not_found' });
      Object.assign(user, patch);
      return envelope(publicUser(user), { source: 'fixture' });
    });
  },

  deleteAccount({ userId }) {
    return call(() => {
      const store = db();
      const index = store.users.findIndex((u) => u.id === userId);
      if (index >= 0) store.users.splice(index, 1);
      writeStoredSession(null);
      return envelope({ deleted: true }, { source: 'fixture' });
    });
  },
};

export { DEMO_ACCOUNTS };
