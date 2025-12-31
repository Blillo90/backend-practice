import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ cookies, request }) => {
  // Borra cookies de sesión (ajusta nombres si usas otros)
  cookies.delete("sb_access_token", { path: "/" });
  cookies.delete("sb_refresh_token", { path: "/" });

  return Response.redirect(new URL("/admin/login", request.url), 303);
};

// Si alguien visita /api/logout a mano (GET), también logout y redirect
export const GET: APIRoute = async ({ cookies, request }) => {
  cookies.delete("sb_access_token", { path: "/" });
  cookies.delete("sb_refresh_token", { path: "/" });

  return Response.redirect(new URL("/admin/login", request.url), 303);
};
