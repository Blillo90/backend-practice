import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const url = import.meta.env.SUPABASE_URL;
    const anon = import.meta.env.SUPABASE_ANON_KEY;

    if (!url || !anon) {
      console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
      return new Response("Server misconfigured", { status: 500 });
    }

    const form = await request.formData();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "").trim();

    const supabase = createClient(url, anon, { auth: { persistSession: false } });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      console.error("Supabase signIn error:", error);
      return new Response("Invalid login", { status: 401 });
    }

    // ✅ secure solo si estás en https (en Vercel normalmente sí)
    const isHttps = request.url.startsWith("https://");

    cookies.set("sb_access_token", data.session.access_token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    // ✅ response redirect explícito
    return new Response(null, {
      status: 303,
      headers: { Location: "/admin" },
    });
  } catch (err) {
    console.error("API /api/login crashed:", err);
    return new Response("Server error", { status: 500 });
  }
};
