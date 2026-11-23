import { notFound, redirect } from "next/navigation";
import Portal from "@/components/portal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function TenantPage({ params }: Readonly<{ params: Promise<{ tenantSlug: string }> }>) {
  const { tenantSlug } = await params;
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

  const { data: membershipsForTenant } = await supabase
    .from("paathshala_memberships")
    .select("role")
    .eq("paathshala_id", tenant.id)
    .eq("user_id", user.id)
    .eq("status", "active");
  const viewerRoles = [...new Set((membershipsForTenant ?? []).map((membership) => membership.role))];
  if (viewerRoles.length === 0) {
    const requestedRole = user.user_metadata.initial_join_role === "teacher" ? "teacher" : "parent";
    redirect(`/join/${tenantSlug}?role=${requestedRole}`);
  }

  const { data: memberships } = await supabase
    .from("paathshala_memberships")
    .select("paathshala_id")
    .eq("user_id", user.id)
    .eq("status", "active");
  const tenantIds = (memberships ?? []).map((item) => item.paathshala_id);
  const { data: tenantRows } = tenantIds.length
    ? await supabase.from("paathshalas").select("name, slug, city").in("id", tenantIds).eq("is_active", true)
    : { data: [] };
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