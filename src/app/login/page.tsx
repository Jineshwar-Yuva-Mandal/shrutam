"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, SyntheticEvent, useState } from "react";
import BrandLogo from "@/components/brand-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupRequired = searchParams.get("setup") === "supabase";
  const platformLogin = searchParams.get("next") === "/platform";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Add your Supabase URL and public key to .env.local to sign in.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: typeof email === "string" ? email.trim() : "",
      password: typeof password === "string" ? password : "",
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    const destination = await getLoginDestination(supabase, data.user.id, searchParams.get("next"), data.user.user_metadata);
    router.replace(destination);
    router.refresh();
  }

  return <AuthFrame
    eyebrow={platformLogin ? "Platform administrator" : "Welcome back"}
    title={platformLogin ? "Sign in to the platform console" : "Continue your learning journey"}
    description={platformLogin ? "Use your platform administrator account to manage paathshalas." : "Sign in to your paathshala space."}
  >
    <form className="auth-form" onSubmit={submit}>
      {setupRequired && <output className="auth-message">Connect Supabase by adding its URL and public key to .env.local. Sign-in requires a configured database.</output>}
      <label className="form-label">Email address<input className="form-control" type="email" name="email" autoComplete="email" required /></label>
      <label className="form-label">Password<input className="form-control" type="password" name="password" autoComplete="current-password" required /></label>
      {message && <output className="auth-message">{message}</output>}
      <button type="submit" className="primary-button auth-submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
    </form>
    {platformLogin ? <p className="auth-footnote">Not a platform administrator? <Link href="/login">Regular paathshala login</Link></p> : <>
      <p className="auth-footnote">New to Shrutam? <Link href="/signup">Create an account</Link></p>
      <Link className="platform-login-link" href="/login?next=%2Fplatform">Platform administrator login</Link>
    </>}
  </AuthFrame>;
}

async function getLoginDestination(supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>, userId: string, requestedNext: string | null, userMetadata: Record<string, unknown>) {
  if (requestedNext?.startsWith("/") && !requestedNext.startsWith("//")) return requestedNext;

  const { data: platformAdmin } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (platformAdmin) return "/platform";

  const { data: memberships } = await supabase.from("paathshala_memberships").select("paathshala_id, status").eq("user_id", userId);
  const activeTenantIds = [...new Set((memberships ?? []).filter((membership) => membership.status === "active").map((membership) => membership.paathshala_id))];
  const hasPendingTeacherRequest = (memberships ?? []).some((membership) => membership.status === "pending");
  const { data: pendingFamilyRequests } = await supabase.from("family_join_requests").select("id").eq("requester_user_id", userId).eq("status", "pending").limit(1);
  const hasPendingFamilyRequest = (pendingFamilyRequests ?? []).length > 0;
  if (activeTenantIds.length === 0) {
    if (hasPendingTeacherRequest || hasPendingFamilyRequest) return "/spaces";
    const initialTenant = userMetadata.initial_join_tenant;
    if (typeof initialTenant === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(initialTenant)) {
      const role = userMetadata.initial_join_role === "teacher" ? "teacher" : "parent";
      return `/join/${encodeURIComponent(initialTenant)}?role=${role}`;
    }
    return "/spaces";
  }

  const { data: tenants } = await supabase.from("paathshalas").select("slug").in("id", activeTenantIds).eq("is_active", true);
  if (!tenants?.length) return "/spaces";
  if (tenants.length === 1 && !hasPendingTeacherRequest && !hasPendingFamilyRequest) return `/${tenants[0].slug}`;
  return "/spaces";
}

export default function LoginPage() {
  return <Suspense fallback={<div className="auth-screen"><p>Loading sign in...</p></div>}><LoginForm /></Suspense>;
}

function AuthFrame({ eyebrow, title, description, children }: Readonly<{ eyebrow: string; title: string; description: string; children: React.ReactNode }>) {
  return <main className="auth-screen"><div className="auth-aside"><BrandLogo variant="complete" className="auth-aside-logo" priority /><p className="auth-verse">Wisdom grows<br />when it is shared.</p><div className="auth-aside-bottom">A shared home for paathshalas and families. An Offering by JYM-Digital</div></div><section className="auth-content"><div className="auth-panel"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="heading-note">{description}</p>{children}</div></section></main>;
}

export { AuthFrame };