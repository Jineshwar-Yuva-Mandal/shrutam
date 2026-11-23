"use client";

import { SyntheticEvent, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/brand-logo";
import SignOutButton from "@/components/sign-out-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function JoinPaathshalaPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get("role") === "teacher" ? "teacher" : "student";
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState(tenantSlug);
  const [joinRole, setJoinRole] = useState<"student" | "teacher">(requestedRole);
  const [membershipRequestPending, setMembershipRequestPending] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadTenant() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setMessage("Add your Supabase URL and public key to .env.local to request enrollment.");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const joinPath = `/join/${tenantSlug}`;
        router.replace(`/login?next=${encodeURIComponent(joinPath)}`);
        return;
      }
      setJoinRole(requestedRole);
      const { data, error } = await supabase.from("paathshalas").select("id,name").eq("slug", tenantSlug).eq("is_active", true).maybeSingle();
      if (!active) return;
      if (error || !data) {
        setMessage("We couldn’t find an active paathshala with that code.");
        return;
      }
      setTenantId(data.id);
      setTenantName(data.name);
      const { data: request } = await supabase.from("paathshala_memberships")
        .select("id, status")
        .eq("paathshala_id", data.id)
        .eq("user_id", user.id)
        .eq("role", requestedRole)
        .in("status", ["pending", "active"])
        .maybeSingle();
      if (active && request) {
        setMembershipRequestPending(true);
        const roleName = requestedRole === "teacher" ? "Teacher" : "Student";
        setMessage(request.status === "active" ? `You already have ${roleName.toLowerCase()} access to this paathshala.` : `Your ${roleName.toLowerCase()} access request is waiting for approval.`);
      }
    }
    void loadTenant();
    return () => { active = false; };
  }, [requestedRole, router, tenantSlug]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !tenantId) return;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      const joinPath = `/join/${tenantSlug}`;
      router.replace(`/login?next=${encodeURIComponent(joinPath)}`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("paathshala_memberships").insert({
      paathshala_id: tenantId,
      user_id: user.id,
      role: joinRole,
      status: "pending",
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMembershipRequestPending(true);
    router.replace("/spaces");
    router.refresh();
  }

  const roleName = joinRole === "teacher" ? "teacher" : "student";
  let submitLabel = `Request ${roleName} access`;
  if (membershipRequestPending) submitLabel = "Request pending approval";
  if (busy) submitLabel = "Sending request...";

  return <main className="auth-screen"><div className="auth-aside"><BrandLogo variant="complete" className="auth-aside-logo" priority /><p className="auth-verse">Learning begins<br />with belonging.</p><div className="auth-aside-bottom">{joinRole === "teacher" ? "Teacher access is approved by an active teacher." : "Student access is approved by a teacher."}</div></div><section className="auth-content"><div className="auth-panel"><p className="eyebrow">{joinRole === "teacher" ? "Teacher access" : "Student access"}</p><h1>Join {tenantName}</h1><p className="heading-note">Request {roleName} access to this paathshala.</p><div className="join-signout-row"><SignOutButton /></div>
    <form className="auth-form" onSubmit={submit}>
      {message && <output className="auth-message">{message}</output>}
      <button type="submit" className="primary-button auth-submit" disabled={!tenantId || busy || membershipRequestPending}>{submitLabel}</button>
    </form>
  </div></section></main>;
}