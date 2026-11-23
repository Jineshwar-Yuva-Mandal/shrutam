"use client";

import { SyntheticEvent, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/brand-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function JoinPaathshalaPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get("role") === "teacher" ? "teacher" : "parent";
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState(tenantSlug);
  const [joinRole, setJoinRole] = useState<"parent" | "teacher">(requestedRole);
  const [teacherRequestPending, setTeacherRequestPending] = useState(false);
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
      if (requestedRole === "teacher") {
        const { data: request } = await supabase.from("paathshala_memberships")
          .select("id, status")
          .eq("paathshala_id", data.id)
          .eq("user_id", user.id)
          .eq("role", "teacher")
          .in("status", ["pending", "active"])
          .maybeSingle();
        if (active && request) {
          setTeacherRequestPending(true);
          setMessage(request.status === "active" ? "You already have teacher access to this paathshala." : "Your teacher access request is waiting for approval.");
        }
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
    if (joinRole === "teacher") {
      setBusy(true);
      const { error } = await supabase.from("paathshala_memberships").insert({
        paathshala_id: tenantId,
        user_id: user.id,
        role: "teacher",
        status: "pending",
      });
      setBusy(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      router.replace("/spaces");
      router.refresh();
      return;
    }
    const formData = new FormData(event.currentTarget);
    const learnerNameValue = formData.get("learnerName");
    const levelValue = formData.get("level");
    setBusy(true);
    const { error } = await supabase.from("family_join_requests").insert({
      paathshala_id: tenantId,
      requester_user_id: user.id,
      learner_name: typeof learnerNameValue === "string" ? learnerNameValue.trim() : "",
      requested_level: typeof levelValue === "string" ? levelValue.trim() : "",
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace("/spaces");
    router.refresh();
  }

  let submitLabel = "Request child enrollment";
  if (joinRole === "teacher") submitLabel = teacherRequestPending ? "Request pending approval" : "Request teacher access";
  if (busy) submitLabel = "Sending request...";

  return <main className="auth-screen"><div className="auth-aside"><BrandLogo variant="complete" className="auth-aside-logo" priority /><p className="auth-verse">Learning begins<br />with belonging.</p><div className="auth-aside-bottom">{joinRole === "teacher" ? "Teacher access is approved by an active teacher." : "Each learner enrollment is reviewed separately."}</div></div><section className="auth-content"><div className="auth-panel"><p className="eyebrow">{joinRole === "teacher" ? "Teacher access" : "Family enrollment"}</p><h1>Join {tenantName}</h1><p className="heading-note">{joinRole === "teacher" ? "Request teacher access to this paathshala." : "Submit an enrollment request for one child at a time."}</p>
    <form className="auth-form" onSubmit={submit}>
      {joinRole === "parent" && <><label className="form-label">Learner name<input className="form-control" name="learnerName" required /></label><label className="form-label">Learning level<input className="form-control" name="level" placeholder="If known" /></label></>}
      {message && <output className="auth-message">{message}</output>}
      <button type="submit" className="primary-button auth-submit" disabled={!tenantId || busy || teacherRequestPending}>{submitLabel}</button>
    </form>
  </div></section></main>;
}