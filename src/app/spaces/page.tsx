import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, School } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import PaathshalaCodeForm from "@/components/paathshala-code-form";
import SignOutButton from "@/components/sign-out-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Space = { slug: string; name: string; city: string; role: "teacher" | "student" };
type PendingSpaceRequest = { id: string; tenantName: string; role: "Teacher" | "Student"; description: string };

export default async function SpacesPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?setup=supabase&next=%2Fspaces");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fspaces");
  const { data: platformAdmin } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (platformAdmin) redirect("/platform");

  const { data: memberships } = await supabase
    .from("paathshala_memberships")
    .select("id, paathshala_id, role, status")
    .eq("user_id", user.id);
  const activeMemberships = (memberships ?? []).filter((item) => item.status === "active");
  const rolesByTenant = new Map<string, Set<"teacher" | "student">>();
  for (const membership of activeMemberships) {
    if (membership.role !== "teacher" && membership.role !== "student") continue;
    const roles = rolesByTenant.get(membership.paathshala_id) ?? new Set<"teacher" | "student">();
    roles.add(membership.role);
    rolesByTenant.set(membership.paathshala_id, roles);
  }
  const pendingMemberships = (memberships ?? []).filter((item) => item.status === "pending");
  const tenantIds = [...new Set([
    ...rolesByTenant.keys(),
    ...pendingMemberships.map((item) => item.paathshala_id),
  ])];
  const { data: tenants } = tenantIds.length
    ? await supabase.from("paathshalas").select("id, name, slug, city").in("id", tenantIds).eq("is_active", true).order("name")
    : { data: [] };

  const activeSpaces = (tenants ?? []).flatMap((tenant) => [...(rolesByTenant.get(tenant.id) ?? [])].map((role) => ({
    slug: tenant.slug,
    name: tenant.name,
    city: tenant.city,
    role,
  })));
  const pendingRequests: PendingSpaceRequest[] = [
    ...pendingMemberships.map((request) => ({
      id: request.id,
      tenantName: (tenants ?? []).find((tenant) => tenant.id === request.paathshala_id)?.name ?? "Paathshala",
      role: request.role === "teacher" ? "Teacher" as const : "Student" as const,
      description: "This request is waiting for paathshala approval.",
    })),
  ];
  if (activeSpaces.length === 1 && pendingRequests.length === 0) redirect(`/${activeSpaces[0].slug}?role=${activeSpaces[0].role}`);
  return <SpacesList spaces={activeSpaces} pendingRequests={pendingRequests} />;
}

function SpacesList({ spaces, pendingRequests }: Readonly<{ spaces: Space[]; pendingRequests: PendingSpaceRequest[] }>) {
  return <main className="platform-shell spaces-shell">
    <header className="platform-header spaces-header">
      <div className="spaces-header-inner">
        <Link className="spaces-brand-link" href="/" aria-label="Shrutam home"><BrandLogo variant="complete" className="spaces-brand-logo" priority /></Link>
        <SignOutButton />
      </div>
    </header>
    <div className="spaces-content">
      <div className="spaces-intro">
        <p className="eyebrow">Your memberships</p>
        <h1>Choose how to continue</h1>
        <p className="heading-note">Select a paathshala and role for this session.</p>
        <span className="spaces-count">{spaces.length} {spaces.length === 1 ? "view" : "views"} available</span>
      </div>
      <div className="tenant-space-list spaces-grid">{spaces.map((space) => <Link className="tenant-space" href={`/${space.slug}?role=${space.role}`} key={`${space.slug}-${space.role}`}>
        <div className="metric-icon"><School size={19} /></div>
        <div className="row-main"><p className="row-title">{space.name}</p><p className="row-detail">{space.city || "City not set"}</p></div>
        <span className="tenant-space-meta"><span className="pill">{space.role === "teacher" ? "Teacher view" : "Student view"}</span><ArrowRight size={16} /></span>
      </Link>)}
      {pendingRequests.length > 0 && <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Requests awaiting review</h2><p className="panel-subtitle">A pending request already exists for these paathshala roles.</p></div></div><div className="panel-body">{pendingRequests.map((request) => <div className="student-row" key={request.id}><div className="row-main"><p className="row-title">{request.tenantName}</p><p className="row-detail">{request.role} access · {request.description}</p></div><span className="pill warm">Pending approval</span></div>)}</div></section>}
      <section className="panel"><div className="panel-header"><div><h2 className="panel-title">{spaces.length === 0 ? "Join a paathshala" : "Add another paathshala"}</h2><p className="panel-subtitle">Enter the code shared by your paathshala.</p></div></div><div className="panel-body"><PaathshalaCodeForm /></div></section>
      </div>
    </div>
  </main>;
}