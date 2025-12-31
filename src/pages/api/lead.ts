import type { APIRoute } from "astro";
import { supabaseServer } from "../../lib/supabaseServer";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();

  // Honeypot
  const company = String(form.get("company") ?? "");
  if (company.trim().length > 0) {
    return new Response(null, { status: 204 });
  }

  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (name.length < 2 || !email.includes("@") || message.length < 10) {
    return new Response("Invalid input", { status: 400 });
  }

  const ua = request.headers.get("user-agent") ?? null;

  // (Opcional) IP real en Vercel suele venir en x-forwarded-for
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await supabaseServer.from("leads").insert([
    { name, email, message, source: "landing", ip, user_agent: ua },
  ]);

  if (error) {
    return new Response("Database error", { status: 500 });
  }

  return Response.redirect(new URL("/gracias", request.url), 303);
};
