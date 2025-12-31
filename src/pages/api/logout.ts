import type { APIRoute } from "astro";

function logout(cookies: any) {
  cookies.delete("sb_access_token", { path: "/" });
  cookies.delete("sb_refresh_token", { path: "/" });
}

export const GET: APIRoute = async ({ cookies }) => {
  logout(cookies);
  return new Response(null, {
    status: 302,
    headers: { Location: "/admin/login" },
  });
};

export const POST: APIRoute = async ({ cookies }) => {
  logout(cookies);
  return new Response(null, {
    status: 303,
    headers: { Location: "/admin/login" },
  });
};
