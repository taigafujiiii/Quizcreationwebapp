import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

app.use('*', logger(console.log));

const parseCorsOrigins = (raw: string) =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const corsOrigins = parseCorsOrigins(Deno.env.get("CORS_ORIGINS") || "");
const corsOrigin = corsOrigins.length ? corsOrigins : "*";

app.use(
  "/*",
  cors({
    origin: corsOrigin,
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const inviteRedirectUrlRaw = Deno.env.get("INVITE_REDIRECT_URL") || "";

const normalizeInviteRedirectUrl = (raw: string) => {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    // Ensure invites land on the registration screen, not the app root.
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/accept-invite";
    }
    return url.toString();
  } catch {
    return raw;
  }
};

const inviteRedirectUrl = normalizeInviteRedirectUrl(inviteRedirectUrlRaw);

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const normalizeRole = (v: unknown): "user" | "admin" | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return null;
  const role = v.trim().toLowerCase();
  if (role === "user" || role === "admin") return role;
  return null;
};

const normalizeUsername = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return null;
  const name = v.trim();
  if (!name) return "";
  if (name.length > 50) return null;
  return name;
};

const normalizeAllowedUnitIds = (v: unknown): string[] | null => {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) return null;
  const uniq: string[] = [];
  for (const raw of v) {
    if (!isUuid(raw)) return null;
    if (!uniq.includes(raw)) uniq.push(raw);
  }
  // Guardrail against accidental huge payloads.
  if (uniq.length > 500) return null;
  return uniq;
};

const normalizeCompanyId = (v: unknown): string | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return null;
  const id = v.trim();
  if (!id) return "";
  return isUuid(id) ? id : null;
};

const requireAdmin = async (c: any, next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData.user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  c.set('authUser', userData.user);
  return next();
};

app.get("/make-server-3dca59de/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.get('/admin/companies', requireAdmin, async (c) => {
  const { data, error } = await adminClient
    .from('companies')
    .select('id, name, description, createdAt:created_at, updatedAt:updated_at')
    .order('name', { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data || []);
});

app.post('/admin/companies', requireAdmin, async (c) => {
  const body = await c.req.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';

  if (!name) return c.json({ error: 'Company name is required' }, 400);
  if (name.length > 100) return c.json({ error: 'Company name is too long' }, 400);

  const { data, error } = await adminClient
    .from('companies')
    .insert({ name, description })
    .select('id, name, description, createdAt:created_at, updatedAt:updated_at')
    .single();

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json(data);
});

app.delete('/admin/companies/:id', requireAdmin, async (c) => {
  const companyId = c.req.param('id');
  if (!isUuid(companyId)) return c.json({ error: 'Invalid company id' }, 400);

  const { count, error: countError } = await adminClient
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (countError) {
    return c.json({ error: countError.message }, 500);
  }
  if ((count || 0) > 0) {
    return c.json({ error: '会社に所属ユーザーがいるため削除できません' }, 409);
  }

  const { error } = await adminClient
    .from('companies')
    .delete()
    .eq('id', companyId);
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ success: true });
});

app.get('/admin/users', requireAdmin, async (c) => {
  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  const users = data.users || [];
  const userIds = users.map((u) => u.id);

  const { data: profiles, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, username, allowed_unit_ids, is_active, updated_at, company_id')
    .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

  if (profileError) {
    return c.json({ error: profileError.message }, 500);
  }

  const companyIds = Array.from(
    new Set((profiles || []).map((p: any) => p.company_id).filter(Boolean))
  );
  let companyMap = new Map<string, { id: string; name: string }>();
  if (companyIds.length > 0) {
    const { data: companies, error: companyError } = await adminClient
      .from('companies')
      .select('id, name')
      .in('id', companyIds);
    if (companyError) {
      return c.json({ error: companyError.message }, 500);
    }
    companyMap = new Map((companies || []).map((co: any) => [co.id, co]));
  }

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  const result = users.map((u) => {
    const profile = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email || '',
      role: profile?.role || 'user',
      verified: Boolean(u.email_confirmed_at),
      isActive: profile?.is_active ?? true,
      createdAt: u.created_at,
      updatedAt: profile?.updated_at ?? undefined,
      username: profile?.username || undefined,
      allowedUnitIds: profile?.allowed_unit_ids || [],
      companyId: profile?.company_id || undefined,
      companyName: profile?.company_id ? companyMap.get(profile.company_id)?.name : undefined,
    };
  });

  return c.json(result);
});

