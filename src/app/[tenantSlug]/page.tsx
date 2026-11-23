import { notFound, redirect } from "next/navigation";
import Portal from "@/components/portal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type TenantRole = "teacher" | "student";

export default async function TenantPage({ params, searchParams }: Readonly<{
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ role?: string }>;
}>) {
  const [{ tenantSlug }, query] = await Promise.all([params, searchParams]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const tenantPath = `/${tenantSlug}`;
    redirect(`/login?setup=supabase&next=${encodeURIComponent(tenantPath)}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const tenantPath = `/${tenantSlug}`;
    redirect(`/login?next=${encodeURIComponent(tenantPath)}`);
  }

  const { data: tenant } = await supabase
    .from("paathshalas")
    .select("id, name, city")
    .eq("slug", tenantSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (!tenant) notFound();

  const { data: platformAdmin } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();

  const { data: membershipsForTenant } = await supabase
    .from("paathshala_memberships")
    .select("role")
    .eq("paathshala_id", tenant.id)
    .eq("user_id", user.id)
    .eq("status", "active");
  const activeRoles = [...new Set((membershipsForTenant ?? []).map((membership) => membership.role))]
    .filter((role): role is TenantRole => role === "teacher" || role === "student");
  const viewerRoles = resolveViewerRoles(activeRoles, query.role, Boolean(platformAdmin), user.user_metadata.initial_join_role, tenantSlug);

  const { data: memberships } = await supabase
    .from("paathshala_memberships")
    .select("paathshala_id")
    .eq("user_id", user.id)
    .eq("status", "active");
  const tenantIds = (memberships ?? []).map((item) => item.paathshala_id);
  let tenantRows: { name: string; slug: string; city: string }[] = [];
  if (platformAdmin) {
    const result = await supabase.from("paathshalas").select("name, slug, city").eq("is_active", true);
    tenantRows = result.data ?? [];
  } else if (tenantIds.length > 0) {
    const result = await supabase.from("paathshalas").select("name, slug, city").in("id", tenantIds).eq("is_active", true);
    tenantRows = result.data ?? [];
  }
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
  return <Portal
    tenantSlug={tenantSlug}
    tenantId={tenant.id}
    tenantName={tenant.name}
    tenantCity={tenant.city}
    viewerRoles={viewerRoles}
    viewerName={profile?.full_name ?? ""}
    userId={user.id}
    availableTenants={(tenantRows ?? []).map((item) => ({ slug: item.slug, name: item.name, location: item.city }))}
  />;
}

function resolveViewerRoles(activeRoles: TenantRole[], requestedRole: string | undefined, isPlatformAdmin: boolean, initialJoinRole: unknown, tenantSlug: string): TenantRole[] {
  if (isPlatformAdmin) return ["teacher"];
  if (activeRoles.length === 0) {
    const joinRole = initialJoinRole === "teacher" ? "teacher" : "student";
    redirect(`/join/${tenantSlug}?role=${joinRole}`);
  }
  const selectedRole = requestedRole === "teacher" || requestedRole === "student" ? requestedRole : null;
  if (selectedRole && !activeRoles.includes(selectedRole)) redirect("/spaces");
  if (selectedRole) return [selectedRole];
  if (activeRoles.length === 1) return activeRoles;
  redirect("/spaces");
}