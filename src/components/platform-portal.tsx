"use client";

import { SyntheticEvent, useEffect, useState } from "react";
import { Check, LogOut, Plus, School, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/brand-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Tenant = { id: string; name: string; slug: string; city: string };
type TeacherRequest = { id: string; name: string; tenantName: string; createdAt: string };

export default function PlatformPortal({ viewerName = "Platform admin" }: Readonly<{ viewerName?: string }>) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [teacherRequests, setTeacherRequests] = useState<TeacherRequest[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    async function loadPlatformData(client: NonNullable<typeof supabase>) {
      const [tenantResult, requestResult] = await Promise.all([
        client.from("paathshalas").select("id, name, slug, city").order("name"),
        client.from("paathshala_memberships").select("id, user_id, paathshala_id, created_at").eq("role", "teacher").eq("status", "pending").order("created_at"),
      ]);
      if (!active) return;
      const error = tenantResult.error ?? requestResult.error;
      if (error) {
        setMessage(error.message);
        return;
      }

      const requests = requestResult.data ?? [];
      const tenantIds = [...new Set(requests.map((request) => request.paathshala_id))];
      const userIds = [...new Set(requests.map((request) => request.user_id))];
      const [requestTenants, profiles] = await Promise.all([
        tenantIds.length ? client.from("paathshalas").select("id,name").in("id", tenantIds) : Promise.resolve({ data: [], error: null }),
        userIds.length ? client.from("profiles").select("user_id,full_name").in("user_id", userIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (!active) return;
      if (requestTenants.error || profiles.error) {
        setMessage(requestTenants.error?.message ?? profiles.error?.message ?? "Could not load teacher requests");
        return;
      }
      const tenantNames = new Map((requestTenants.data ?? []).map((tenant) => [tenant.id, tenant.name]));
      const profileNames = new Map((profiles.data ?? []).map((profile) => [profile.user_id, profile.full_name]));
      setTenants((tenantResult.data ?? []) as Tenant[]);
      setTeacherRequests(requests.map((request) => ({
        id: request.id,
        name: profileNames.get(request.user_id) || "Teacher applicant",
        tenantName: tenantNames.get(request.paathshala_id) || "Paathshala",
        createdAt: request.created_at,
      })));
    }

    void loadPlatformData(client);
    return () => { active = false; };
  }, [supabase]);

  async function createPaathshala(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = readText(formData, "name");
    const slug = readText(formData, "slug").toLowerCase();
    const city = readText(formData, "city");
    const teacherUserId = readText(formData, "teacherUserId");
    if (!supabase || !name || !slug) return;

    setBusy(true);
    const { error } = await supabase.rpc("provision_paathshala", {
      p_name: name,
      p_slug: slug,
      p_city: city,
      p_teacher_user_id: teacherUserId || null,
    });
    setBusy(false);
    setMessage(error ? error.message : "Paathshala created");
    if (!error) {
      form.reset();
      const { data } = await supabase.from("paathshalas").select("id, name, slug, city").order("name");
      if (data) setTenants(data as Tenant[]);
    }
  }

  async function approveTeacher(requestId: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("approve_teacher_membership", { p_membership_id: requestId });
    setMessage(error ? error.message : "Teacher access approved");
    if (!error) setTeacherRequests((current) => current.filter((request) => request.id !== requestId));
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <main className="platform-shell">
    <header className="platform-header">
      <Link className="platform-brand" href="/" aria-label="Shrutam home"><BrandLogo variant="text" className="platform-brand-logo" priority /></Link>
      <div className="platform-user"><span>{viewerName}</span><button type="button" className="secondary-button" onClick={signOut}><LogOut size={14} /> Sign out</button></div>
    </header>
    <div className="platform-content">
      <div className="page-heading"><div><p className="eyebrow">Platform operations</p><h1>Paathshalas</h1><p className="heading-note">Provision community spaces and review teacher access.</p></div><span className="pill"><ShieldCheck size={12} /> Platform admin</span></div>
      {!supabase && <div className="notice">Supabase is not configured. Add the project URL and public key to manage paathshalas.</div>}
      {message && <output className="notice platform-message">{message}</output>}
      <div className="content-grid">
        <section className="panel">
          <div className="panel-header"><div><h2 className="panel-title">Create a paathshala</h2><p className="panel-subtitle">An optional first teacher can be assigned at setup.</p></div></div>
          <form className="panel-body wide-form" onSubmit={createPaathshala}>
            <label className="form-label">Paathshala name<input className="form-control" name="name" required /></label>
            <label className="form-label">URL code<input className="form-control" name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="e.g. rajajinagar" required /></label>
            <label className="form-label">City<input className="form-control" name="city" /></label>
            <label className="form-label">First teacher user ID<input className="form-control" name="teacherUserId" placeholder="Optional UUID of an existing Auth user" /></label>
            <button type="submit" className="primary-button" disabled={!supabase || busy}><Plus size={14} /> {busy ? "Creating..." : "Create paathshala"}</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-header"><div><h2 className="panel-title">Teacher access requests</h2><p className="panel-subtitle">Approve a teacher to activate their paathshala membership.</p></div><span className="pill warm">{teacherRequests.length} pending</span></div>
          <div className="panel-body">{teacherRequests.length === 0 ? <div className="empty-state">No pending teacher requests.</div> : teacherRequests.map((request) => <div className="student-row" key={request.id}><div className="row-main"><p className="row-title">{request.name}</p><p className="row-detail">{request.tenantName} · {new Date(request.createdAt).toLocaleDateString()}</p></div><button type="button" className="secondary-button" onClick={() => approveTeacher(request.id)}><Check size={13} /> Approve</button></div>)}</div>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-header"><div><h2 className="panel-title">Active paathshalas</h2><p className="panel-subtitle">{tenants.length} spaces</p></div></div>
        <div className="panel-body">{tenants.map((tenant) => <div className="event-row" key={tenant.id}><span className="metric-icon"><School size={16} /></span><div className="row-main"><p className="row-title">{tenant.name}</p><p className="row-detail">/{tenant.slug} · {tenant.city || "City not set"}</p></div><Link className="quiet-button" href={`/${tenant.slug}`}>Open space</Link></div>)}</div>
      </section>
    </div>
  </main>;
}

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}