app.post('/admin/invite', requireAdmin, async (c) => {
  const authUser = c.get('authUser') as { id: string } | undefined;
  const body = await c.req.json();
  const emailRaw = body?.email as string | undefined;
  const role = normalizeRole(body?.role) ?? 'user';
  const allowedUnitIds = normalizeAllowedUnitIds(body?.allowedUnitIds) ?? [];
  const companyId = normalizeCompanyId(body?.companyId);

  if (!authUser?.id) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!emailRaw) {
    return c.json({ error: 'Email is required' }, 400);
  }
  if (body?.companyId !== undefined && companyId === null) {
    return c.json({ error: 'Invalid companyId' }, 400);
  }
  if (role === 'user' && !companyId) {
    return c.json({ error: '受講生招待には会社選択が必須です' }, 400);
  }
  if (companyId) {
    const { data: companyExists, error: companyError } = await adminClient
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle();
    if (companyError || !companyExists) {
      return c.json({ error: '指定された会社が見つかりません' }, 400);
    }
  }

  const email = emailRaw.trim().toLowerCase();

  // App-side rate limit (prevents hitting Supabase email rate limits).
  const windowMinutes = 10;
  const maxPerInviterPerWindow = 30;
  const maxPerInviteeEmailPerWindow = 1;

  const sinceIso = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  let skipRateLimit = false;
  let inviterCount = 0;
  let inviteeCount = 0;

  const inviterRes = await adminClient
    .from('invite_logs')
    .select('id', { count: 'exact', head: true })
    .eq('inviter_id', authUser.id)
    .gte('created_at', sinceIso);
  const inviteeRes = await adminClient
    .from('invite_logs')
    .select('id', { count: 'exact', head: true })
    .eq('invitee_email', email)
    .gte('created_at', sinceIso);

  // If the table isn't created yet, don't break invite flow.
  if (inviterRes.error || inviteeRes.error) {
    const msg = `${inviterRes.error?.message || ''} ${inviteeRes.error?.message || ''}`.toLowerCase();
    if (msg.includes('invite_logs') || msg.includes('does not exist')) {
      skipRateLimit = true;
    }
  } else {
    inviterCount = inviterRes.count ?? 0;
    inviteeCount = inviteeRes.count ?? 0;
  }

  if (!skipRateLimit && (inviterCount >= maxPerInviterPerWindow || inviteeCount >= maxPerInviteeEmailPerWindow)) {
    await adminClient.from('invite_logs').insert({
      inviter_id: authUser.id,
      invitee_email: email,
      invitee_role: role,
      status: 'blocked_rate_limit',
      meta: { windowMinutes, maxPerInviterPerWindow, maxPerInviteeEmailPerWindow },
    });
    return c.json(
      { error: 'Rate limited. Please wait and try again.' },
      429
    );
  }

  let attemptLogId: string | undefined;
  if (!skipRateLimit) {
    const { data: attemptLog } = await adminClient
      .from('invite_logs')
      .insert({
        inviter_id: authUser.id,
        invitee_email: email,
        invitee_role: role,
        status: 'attempt',
        meta: { allowedUnitIdsCount: allowedUnitIds.length },
      })
      .select('id')
      .maybeSingle();

    attemptLogId = attemptLog?.id as string | undefined;
  }

  // Basic email format validation to avoid consuming provider quota on obviously bad input.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (attemptLogId) {
      await adminClient
        .from('invite_logs')
        .update({ status: 'rejected_invalid_email', error: 'invalid_email' })
        .eq('id', attemptLogId);
    }
    return c.json({ error: `Email address "${email}" is invalid` }, 400);
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    inviteRedirectUrl ? { redirectTo: inviteRedirectUrl } : undefined
  );
  if (error) {
    if (attemptLogId) {
      await adminClient
        .from('invite_logs')
        .update({ status: 'failed', error: error.message })
        .eq('id', attemptLogId);
    }
    return c.json({ error: error.message }, 400);
  }

  const userId = data.user?.id;
  if (userId) {
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        email,
        role,
        allowed_unit_ids: role === 'admin' ? [] : allowedUnitIds,
        company_id: role === 'admin' ? null : companyId,
        is_active: true,
      });

    if (profileError) {
      if (attemptLogId) {
        await adminClient
          .from('invite_logs')
          .update({ status: 'failed', error: profileError.message, invitee_user_id: userId })
          .eq('id', attemptLogId);
      }
      return c.json({ error: profileError.message }, 500);
    }
  }

  if (attemptLogId) {
    await adminClient
      .from('invite_logs')
      .update({ status: 'sent', invitee_user_id: userId ?? null })
      .eq('id', attemptLogId);
  }

  return c.json({ success: true });
});

