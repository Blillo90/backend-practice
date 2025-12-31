import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, cookies }) => {
  cookies.delete("sb_access_token", { path: "/" });
  return Response.redirect(new URL("/admin/login", request.url), 303);
};
