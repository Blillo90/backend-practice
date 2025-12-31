import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.SUPABASE_URL;
const anon = import.meta.env.SUPABASE_ANON_KEY;

export const POST: APIRoute = async ({ request, cookies }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "").trim();

  if (!url || !anon) return new Response("Missing env", { status: 500 });

  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) return new Response("Invalid login", { status: 401 });

  cookies.set("sb_access_token", data.session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return Response.redirect(new URL("/admin", request.url), 303);
};
