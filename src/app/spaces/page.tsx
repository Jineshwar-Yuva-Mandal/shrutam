import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, School } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import PaathshalaCodeForm from "@/components/paathshala-code-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Space = { slug: string; name: string; city: string; roles: string[] };
type PendingSpaceRequest = { id: string; tenantName: string; description: string };

export default async function SpacesPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?setup=supabase&next=%2Fspaces");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fspaces");
  const { data: platformAdmin } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (platformAdmin) redirect("/platform");

  const { data: memberships } = await supabase
    .from("paathshala_memberships")
    .select("paathshala_id, role, status")
    .eq("user_id", user.id);
  const rolesByTenant = new Map<string, string[]>();
  for (const membership of (memberships ?? []).filter((item) => item.status === "active")) {
    const roles = rolesByTenant.get(membership.paathshala_id) ?? [];
    if (!roles.includes(membership.role)) roles.push(membership.role);
    rolesByTenant.set(membership.paathshala_id, roles);
  }
  const pendingMemberships = (memberships ?? []).filter((item) => item.status === "pending");
  const { data: familyRequests } = await supabase.from("family_join_requests")
    .select("id, paathshala_id, learner_name")
    .eq("requester_user_id", user.id)
    .eq("status", "pending");
  const tenantIds = [...new Set([
    ...rolesByTenant.keys(),
    ...pendingMemberships.map((item) => item.paathshala_id),
    ...(familyRequests ?? []).map((item) => item.paathshala_id),
  ])];
  const { data: tenants } = tenantIds.length
    ? await supabase.from("paathshalas").select("id, name, slug, city").in("id", tenantIds).eq("is_active", true).order("name")
    : { data: [] };

  const activeTenants = (tenants ?? []).filter((tenant) => rolesByTenant.has(tenant.id));
  const pendingRequests: PendingSpaceRequest[] = [
    ...pendingMemberships.map((request) => ({
      id: request.paathshala_id,
      tenantName: (tenants ?? []).find((tenant) => tenant.id === request.paathshala_id)?.name ?? "Paathshala",
      description: "Teacher access is waiting for approval.",
    })),
    ...(familyRequests ?? []).map((request) => ({
      id: request.id,
      tenantName: (tenants ?? []).find((tenant) => tenant.id === request.paathshala_id)?.name ?? "Paathshala",
      description: `Enrollment request for ${request.learner_name} is waiting for review.`,
    })),
  ];
  if (activeTenants.length === 1 && pendingRequests.length === 0) redirect(`/${activeTenants[0].slug}`);
  return <SpacesList spaces={activeTenants.map((tenant) => ({
    slug: tenant.slug,
    name: tenant.name,
    city: tenant.city,
    roles: rolesByTenant.get(tenant.id) ?? [],
  }))} pendingRequests={pendingRequests} />;
}

function SpacesList({ spaces, pendingRequests }: Readonly<{ spaces: Space[]; pendingRequests: PendingSpaceRequest[] }>) {
  return <main className="platform-shell spaces-shell">
    <header className="platform-header spaces-header">
      <div className="spaces-header-inner">
        <Link className="spaces-brand-link" href="/" aria-label="Shrutam home"><BrandLogo variant="complete" className="spaces-brand-logo" priority /></Link>
        <span className="role-label">Your spaces</span>
      </div>
    </header>
    <div className="spaces-content">
      <div className="spaces-intro">
        <p className="eyebrow">Your memberships</p>
        <h1>Choose your paathshala</h1>
        <p className="heading-note">Select a space to continue. Your access is based on your membership there.</p>
        <span className="spaces-count">{spaces.length} {spaces.length === 1 ? "space" : "spaces"} available</span>
      </div>
      <div className="tenant-space-list spaces-grid">{spaces.map((space) => <Link className="tenant-space" href={`/${space.slug}`} key={space.slug}>
        <div className="metric-icon"><School size={19} /></div>
        <div className="row-main"><p className="row-title">{space.name}</p><p className="row-detail">{space.city || "City not set"}</p></div>
        <span className="tenant-space-meta"><span className="pill">{space.roles.map((role) => role === "teacher" ? "Teacher" : "Parent").join(" + ")}</span><ArrowRight size={16} /></span>
      </Link>)}
      {pendingRequests.length > 0 && <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Requests awaiting review</h2><p className="panel-subtitle">Your access and enrollment requests</p></div></div><div className="panel-body">{pendingRequests.map((request) => <div className="student-row" key={request.id}><div className="row-main"><p className="row-title">{request.tenantName}</p><p className="row-detail">{request.description}</p></div><span className="pill warm">Pending</span></div>)}</div></section>}
      {spaces.length === 0 && pendingRequests.length === 0 && <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Join a paathshala</h2><p className="panel-subtitle">Enter the code shared by your paathshala.</p></div></div><div className="panel-body"><PaathshalaCodeForm /></div></section>}
      </div>
    </div>
  </main>;
}