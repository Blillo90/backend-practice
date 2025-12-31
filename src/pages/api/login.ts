import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request }) => {
  const url = import.meta.env.SUPABASE_URL;
  const anon = import.meta.env.SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "").trim();

  const supabase = createClient(url, anon, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return new Response("Invalid login", { status: 401 });
  }

  // ✅ Creamos la response primero
  const response = new Response(null, {
    status: 303,
    headers: {
      Location: "/admin",
    },
  });

  // ✅ Seteamos la cookie SOBRE la response
  response.headers.append(
    "Set-Cookie",
    `sb_access_token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax; Secure`
  );

  return response;
};
