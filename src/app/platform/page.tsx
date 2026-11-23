import { redirect } from "next/navigation";
import PlatformPortal from "@/components/platform-portal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PlatformPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?setup=supabase&next=%2Fplatform");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fplatform");

  const { data: platformAdmin } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!platformAdmin) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
  return <PlatformPortal viewerName={profile?.full_name ?? user.email ?? "Platform admin"} />;
}