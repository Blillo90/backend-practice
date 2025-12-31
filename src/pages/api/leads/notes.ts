import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const supaUrl = import.meta.env.SUPABASE_URL!;
const anon = import.meta.env.SUPABASE_ANON_KEY!;
const service = import.meta.env.SUPABASE_SERVICE_ROLE_KEY!;

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("sb_access_token")?.value;
  if (!token) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000);
  const redirectTo = String(form.get("redirectTo") ?? "/admin");

  if (!id) return new Response("Bad request", { status: 400 });

  const supaUser = createClient(supaUrl, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData } = await supaUser.auth.getUser();
  if (!userData?.user) return new Response("Unauthorized", { status: 401 });

  const { data: prof } = await supaUser
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!prof?.is_admin) return new Response("Forbidden", { status: 403 });

  const supaAdmin = createClient(supaUrl, service, { auth: { persistSession: false } });

  const { error } = await supaAdmin.from("leads").update({ notes }).eq("id", id);
  if (error) {
    console.error("Update notes error:", error);
    return new Response("Server error", { status: 500 });
  }

  return Response.redirect(new URL(redirectTo, request.url), 303);
};
