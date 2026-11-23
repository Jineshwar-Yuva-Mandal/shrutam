import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?setup=supabase");
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/spaces" : "/login");
}