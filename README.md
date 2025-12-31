# Backend Practice (Astro + Tailwind v4 + Supabase + Vercel)
Guía **completa** (con **todo el código**, comandos, SQL de Supabase, configuración y pasos de Vercel) para una landing con formulario + dashboard admin (sin JavaScript en cliente).

> **Repositorio recomendado:** `backend-practice/` (raíz del proyecto)  
> **Frontend landing:** sin scripts (HTML + form POST)  
> **Backend:** Astro API routes (`/api/*`)  
> **Dashboard:** SSR (Astro) + cookies + RLS en Supabase

---

## Índice
- [1. Requisitos](#1-requisitos)
- [2. Crear proyecto](#2-crear-proyecto)
- [3. Tailwind v4](#3-tailwind-v4)
- [4. Configurar Astro para Vercel (server output)](#4-configurar-astro-para-vercel-server-output)
- [5. Estructura final del proyecto](#5-estructura-final-del-proyecto)
- [6. Variables de entorno](#6-variables-de-entorno)
- [7. Supabase: tablas + RLS (SQL completo)](#7-supabase-tablas--rls-sql-completo)
- [8. Código completo del proyecto](#8-código-completo-del-proyecto)
  - [8.1 Layout](#81-layout)
  - [8.2 Estilos](#82-estilos)
  - [8.3 Landing y páginas](#83-landing-y-páginas)
  - [8.4 Dashboard admin](#84-dashboard-admin)
  - [8.5 Endpoints API](#85-endpoints-api)
- [9. Crear usuario admin (manual)](#9-crear-usuario-admin-manual)
- [10. Probar en local](#10-probar-en-local)
- [11. Deploy en Vercel (paso a paso)](#11-deploy-en-vercel-paso-a-paso)
- [12. Commits de Git recomendados](#12-commits-de-git-recomendados)
- [13. Checklist final](#13-checklist-final)
- [14. Notas de seguridad](#14-notas-de-seguridad)

---

## 1. Requisitos
- Node.js 18+ (recomendado 20+)
- Cuenta en Supabase
- Cuenta en Vercel
- Git + GitHub

---

## 2. Crear proyecto
```bash
mkdir backend-practice
cd backend-practice

npm create astro@latest
# Template: Minimal o Empty
# TypeScript: Yes (recomendado)

npm install
```

---

## 3. Tailwind v4
Instala Tailwind 4 con el plugin de Vite:

```bash
npm i -D tailwindcss @tailwindcss/vite
```

---

## 4. Configurar Astro para Vercel (server output)
Necesitas **output server** + adapter de Vercel para que `/api/*` funcione en producción.

```bash
npm i @astrojs/vercel
```

### `astro.config.mjs`
```js
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel/serverless";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});
```

---

## 5. Estructura final del proyecto
```
backend-practice/
  src/
    layouts/
      BaseLayout.astro
    pages/
      index.astro
      gracias.astro
      admin/
        login.astro
        index.astro
      api/
        lead.ts
        login.ts
        logout.ts
        leads/
          contacted.ts
          notes.ts
    styles/
      global.css
  .env               (local, NO subir)
  .env.example       (sí subir)
  astro.config.mjs
  package.json
```

---

## 6. Variables de entorno

### 6.1 `.env.example` (subir a GitHub)
Crea un archivo `.env.example`:
```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 6.2 `.env` (local, NO subir)
Crea `.env` en la raíz:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

> **Importante:** `SUPABASE_SERVICE_ROLE_KEY` es **secreta**. No la metas en cliente ni la subas a GitHub.

---

## 7. Supabase: tablas + RLS (SQL completo)

### 7.1 Crear tablas
Supabase → **SQL Editor** → New query → pega y ejecuta:

```sql
-- 1) Tabla leads
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  message text not null,
  source text default 'landing',
  ip text,
  user_agent text,

  contacted boolean not null default false,
  contacted_at timestamptz null,
  notes text null
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_contacted_idx on public.leads (contacted);

-- 2) Tabla profiles (para admins)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists profiles_is_admin_idx on public.profiles (is_admin);
```

### 7.2 Activar RLS
```sql
alter table public.leads enable row level security;
alter table public.profiles enable row level security;
```

### 7.3 Policies (RLS)
**Leads: SELECT/UPDATE solo admins**  
(El insert del formulario lo haremos con Service Role desde el backend, por eso no abrimos INSERT a público.)

```sql
-- Admins pueden leer leads
drop policy if exists "Admins can read leads" on public.leads;
create policy "Admins can read leads"
on public.leads
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

-- Admins pueden actualizar leads (contacted/notes)
drop policy if exists "Admins can update leads" on public.leads;
create policy "Admins can update leads"
on public.leads
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

-- Profiles: el usuario puede leerse a sí mismo (para comprobar is_admin si lo necesitas)
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());
```

### 7.4 Auth settings
En Supabase → **Authentication → Providers**:
- Asegúrate de que **Email** está habilitado (por defecto sí).

---

## 8. Código completo del proyecto

### 8.1 Layout

#### `src/layouts/BaseLayout.astro`
```astro
---
const { title = "Backend Practice" } = Astro.props;
import "../styles/global.css";
---

<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>

  <body class="min-h-screen bg-zinc-950 text-zinc-100">
    <slot />
  </body>
</html>
```

---

### 8.2 Estilos

#### `src/styles/global.css`
```css
@import "tailwindcss";
```

---

### 8.3 Landing y páginas

#### `src/pages/index.astro` (landing sin scripts)
```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="Landing • Contacto">
  <main class="mx-auto max-w-2xl px-6 py-16">
    <h1 class="text-3xl font-semibold">Landing de ejemplo</h1>
    <p class="mt-2 text-zinc-400">
      Formulario clásico (sin JS) que envía a un endpoint backend en Astro.
    </p>

    <form method="POST" action="/api/lead" class="mt-10 space-y-4 rounded-2xl border border-zinc-800 p-6">
      <!-- Honeypot anti-spam -->
      <input type="text" name="company" tabindex="-1" autocomplete="off" class="hidden" />

      <div>
        <label class="text-sm text-zinc-300">Nombre</label>
        <input
          class="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2"
          name="name"
          required
          minlength="2"
        />
      </div>

      <div>
        <label class="text-sm text-zinc-300">Email</label>
        <input
          class="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2"
          name="email"
          type="email"
          required
        />
      </div>

      <div>
        <label class="text-sm text-zinc-300">Mensaje</label>
        <textarea
          class="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2"
          name="message"
          rows="5"
          required
          minlength="10"
        ></textarea>
      </div>

      <button class="w-full rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900">
        Enviar
      </button>

      <p class="text-xs text-zinc-500">
        En producción, el backend guarda el lead en Supabase y redirige a /gracias.
      </p>
    </form>

    <div class="mt-8">
      <a class="text-sm text-zinc-300 underline" href="/admin/login">Ir al Dashboard</a>
    </div>
  </main>
</BaseLayout>
```

#### `src/pages/gracias.astro`
```astro
---
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="Gracias">
  <main class="mx-auto max-w-2xl px-6 py-16">
    <h1 class="text-3xl font-semibold">¡Gracias!</h1>
    <p class="mt-2 text-zinc-400">Hemos recibido tu mensaje. Te contactaremos pronto.</p>
    <a class="mt-8 inline-block rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900" href="/">
      Volver
    </a>
  </main>
</BaseLayout>
```

---

### 8.4 Dashboard admin

#### `src/pages/admin/login.astro`
```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
const hasToken = Boolean(Astro.cookies.get("sb_access_token")?.value);
if (hasToken) return Astro.redirect("/admin");
---

<BaseLayout title="Admin • Login">
  <main class="mx-auto max-w-md px-6 py-16">
    <h1 class="text-2xl font-semibold">Acceso Admin</h1>
    <p class="mt-2 text-zinc-400">Inicia sesión con tu email y contraseña.</p>

    <form method="POST" action="/api/login" class="mt-8 space-y-4 rounded-2xl border border-zinc-800 p-6">
      <div>
        <label class="text-sm text-zinc-300">Email</label>
        <input
          class="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2"
          name="email"
          type="email"
          required
        />
      </div>

      <div>
        <label class="text-sm text-zinc-300">Contraseña</label>
        <input
          class="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2"
          name="password"
          type="password"
          required
        />
      </div>

      <button class="w-full rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900">
        Entrar
      </button>
    </form>
  </main>
</BaseLayout>
```

#### `src/pages/admin/index.astro` (dashboard PRO, sin JS)
```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";
import { createClient } from "@supabase/supabase-js";

/* =====================
   Auth
===================== */
const token = Astro.cookies.get("sb_access_token")?.value;
if (!token) return Astro.redirect("/admin/login");

const url = import.meta.env.SUPABASE_URL;
const anon = import.meta.env.SUPABASE_ANON_KEY;

const supabase = createClient(url, anon, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${token}` } },
});

// Validar token
const { data: userData } = await supabase.auth.getUser();
if (!userData?.user) {
  Astro.cookies.delete("sb_access_token", { path: "/" });
  return Astro.redirect("/admin/login");
}

const userEmail = userData.user.email ?? "usuario";

/* =====================
   Filtros (query params)
===================== */
const q = (Astro.url.searchParams.get("q") ?? "").trim();
const status = (Astro.url.searchParams.get("status") ?? "all").trim(); // all | pending | contacted

/* =====================
   Query leads
===================== */
let query = supabase
  .from("leads")
  .select("id, created_at, name, email, message, contacted, contacted_at, notes")
  .order("created_at", { ascending: false })
  .limit(200);

if (status === "pending") query = query.eq("contacted", false);
if (status === "contacted") query = query.eq("contacted", true);

if (q.length > 0) {
  const safe = q.replaceAll(",", " ");
  query = query.or(
    `name.ilike.%${safe}%,email.ilike.%${safe}%,message.ilike.%${safe}%`
  );
}

const { data: leads, error } = await query;

/* =====================
   KPIs
===================== */
const total = leads?.length ?? 0;
const contactedCount = (leads ?? []).filter((l) => l.contacted).length;
const pendingCount = total - contactedCount;
---

<BaseLayout title="Admin • Leads">
  <main class="mx-auto max-w-6xl px-6 py-16">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">Leads</h1>
        <p class="mt-1 text-sm text-zinc-400">
          Bienvenido, <span class="text-zinc-200">{userEmail}</span>
        </p>
      </div>

      <form method="POST" action="/api/logout">
        <button class="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900">
          Salir
        </button>
      </form>
    </div>

    <!-- KPIs -->
    <div class="mt-6 grid grid-cols-3 gap-4">
      <div class="rounded-xl border border-zinc-800 p-4">
        <p class="text-sm text-zinc-400">Total</p>
        <p class="text-2xl font-semibold">{total}</p>
      </div>
      <div class="rounded-xl border border-zinc-800 p-4">
        <p class="text-sm text-zinc-400">Pendientes</p>
        <p class="text-2xl font-semibold">{pendingCount}</p>
      </div>
      <div class="rounded-xl border border-zinc-800 p-4">
        <p class="text-sm text-zinc-400">Contactados</p>
        <p class="text-2xl font-semibold">{contactedCount}</p>
      </div>
    </div>

    <!-- Filtros -->
    <form class="mt-8 flex flex-wrap gap-3" method="GET" action="/admin">
      <input
        class="w-72 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2"
        type="text"
        name="q"
        placeholder="Buscar por nombre, email o mensaje…"
        value={q}
      />

      <select class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2" name="status">
        <option value="all" selected={status === "all"}>Todos</option>
        <option value="pending" selected={status === "pending"}>Pendientes</option>
        <option value="contacted" selected={status === "contacted"}>Contactados</option>
      </select>

      <button class="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900">
        Filtrar
      </button>

      <a
        class="rounded-xl border border-zinc-700 px-4 py-2 hover:bg-zinc-900"
        href={`/admin?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`}
      >
        Refresh
      </a>
    </form>

    {error && (
      <p class="mt-6 rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200">
        Error o no autorizado al leer los leads.
      </p>
    )}

    <div class="mt-8 overflow-x-auto rounded-2xl border border-zinc-800">
      <table class="w-full text-left text-sm">
        <thead class="bg-zinc-900/60 text-zinc-200">
          <tr>
            <th class="p-3">Fecha</th>
            <th class="p-3">Nombre</th>
            <th class="p-3">Email</th>
            <th class="p-3">Mensaje</th>
            <th class="p-3">Estado</th>
            <th class="p-3">Notas</th>
          </tr>
        </thead>

        <tbody>
          {(leads ?? []).map((l) => (
            <tr class="border-t border-zinc-800 align-top">
              <td class="p-3 text-zinc-400">{new Date(l.created_at).toLocaleString("es-ES")}</td>
              <td class="p-3">{l.name}</td>
              <td class="p-3 text-zinc-400">{l.email}</td>
              <td class="p-3 text-zinc-400 max-w-sm">{l.message}</td>

              <td class="p-3">
                <form method="POST" action="/api/leads/contacted">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="next" value={String(!l.contacted)} />
                  <input type="hidden" name="redirectTo" value={Astro.url.pathname + Astro.url.search} />

                  <button
                    class={`rounded-xl border px-3 py-1 ${
                      l.contacted
                        ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
                        : "border-zinc-700 bg-zinc-950 text-zinc-200"
                    } hover:bg-zinc-900`}
                  >
                    {l.contacted ? "Contactado" : "Pendiente"}
                  </button>

                  {l.contacted_at && (
                    <div class="mt-1 text-xs text-zinc-500">
                      {new Date(l.contacted_at).toLocaleString("es-ES")}
                    </div>
                  )}
                </form>
              </td>

              <td class="p-3">
                <form method="POST" action="/api/leads/notes" class="flex gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="redirectTo" value={Astro.url.pathname + Astro.url.search} />

                  <textarea
                    name="notes"
                    rows="2"
                    class="min-w-[260px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                    placeholder="Notas internas"
                  >{l.notes ?? ""}</textarea>

                  <button class="rounded-xl border border-zinc-700 px-3 py-2 hover:bg-zinc-900">
                    Guardar
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(leads?.length ?? 0) === 0 && !error && (
        <div class="p-6 text-sm text-zinc-400">No hay resultados con estos filtros.</div>
      )}
    </div>
  </main>
</BaseLayout>
```

---

### 8.5 Endpoints API

#### `src/pages/api/lead.ts` (insert público usando Service Role)
```ts
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();

  // Honeypot (si lo rellenan, es bot)
  const company = String(form.get("company") ?? "");
  if (company.trim().length > 0) return new Response(null, { status: 204 });

  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (name.length < 2 || !email.includes("@") || message.length < 10) {
    return new Response("Invalid input", { status: 400 });
  }

  const url = import.meta.env.SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return new Response("Server misconfigured", { status: 500 });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const ua = request.headers.get("user-agent") ?? null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await supabase.from("leads").insert([
    { name, email, message, source: "landing", ip, user_agent: ua },
  ]);

  if (error) {
    console.error("Insert lead error:", error);
    return new Response("Database error", { status: 500 });
  }

  return Response.redirect(new URL("/gracias", request.url), 303);
};
```

#### `src/pages/api/login.ts` (cookie session)
```ts
import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request }) => {
  const url = import.meta.env.SUPABASE_URL;
  const anon = import.meta.env.SUPABASE_ANON_KEY;

  if (!url || !anon) return new Response("Server misconfigured", { status: 500 });

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "").trim();

  if (!email || !password) return new Response("Missing credentials", { status: 400 });

  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) return new Response("Invalid login", { status: 401 });

  // Response + cookie (compatible con Vercel)
  const res = new Response(null, { status: 303, headers: { Location: "/admin" } });

  res.headers.append(
    "Set-Cookie",
    `sb_access_token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax; Secure`
  );

  return res;
};
```

#### `src/pages/api/logout.ts` (logout robusto)
```ts
import type { APIRoute } from "astro";

function expire(name: string) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;
}

export const POST: APIRoute = async () => {
  const res = new Response(null, { status: 303, headers: { Location: "/admin/login" } });
  res.headers.append("Set-Cookie", expire("sb_access_token"));
  res.headers.append("Set-Cookie", expire("sb_refresh_token"));
  return res;
};

export const GET: APIRoute = async () => {
  const res = new Response(null, { status: 302, headers: { Location: "/admin/login" } });
  res.headers.append("Set-Cookie", expire("sb_access_token"));
  res.headers.append("Set-Cookie", expire("sb_refresh_token"));
  return res;
};
```

#### `src/pages/api/leads/contacted.ts` (toggle contacted)
```ts
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
  const next = String(form.get("next") ?? "").trim(); // "true" | "false"
  const redirectTo = String(form.get("redirectTo") ?? "/admin");

  if (!id || (next !== "true" && next !== "false")) return new Response("Bad request", { status: 400 });

  // Validar user (anon + bearer)
  const supaUser = createClient(supaUrl, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData } = await supaUser.auth.getUser();
  if (!userData?.user) return new Response("Unauthorized", { status: 401 });

  // Comprobar admin por RLS (profiles select permitido solo a sí mismo)
  const { data: prof } = await supaUser
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!prof?.is_admin) return new Response("Forbidden", { status: 403 });

  // Actualizar con service role
  const supaAdmin = createClient(supaUrl, service, { auth: { persistSession: false } });

  const contacted = next === "true";
  const { error } = await supaAdmin
    .from("leads")
    .update({ contacted, contacted_at: contacted ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) {
    console.error("Update contacted error:", error);
    return new Response("Server error", { status: 500 });
  }

  return new Response(null, { status: 303, headers: { Location: redirectTo } });
};
```

#### `src/pages/api/leads/notes.ts` (save notes)
```ts
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

  // Validar user
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

  // Guardar con service role
  const supaAdmin = createClient(supaUrl, service, { auth: { persistSession: false } });
  const { error } = await supaAdmin.from("leads").update({ notes }).eq("id", id);

  if (error) {
    console.error("Update notes error:", error);
    return new Response("Server error", { status: 500 });
  }

  return new Response(null, { status: 303, headers: { Location: redirectTo } });
};
```

---

## 9. Crear usuario admin (manual)

1) En Supabase → **Authentication → Users** crea o registra el usuario (email/password).  
2) Copia el UUID del usuario.  
3) En Supabase → SQL Editor:

```sql
insert into public.profiles (id, is_admin)
values ('TU_UUID_AQUI', true)
on conflict (id) do update set is_admin = true;
```

---

## 10. Probar en local

```bash
npm run dev
```

Pruebas:
- `http://localhost:4321/` → envía form → te manda a `/gracias` → aparece fila en `leads`
- `http://localhost:4321/admin/login` → login → `/admin` → lista leads
- Botón **Salir** → vuelve a login

---

## 11. Deploy en Vercel (paso a paso)

### 11.1 Subir a GitHub
```bash
git init
git add .
git commit -m "chore: init backend-practice"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 11.2 Import en Vercel
1) Vercel → **Add New → Project**
2) Importa tu repo de GitHub
3) Framework detectado: Astro
4) Deploy

### 11.3 Environment Variables (Vercel)
Project → **Settings → Environment Variables**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Marca al menos:
- Production
- (Recomendado también) Preview

Luego: **Redeploy** (para que apliquen).

### 11.4 Probar en producción
- Tu dominio Vercel `/` envía lead OK
- `/admin/login` login OK
- `/admin` lista OK

---

## 12. Commits de Git recomendados
Orden recomendado (si lo haces desde cero):

1) `chore: init astro project`
2) `chore: add tailwind v4`
3) `chore: configure vercel adapter + server output`
4) `feat: landing contact form without scripts`
5) `feat: lead API route (supabase insert)`
6) `feat: admin login + cookie session`
7) `feat: admin dashboard list + filters + KPIs`
8) `feat: contacted toggle and notes`
9) `fix: robust logout endpoint`

---

## 13. Checklist final
- [ ] `.env` local creado y **NO** subido
- [ ] Env vars en Vercel
- [ ] Tablas creadas en Supabase
- [ ] RLS activado y policies aplicadas
- [ ] Usuario admin creado en Auth
- [ ] Perfil admin creado en `profiles`
- [ ] Landing inserta leads
- [ ] Admin lista leads
- [ ] Contactado y notas funcionan
- [ ] Logout funciona

---

## 14. Notas de seguridad (importante)
- `SUPABASE_SERVICE_ROLE_KEY` **solo servidor** (API routes).
- Dashboard usa `SUPABASE_ANON_KEY` + RLS.
- El token va en cookie `HttpOnly`.
- La sesión (access token) suele durar ~1h (depende de settings de Supabase). En este proyecto **no** hay refresh automático.

---

## Bonus: comandos útiles
- Ver build local:
```bash
npm run build
npm run preview
```
- Ver logs en Vercel:
  - Project → Deployments → Deployment → **Runtime Logs**
  - Filtra por `/api/*`

---

¡Listo! Esta guía es copiable tal cual para cada cliente (cambiando la marca, campos del lead y reglas de admin).
