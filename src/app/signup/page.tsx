"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, SyntheticEvent, useState } from "react";
import { AuthFrame } from "@/app/login/page";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Add your Supabase URL and public key to .env.local to create an account.");
      return;
    }

    const fullNameValue = formData.get("fullName");
    const emailValue = formData.get("email");
    const passwordValue = formData.get("password");
    const tenantSlugValue = formData.get("tenantSlug");
    const accountTypeValue = formData.get("accountType");
    const fullName = typeof fullNameValue === "string" ? fullNameValue.trim() : "";
    const email = typeof emailValue === "string" ? emailValue.trim() : "";
    const password = typeof passwordValue === "string" ? passwordValue : "";
    const tenantSlug = typeof tenantSlugValue === "string" ? tenantSlugValue.trim().toLowerCase() : "";
    const accountType = accountTypeValue === "teacher" ? "teacher" : "parent";
    setBusy(true);
    const next = `/join/${encodeURIComponent(tenantSlug)}?role=${accountType}`;
    const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, initial_join_role: accountType }, emailRedirectTo: callback },
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    setMessage("Check your email to confirm your account. We’ll continue with the paathshala request after confirmation.");
  }

  return <AuthFrame eyebrow="Join your community" title="Create an account" description="Choose a parent or teacher account for your paathshala.">
    <form className="auth-form" onSubmit={submit}>
      <label className="form-label">Join this paathshala as<select className="form-control" name="accountType" defaultValue="parent"><option value="parent">Parent</option><option value="teacher">Teacher</option></select></label>
      <label className="form-label">Your name<input className="form-control" name="fullName" autoComplete="name" required /></label>
      <label className="form-label">Email address<input className="form-control" type="email" name="email" autoComplete="email" required /></label>
      <label className="form-label">Password<input className="form-control" type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
      <label className="form-label">Paathshala code<input className="form-control" name="tenantSlug" defaultValue={searchParams.get("tenant") ?? ""} placeholder="e.g. rajajinagar" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
      {message && <output className="auth-message">{message}</output>}
      <button type="submit" className="primary-button auth-submit" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
    </form>
    <p className="auth-footnote">Already registered? <Link href="/login">Sign in</Link></p>
  </AuthFrame>;
}

export default function SignupPage() {
  return <Suspense fallback={<div className="auth-screen"><p>Loading sign up...</p></div>}><SignupForm /></Suspense>;
}