app.patch('/admin/users/:id', requireAdmin, async (c) => {
  const authUser = c.get('authUser') as { id: string } | undefined;
  const userId = c.req.param('id');
  const body = await c.req.json();

  if (!isUuid(userId)) {
    return c.json({ error: 'Invalid user id' }, 400);
  }

  const role = normalizeRole(body?.role);
  const username = normalizeUsername(body?.username);
  const allowedUnitIds = normalizeAllowedUnitIds(body?.allowedUnitIds);
  const companyId = normalizeCompanyId(body?.companyId);
  const prevUpdatedAt = typeof body?.updatedAt === "string" ? body.updatedAt : null;

  if (body?.role !== undefined && role === null) {
    return c.json({ error: 'Invalid role' }, 400);
  }
  if (body?.username !== undefined && username === null) {
    return c.json({ error: 'Invalid username' }, 400);
  }
  if (body?.allowedUnitIds !== undefined && allowedUnitIds === null) {
    return c.json({ error: 'Invalid allowedUnitIds' }, 400);
  }
  if (body?.companyId !== undefined && companyId === null) {
    return c.json({ error: 'Invalid companyId' }, 400);
  }

  // Avoid accidental lock-out by self-demotion in the UI.
  if (authUser?.id && authUser.id === userId && role === 'user') {
    return c.json({ error: 'You cannot change your own role' }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (username !== null) updates.username = username;
  if (allowedUnitIds !== null) updates.allowed_unit_ids = allowedUnitIds;
  if (companyId !== null) updates.company_id = companyId || null;
  if (role !== null) updates.role = role;

  // If promoting to admin, clear allowed units to avoid confusion.
  if (role === 'admin') {
    updates.allowed_unit_ids = [];
    updates.company_id = null;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  let q = adminClient
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (prevUpdatedAt) {
    q = q.eq('updated_at', prevUpdatedAt);
  }

  const { data, error } = await q
    .select('updatedAt:updated_at')
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  if (prevUpdatedAt && !data) {
    return c.json({ error: 'Conflict: already updated by another user' }, 409);
  }

  return c.json({ success: true, updatedAt: (data as any)?.updatedAt ?? null });
});

app.post('/admin/users/:id/deactivate', requireAdmin, async (c) => {
  const authUser = c.get('authUser') as { id: string } | undefined;
  const userId = c.req.param('id');

  if (!authUser?.id) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Prevent admins from deleting themselves via the UI by mistake.
  if (authUser.id === userId) {
    return c.json({ error: 'You cannot delete yourself' }, 400);
  }

  // First delete = soft delete (is_active=false). Second delete = hard delete (remove from Auth).
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('is_active')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    return c.json({ error: profileError.message }, 500);
  }

  // If profile row doesn't exist (shouldn't happen), treat as already deleted and attempt hard delete.
  const isActive = profile?.is_active ?? false;

  if (isActive) {
    const { error } = await adminClient
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId);

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, action: 'deactivated' as const });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    // If the user already disappeared from Auth, treat it as a successful hard delete.
    const msg = deleteError.message.toLowerCase();
    const notFound = msg.includes('not found') || msg.includes('does not exist');
    if (!notFound) {
      return c.json({ error: deleteError.message }, 500);
    }
  }

  return c.json({ success: true, action: 'deleted' as const });
});

const normalizePath = (pathname: string) => {
  // Some environments forward the full original path (including /functions/v1/<fn>).
  // Normalize so routes can be defined as "/admin/..." consistently.
  const withoutFunctionsPrefix = pathname.replace(/^\/functions\/v1\/server\b/i, '');
  const withoutFnPrefix = withoutFunctionsPrefix.replace(/^\/server\b/i, '');
  return withoutFnPrefix.length > 0 ? withoutFnPrefix : '/';
};

Deno.serve((req) => {
  const url = new URL(req.url);
  url.pathname = normalizePath(url.pathname);
  const normalizedReq = new Request(url, req);
  return app.fetch(normalizedReq);
});
