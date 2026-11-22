/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";

export type UserRole = "admin" | "cafe_owner" | "manager";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedOutletId?: string;
  createdAt: string;
}

interface StoredAccount extends AuthUser {
  passwordHash: string;
}

export interface LoginInput {
  email: string;
  password: string;
  role?: UserRole;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  assignedOutletId?: string;
}

export interface AuthActionResult {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (input: LoginInput) => Promise<AuthActionResult>;
  signup: (input: SignupInput) => Promise<AuthActionResult>;
  loginAsDemo: (role: UserRole) => void;
  logout: () => void;
}

const USERS_STORAGE_KEY = "petpooja-auth-users-v1";
const SESSION_STORAGE_KEY = "petpooja-auth-session-v1";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  cafe_owner: "Cafe Owner",
  manager: "Manager",
};

async function hashPassword(password: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`petpooja-salt::${password}`);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `fallback-${password}`;
}

const DEFAULT_DEMO_ACCOUNTS: Array<{ account: AuthUser; demoPassword: string }> = [
  {
    account: {
      id: "usr-admin-1",
      name: "Aarav Sharma (Admin)",
      email: "admin@petpooja.in",
      role: "admin",
      createdAt: "2026-01-01T09:00:00.000Z",
    },
    demoPassword: "Password@123",
  },
  {
    account: {
      id: "usr-owner-1",
      name: "Tinku Verma (Owner)",
      email: "owner@tinkuscafe.in",
      role: "cafe_owner",
      createdAt: "2026-01-01T09:00:00.000Z",
    },
    demoPassword: "Password@123",
  },
  {
    account: {
      id: "usr-manager-1",
      name: "Rohan Malhotra (Manager)",
      email: "manager@tinkuscafe.in",
      role: "manager",
      assignedOutletId: "ot-tinku-1",
      createdAt: "2026-01-01T09:00:00.000Z",
    },
    demoPassword: "Password@123",
  },
];

async function getStoredAccounts(): Promise<StoredAccount[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredAccount[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    const seeded: StoredAccount[] = await Promise.all(
      DEFAULT_DEMO_ACCOUNTS.map(async ({ account, demoPassword }) => ({
        ...account,
        passwordHash: await hashPassword(demoPassword),
      }))
    );
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
}

function saveStoredAccounts(accounts: StoredAccount[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage quota issues
  }
}

function getInitialSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = React.useState<AuthUser | null>(getInitialSession);

  // Ensure demo accounts are seeded on first mount
  React.useEffect(() => {
    void getStoredAccounts();
  }, []);

  const persistSession = React.useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    if (typeof window === "undefined") return;
    try {
      if (nextUser) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage issues
    }
  }, []);

  const login = React.useCallback(
    async ({ email, password, role }: LoginInput): Promise<AuthActionResult> => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        return { success: false, error: "Please enter both email and password." };
      }

      const accounts = await getStoredAccounts();
      const matched = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
      if (!matched) {
        return { success: false, error: "No account found with that email address." };
      }

      const incomingHash = await hashPassword(password);
      if (matched.passwordHash !== incomingHash) {
        return { success: false, error: "Incorrect password. Please try again." };
      }

      if (role && matched.role !== role) {
        return {
          success: false,
          error: `This email is registered as ${ROLE_LABELS[matched.role]}, not ${ROLE_LABELS[role]}.`,
        };
      }

      const { passwordHash: _ignored, ...safeUser } = matched;
      persistSession(safeUser);
      return { success: true, user: safeUser };
    },
    [persistSession]
  );

  const signup = React.useCallback(
    async ({ name, email, password, role, assignedOutletId }: SignupInput): Promise<AuthActionResult> => {
      const trimmedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();

      if (trimmedName.length < 2) {
        return { success: false, error: "Please enter your full name." };
      }
      if (!normalizedEmail.includes("@")) {
        return { success: false, error: "Please enter a valid email address." };
      }
      if (password.length < 6) {
        return { success: false, error: "Password must be at least 6 characters." };
      }
      if (role === "manager" && !assignedOutletId) {
        return { success: false, error: "Please select an assigned outlet for the Manager role." };
      }

      const accounts = await getStoredAccounts();
      if (accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
        return { success: false, error: "An account with this email already exists." };
      }

      const newStored: StoredAccount = {
        id: `usr-${Date.now()}`,
        name: trimmedName,
        email: normalizedEmail,
        role,
        assignedOutletId: role === "manager" ? assignedOutletId : undefined,
        createdAt: new Date().toISOString(),
        passwordHash: await hashPassword(password),
      };

      saveStoredAccounts([newStored, ...accounts]);
      const { passwordHash: _ignored, ...safeUser } = newStored;
      persistSession(safeUser);
      return { success: true, user: safeUser };
    },
    [persistSession]
  );

  const loginAsDemo = React.useCallback(
    (role: UserRole) => {
      const demo = DEFAULT_DEMO_ACCOUNTS.find((d) => d.account.role === role);
      if (demo) {
        persistSession(demo.account);
      }
    },
    [persistSession]
  );

  const logout = React.useCallback(() => {
    persistSession(null);
  }, [persistSession]);

  return (
    <AuthContext.Provider value={{ user, login, signup, loginAsDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
