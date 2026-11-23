"use client";

import { useRouter } from "next/navigation";
import { SyntheticEvent } from "react";

export default function PaathshalaCodeForm() {
  const router = useRouter();

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = formData.get("paathshalaCode");
    if (typeof code !== "string") return;
    const slug = code.trim().toLowerCase();
    if (!slug) return;
    const role = formData.get("joinRole") === "teacher" ? "teacher" : "parent";
    router.push(`/join/${encodeURIComponent(slug)}?role=${role}`);
  }

  return <form className="join-space-form" onSubmit={submit}>
    <label className="form-label">Paathshala code<input className="form-control" name="paathshalaCode" placeholder="e.g. rajajinagar" pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" required /></label>
    <label className="form-label">Join as<select className="form-control" name="joinRole" defaultValue="parent"><option value="parent">Parent</option><option value="teacher">Teacher</option></select></label>
    <button className="primary-button" type="submit">Continue</button>
  </form>;
}
