/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import {
  Briefcase,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Store,
  Sun,
  User,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { ROLE_LABELS, UserRole, useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { OUTLETS } from "@/lib/mock-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoleCardConfig {
  role: UserRole;
  title: string;
  subtitle: string;
  demoEmail: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions: string[];
}

const ROLE_CONFIGS: RoleCardConfig[] = [
  {
    role: "admin",
    title: "Admin",
    subtitle: "System & multi-brand control",
    demoEmail: "admin@petpooja.in",
    icon: ShieldCheck,
    permissions: ["All outlets & integrations", "User & terminal access", "Audit logs & exports"],
  },
  {
    role: "cafe_owner",
    title: "Cafe Owner",
    subtitle: "Business & franchise analytics",
    demoEmail: "owner@tinkuscafe.in",
    icon: Briefcase,
    permissions: ["Multi-outlet revenue & P&L", "EOD automated reports", "Outlet expansion"],
  },
  {
    role: "manager",
    title: "Manager",
    subtitle: "Outlet floor & stock ops",
    demoEmail: "manager@tinkuscafe.in",
    icon: Store,
    permissions: ["Assigned outlet live orders", "Inventory & stock transfers", "Staff & kitchen shifts"],
  },
];

export const AuthPage: React.FC = () => {
  const { login, signup, loginAsDemo } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [selectedRole, setSelectedRole] = React.useState<UserRole>("cafe_owner");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [assignedOutletId, setAssignedOutletId] = React.useState(OUTLETS[3]?.id || OUTLETS[0]?.id || "");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const activeRoleMeta = ROLE_CONFIGS.find((r) => r.role === selectedRole) || ROLE_CONFIGS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (mode === "login") {
        const res = await login({ email, password, role: selectedRole });
        if (!res.success) {
          setErrorMsg(res.error || "Sign in failed.");
          return;
        }
        toast.success(`Signed in as ${res.user?.name} (${ROLE_LABELS[res.user!.role]}).`);
      } else {
        const res = await signup({
          name,
          email,
          password,
          role: selectedRole,
          assignedOutletId: selectedRole === "manager" ? assignedOutletId : undefined,
        });
        if (!res.success) {
          setErrorMsg(res.error || "Sign up failed.");
          return;
        }
        toast.success(`Account created! Welcome, ${res.user?.name}.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoAccess = (role: UserRole) => {
    loginAsDemo(role);
    toast.success(`Signed in with ${ROLE_LABELS[role]} workspace access.`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Bar */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
            P
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-800 dark:text-slate-100">
            Petpooja
          </span>
          <Badge variant="outline" className="hidden sm:inline-flex text-[11px] bg-orange-50 text-orange-700 border-orange-200">
            Operations Portal
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="h-9 gap-2 px-3 border-slate-200 dark:border-neutral-700"
        >
          {theme === "dark" ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-medium">Dark Mode</span>
            </>
          )}
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Role Capabilities & Brand Context */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-none mb-3">
                Multi-Outlet POS & Inventory
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Role-based command center for your cafes
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Sign in or create an account as an <strong className="text-slate-700 dark:text-slate-200">Admin</strong>,{" "}
                <strong className="text-slate-700 dark:text-slate-200">Cafe Owner</strong>, or{" "}
                <strong className="text-slate-700 dark:text-slate-200">Manager</strong> to access live orders, stock transfers, and reports.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                  <activeRoleMeta.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {activeRoleMeta.title} Access Scope
                  </p>
                  <p className="text-xs text-slate-500">{activeRoleMeta.subtitle}</p>
                </div>
              </div>
              <ul className="space-y-2 pt-1">
                {activeRoleMeta.permissions.map((perm) => (
                  <li key={perm} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    {perm}
                  </li>
                ))}
              </ul>
            </div>

            {/* One-Click Demo Accounts */}
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Quick Demo Access (Password: Password@123)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                {ROLE_CONFIGS.map((cfg) => (
                  <button
                    key={cfg.role}
                    type="button"
                    onClick={() => handleDemoAccess(cfg.role)}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3.5 py-2.5 text-left hover:border-orange-300 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <cfg.icon className="w-4 h-4 text-orange-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          Continue as {cfg.title}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 truncate">
                          {cfg.demoEmail}
                        </p>
                      </div>
                    </div>
                    <UserCheck className="w-4 h-4 text-slate-300 group-hover:text-orange-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Login / Signup Card */}
          <Card className="lg:col-span-7 border-slate-200 dark:border-neutral-800 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl font-bold">
                    {mode === "login" ? "Sign in to your account" : "Create a new account"}
                  </CardTitle>
                  <CardDescription>
                    {mode === "login"
                      ? "Select your role and enter your credentials."
                      : "Register as an Admin, Cafe Owner, or Outlet Manager."}
                  </CardDescription>
                </div>
                <Tabs
                  value={mode}
                  onValueChange={(v) => {
                    setMode(v as "login" | "signup");
                    setErrorMsg(null);
                  }}
                >
                  <TabsList className="bg-slate-100">
                    <TabsTrigger value="login" className="text-xs px-3.5">
                      Login
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="text-xs px-3.5">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Role Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Select Role</Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {ROLE_CONFIGS.map((cfg) => {
                      const active = selectedRole === cfg.role;
                      return (
                        <button
                          key={cfg.role}
                          type="button"
                          onClick={() => {
                            setSelectedRole(cfg.role);
                            setErrorMsg(null);
                          }}
                          className={cn(
                            "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer",
                            active
                              ? "border-orange-500 bg-orange-50/70 ring-1 ring-orange-200 dark:bg-orange-500/10"
                              : "border-slate-200 hover:border-slate-300 bg-white dark:bg-neutral-900"
                          )}
                        >
                          <cfg.icon
                            className={cn(
                              "w-4 h-4",
                              active ? "text-orange-600" : "text-slate-400"
                            )}
                          />
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              active ? "text-orange-800 dark:text-orange-300" : "text-slate-800"
                            )}
                          >
                            {cfg.title}
                          </span>
                          <span className="text-[10px] text-slate-500 line-clamp-1">
                            {cfg.subtitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-name" className="text-xs font-semibold">
                      Full Name
                    </Label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        id="auth-name"
                        type="text"
                        placeholder="e.g. Tinku Verma"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-9 h-10"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="auth-email" className="text-xs font-semibold">
                    Work Email
                  </Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="auth-email"
                      type="email"
                      placeholder={activeRoleMeta.demoEmail}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 h-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-password" className="text-xs font-semibold">
                      Password
                    </Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmail(activeRoleMeta.demoEmail);
                          setPassword("Password@123");
                          setErrorMsg(null);
                        }}
                        className="text-[11px] font-medium text-orange-600 hover:underline cursor-pointer"
                      >
                        Fill {activeRoleMeta.title} demo credentials
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password (min 6 chars)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 pr-10 h-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {mode === "signup" && selectedRole === "manager" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-outlet" className="text-xs font-semibold">
                      Assigned Outlet Location
                    </Label>
                    <select
                      id="auth-outlet"
                      value={assignedOutletId}
                      onChange={(e) => setAssignedOutletId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-orange-400"
                    >
                      {OUTLETS.map((outlet) => (
                        <option key={outlet.id} value={outlet.id}>
                          {outlet.name} ({outlet.city})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {errorMsg && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    {errorMsg}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  {submitting
                    ? "Please wait..."
                    : mode === "login"
                      ? `Sign In as ${activeRoleMeta.title}`
                      : `Create ${activeRoleMeta.title} Account`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};
