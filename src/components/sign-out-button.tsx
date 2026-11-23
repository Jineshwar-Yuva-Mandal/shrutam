"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return <div className="sign-out-control">
    <button type="button" className="secondary-button" onClick={signOut}><LogOut size={14} />Sign out</button>
    {message && <output className="row-detail" role="alert">{message}</output>}
  </div>;
}
