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

// ---------------------------------------------------------------------------
// R09: rate limiting for the UNAUTHENTICATED public endpoints
// (/public/verify-pin, /public/register-request). Backed by public_action_logs
// (migration 20260724000000). Mirrors the /admin/invite invite_logs pattern:
// window-count + graceful-skip when the table isn't migrated yet.
// ---------------------------------------------------------------------------
const PUBLIC_ACTION_WINDOW_MINUTES = 10;
// verify-pin is IP-only (no email to key on), so keep the per-IP cap tight to
// throttle PIN brute-force while leaving headroom for genuine typos (B10).
const VERIFY_PIN_MAX_PER_IP = 10;
// register-request: email is the primary key (S6 anti-bombing → 1 invite/email
// per window); IP is the secondary guard against spraying many emails.
const REGISTER_MAX_PER_EMAIL = 1;
const REGISTER_MAX_PER_IP = 5;

// Resolve the client IP for rate-limit bucketing.
// Fallback chain: x-forwarded-for (first hop) → x-real-ip → 'unknown'.
// B10 CAVEAT: this depends on the Supabase Edge runtime actually forwarding the
// real client IP in x-forwarded-for. If it does not (value collapses to
// 'unknown'), the IP-based limit degrades into a SINGLE GLOBAL bucket shared by
// all callers — for verify-pin that could lock out legitimate users, and for
// register-request the email-based limit remains the real protection. This must
// be verified against production logs post-deploy (see PR notes / escalation).
const getClientIp = (c: any): string => {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = c.req.header('x-real-ip');
  if (xri && xri.trim()) return xri.trim();
  return 'unknown';
};

// Detect the "public_action_logs not migrated yet" error so rate limiting can be
// skipped gracefully instead of breaking the public endpoints (deploy ordering).
const isMissingPublicActionLogs = (msg: string | undefined): boolean => {
  const m = (msg || '').toLowerCase();
  return m.includes('public_action_logs') || m.includes('does not exist');
};

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

// Public endpoint: company list (no auth required) — PIN は返さない
app.get('/public/companies', async (c) => {
  const { data, error } = await adminClient
    .from('companies')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json(data || []);
});

// Public endpoint: PIN verification — PINだけで会社を特定し、allowedUnitIdsを返す
app.post('/public/verify-pin', async (c) => {
  const body = await c.req.json();
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

  if (!pin) return c.json({ error: 'PINを入力してください' }, 400);

  // --- R09 rate limit (DESIGN.md S3): throttle PIN brute-force by client IP. ---
  const ip = getClientIp(c);
  const sinceIso = new Date(Date.now() - PUBLIC_ACTION_WINDOW_MINUTES * 60_000).toISOString();

  let skipRateLimit = false;
  const countRes = await adminClient
    .from('public_action_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'verify_pin')
    .eq('ip', ip)
    .gte('created_at', sinceIso);

  if (countRes.error) {
    // Table not migrated yet → don't break login (graceful degradation).
    if (isMissingPublicActionLogs(countRes.error.message)) {
      skipRateLimit = true;
    }
  }

  if (!skipRateLimit && (countRes.count ?? 0) >= VERIFY_PIN_MAX_PER_IP) {
    await adminClient.from('public_action_logs').insert({
      action: 'verify_pin',
      ip,
      status: 'blocked_rate_limit',
      meta: { windowMinutes: PUBLIC_ACTION_WINDOW_MINUTES, maxPerIpPerWindow: VERIFY_PIN_MAX_PER_IP },
    });
    return c.json({ error: 'PIN試行が多すぎます。しばらく待って再試行してください' }, 429);
  }

  // PIN lookup is unchanged: the partial UNIQUE index (R09 migration) guarantees
  // this .maybeSingle() can never receive more than one row.
  const { data: company, error } = await adminClient
    .from('companies')
    .select('id, name, allowed_unit_ids')
    .eq('pin', pin)
    .maybeSingle();

  const matched = !error && !!company;

  // Log the attempt (any status counts toward the window, so failed guesses are
  // what drive the brute-force throttle). Skipped only when the table is absent.
  if (!skipRateLimit) {
    await adminClient.from('public_action_logs').insert({
      action: 'verify_pin',
      ip,
      status: matched ? 'ok' : 'failed',
      meta: {},
    });
  }

  if (error || !company) return c.json({ error: 'PINが正しくありません' }, 401);

  return c.json({
    id: company.id,
    name: company.name,
    allowedUnitIds: company.allowed_unit_ids || [],
  });
});

// Public endpoint: units & categories for student pages (bypasses RLS via service role)
app.get('/public/quiz-data', async (c) => {
  const [unitRes, categoryRes] = await Promise.all([
    adminClient.from('units').select('id, name, description').order('created_at', { ascending: true }),
    adminClient.from('categories').select('id, name, description, unitId:unit_id').order('created_at', { ascending: true }),
  ]);
  if (unitRes.error || categoryRes.error) {
    return c.json({ error: 'データの取得に失敗しました' }, 500);
  }
  return c.json({ units: unitRes.data || [], categories: categoryRes.data || [] });
});

// Public endpoint: categories + question counts for a unit (student category list page)
app.get('/public/unit-categories/:unitId', async (c) => {
  const unitId = c.req.param('unitId');
  const [unitRes, categoryRes] = await Promise.all([
    adminClient.from('units').select('id, name, description').eq('id', unitId).maybeSingle(),
    adminClient.from('categories').select('id, name, description, unitId:unit_id').eq('unit_id', unitId).order('created_at', { ascending: true }),
  ]);
  if (unitRes.error) return c.json({ error: unitRes.error.message }, 500);
  if (!unitRes.data) return c.json({ error: '単元が見つかりません' }, 404);

  const categoryIds = (categoryRes.data || []).map((cat: { id: string }) => cat.id);
  const questionRes = categoryIds.length > 0
    ? await adminClient.from('questions')
        .select('id, categoryId:category_id')
        .in('category_id', categoryIds)
        .eq('is_active', true)
    : { data: [], error: null };

  return c.json({
    unit: unitRes.data,
    categories: categoryRes.data || [],
    questions: questionRes.data || [],
  });
});

// Public endpoint: fetch questions for student quiz (bypasses RLS, no is_assignment filter)
// Body: { categoryId? } | { categoryIds? } | { unitId? }
app.post('/public/questions', async (c) => {
  const body = await c.req.json();
  const categoryId: string | undefined = body?.categoryId;
  const categoryIds: string[] | undefined = body?.categoryIds;
  const unitId: string | undefined = body?.unitId;

  let targetCategoryIds: string[] = [];

  if (categoryId) {
    targetCategoryIds = [categoryId];
  } else if (Array.isArray(categoryIds) && categoryIds.length > 0) {
    targetCategoryIds = categoryIds;
  } else if (unitId) {
    const { data: cats } = await adminClient
      .from('categories')
      .select('id')
      .eq('unit_id', unitId);
    targetCategoryIds = (cats || []).map((c: { id: string }) => c.id);
  }

  if (targetCategoryIds.length === 0) {
    return c.json([]);
  }

  const { data, error } = await adminClient
    .from('questions')
    .select('id, text, optionA:option_a, optionB:option_b, optionC:option_c, optionD:option_d, correctAnswer:correct_answer, answerMethod:answer_method, explanation, categoryId:category_id, isActive:is_active, isAssignment:is_assignment')
    .in('category_id', targetCategoryIds)
    .eq('is_active', true);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data || []);
});

// Public endpoint: self-registration — invite is sent immediately, no approval required
app.post('/public/register-request', async (c) => {
  const body = await c.req.json();
  const emailRaw = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
  const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
  const companyId = normalizeCompanyId(body?.companyId);

  if (!emailRaw) return c.json({ error: 'メールアドレスは必須です' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) return c.json({ error: 'メールアドレスの形式が不正です' }, 400);
  if (!lastName) return c.json({ error: '姓は必須です' }, 400);
  if (!firstName) return c.json({ error: '名は必須です' }, 400);
  if (lastName.length > 50) return c.json({ error: '姓は50文字以内で入力してください' }, 400);
  if (firstName.length > 50) return c.json({ error: '名は50文字以内で入力してください' }, 400);
  if (!companyId) return c.json({ error: '会社を選択してください' }, 400);

  // Fetch company and its allowed units
  const { data: company, error: companyError } = await adminClient
    .from('companies')
    .select('id, allowed_unit_ids')
    .eq('id', companyId)
    .maybeSingle();
  if (companyError || !company) return c.json({ error: '指定された会社が見つかりません' }, 400);

  const allowedUnitIds: string[] = company.allowed_unit_ids || [];
  const username = `${lastName} ${firstName}`;

  // --- R09 rate limit (DESIGN.md S6): throttle self-registration by email AND IP. ---
  // Runs AFTER input/company validation (so bad input still returns 400 without
  // consuming a slot) but BEFORE listUsers + inviteUserByEmail, so an invite email
  // is never sent for a rate-limited request (anti-bombing / provider-quota guard).
  const ip = getClientIp(c);
  const sinceIso = new Date(Date.now() - PUBLIC_ACTION_WINDOW_MINUTES * 60_000).toISOString();

  let skipRateLimit = false;
  const emailCountRes = await adminClient
    .from('public_action_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'register_request')
    .eq('email', emailRaw)
    .gte('created_at', sinceIso);
  const ipCountRes = await adminClient
    .from('public_action_logs')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'register_request')
    .eq('ip', ip)
    .gte('created_at', sinceIso);

  if (emailCountRes.error || ipCountRes.error) {
    // Table not migrated yet → don't break registration (graceful degradation).
    const msg = `${emailCountRes.error?.message || ''} ${ipCountRes.error?.message || ''}`;
    if (isMissingPublicActionLogs(msg)) skipRateLimit = true;
  }

  if (
    !skipRateLimit &&
    ((emailCountRes.count ?? 0) >= REGISTER_MAX_PER_EMAIL || (ipCountRes.count ?? 0) >= REGISTER_MAX_PER_IP)
  ) {
    await adminClient.from('public_action_logs').insert({
      action: 'register_request',
      ip,
      email: emailRaw,
      status: 'blocked_rate_limit',
      meta: {
        windowMinutes: PUBLIC_ACTION_WINDOW_MINUTES,
        maxPerEmailPerWindow: REGISTER_MAX_PER_EMAIL,
        maxPerIpPerWindow: REGISTER_MAX_PER_IP,
      },
    });
    return c.json({ error: '登録申請が多すぎます。しばらく待って再試行してください' }, 429);
  }

  // Record the attempt before doing any expensive/side-effecting work. With
  // maxPerEmailPerWindow=1 this row is what blocks a repeat within the window,
  // so a duplicate submit can never trigger a second invite email (S6).
  if (!skipRateLimit) {
    await adminClient.from('public_action_logs').insert({
      action: 'register_request',
      ip,
      email: emailRaw,
      status: 'attempt',
      meta: {},
    });
  }

  // Check for existing active account — stale (soft-deleted) users are cleaned up and re-invited.
  // Moved AFTER the rate-limit gate: listUsers({perPage:1000}) is expensive, so it must not run
  // for throttled requests (S6). The dedup logic itself is unchanged.
  const existingUsersRes = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!existingUsersRes.error) {
    const existingUser = (existingUsersRes.data.users || []).find(
      (u) => (u.email || '').trim().toLowerCase() === emailRaw
    );
    if (existingUser) {
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('is_active')
        .eq('id', existingUser.id)
        .maybeSingle();
      if (existingProfile?.is_active !== false) {
        return c.json({ error: 'このメールアドレスは既に登録されています' }, 409);
      }
      // Soft-deleted user — remove stale auth record so the invite can be re-sent
      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(existingUser.id);
      if (cleanupError) {
        const msg = cleanupError.message.toLowerCase();
        if (!msg.includes('not found') && !msg.includes('does not exist')) {
          return c.json({ error: cleanupError.message }, 500);
        }
      }
    }
  }

  // Send invite email immediately
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    emailRaw,
    inviteRedirectUrl ? { redirectTo: inviteRedirectUrl } : undefined
  );
  if (inviteError) return c.json({ error: inviteError.message }, 400);

  const userId = inviteData.user?.id;
  if (userId) {
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        email: emailRaw,
        role: 'user',
        username,
        allowed_unit_ids: allowedUnitIds,
        company_id: companyId,
        is_active: true,
      });
    if (profileError) return c.json({ error: profileError.message }, 500);
  }

  return c.json({ success: true });
});

app.get('/admin/companies', requireAdmin, async (c) => {
  const { data, error } = await adminClient
    .from('companies')
    .select('id, name, description, allowedUnitIds:allowed_unit_ids, pin, createdAt:created_at, updatedAt:updated_at')
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

app.patch('/admin/companies/:id', requireAdmin, async (c) => {
  const companyId = c.req.param('id');
  if (!isUuid(companyId)) return c.json({ error: 'Invalid company id' }, 400);

  const body = await c.req.json();
  const allowedUnitIds = normalizeAllowedUnitIds(body?.allowedUnitIds);

  if (body?.allowedUnitIds !== undefined && allowedUnitIds === null) {
    return c.json({ error: 'Invalid allowedUnitIds' }, 400);
  }

  // PIN: null → クリア, 文字列 → セット, undefined → 変更なし
  const pinRaw = body?.pin;
  const pin: string | null | undefined =
    pinRaw === null ? null :
    typeof pinRaw === 'string' ? pinRaw.trim() :
    undefined;
  if (pin !== undefined && typeof pin === 'string' && pin.length > 20) {
    return c.json({ error: 'PIN は20文字以内で入力してください' }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (allowedUnitIds !== null) updates.allowed_unit_ids = allowedUnitIds;
  if (pin !== undefined) updates.pin = pin || null;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  const { error } = await adminClient
    .from('companies')
    .update(updates)
    .eq('id', companyId);

  if (error) return c.json({ error: error.message }, 500);

  return c.json({ success: true });
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

  // Cleanup stale auth users for re-invite flows.
  // This happens when the same email was previously invited and later deleted in app-side operations.
  // Keep active users untouched to avoid accidental account takeover.
  const existingUsersRes = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (existingUsersRes.error) {
    return c.json({ error: existingUsersRes.error.message }, 500);
  }
  const existingUser = (existingUsersRes.data.users || []).find(
    (u) => (u.email || '').trim().toLowerCase() === email
  );
  if (existingUser) {
    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from('profiles')
      .select('is_active')
      .eq('id', existingUser.id)
      .maybeSingle();

    if (existingProfileError) {
      return c.json({ error: existingProfileError.message }, 500);
    }

    const hasActiveProfile = existingProfile?.is_active !== false;
    if (hasActiveProfile) {
      return c.json({ error: 'このメールアドレスは既に利用されています' }, 409);
    }

    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(existingUser.id);
    if (cleanupError) {
      const msg = cleanupError.message.toLowerCase();
      const notFound = msg.includes('not found') || msg.includes('does not exist');
      if (!notFound) {
        return c.json({ error: cleanupError.message }, 500);
      }
    }
  }

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

    // Revoke existing sessions by banning the user (B8 ruling): the deactivate
    // endpoint only has the target userId, not their JWT, so admin.signOut(jwt)
    // cannot be used. A ban makes GoTrue reject the user's access/refresh tokens.
    // NOTE (reactivate hand-off): a future "reactivate" flow must lift this ban
    // via admin.updateUserById(userId, { ban_duration: 'none' }). No reactivate
    // flow exists today, and re-invite paths call admin.deleteUser first (which
    // clears the ban), so this ban is safe.
    const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: '876000h', // effectively permanent (~100 years)
    });
    if (banError) {
      // is_active=false already committed above; RLS blocks data access immediately,
      // so a failed session revoke is non-fatal. Log and continue.
      console.error('deactivate: failed to revoke sessions', banError.message);
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

app.get('/admin/registration-requests', requireAdmin, async (c) => {
  const status = c.req.query('status') || 'pending';
  const validStatuses = ['pending', 'approved', 'rejected', 'all'];
  if (!validStatuses.includes(status)) return c.json({ error: 'Invalid status' }, 400);

  let query = adminClient
    .from('registration_requests')
    .select('id, email, last_name, first_name, company_id, status, notes, invited_user_id, reviewed_by, created_at, reviewed_at, companies(name)')
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json(
    (data || []).map((r: any) => ({
      id: r.id,
      email: r.email,
      lastName: r.last_name,
      firstName: r.first_name,
      companyId: r.company_id,
      companyName: r.companies?.name,
      status: r.status,
      notes: r.notes,
      invitedUserId: r.invited_user_id,
      reviewedBy: r.reviewed_by,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    }))
  );
});

app.post('/admin/registration-requests/:id/approve', requireAdmin, async (c) => {
  const authUser = c.get('authUser') as { id: string } | undefined;
  const requestId = c.req.param('id');

  if (!isUuid(requestId)) return c.json({ error: 'Invalid request id' }, 400);

  const { data: request, error: requestError } = await adminClient
    .from('registration_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError || !request) return c.json({ error: '申請が見つかりません' }, 404);
  if (request.status !== 'pending') return c.json({ error: 'この申請はすでに処理済みです' }, 409);

  const { data: company, error: companyError } = await adminClient
    .from('companies')
    .select('id, allowed_unit_ids')
    .eq('id', request.company_id)
    .maybeSingle();

  if (companyError || !company) return c.json({ error: '会社情報が見つかりません' }, 400);

  const allowedUnitIds: string[] = company.allowed_unit_ids || [];
  const email = request.email as string;
  const username = `${request.last_name} ${request.first_name}`;

  // Cleanup stale auth users for re-invite
  const existingUsersRes = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!existingUsersRes.error) {
    const existingUser = (existingUsersRes.data.users || []).find(
      (u: any) => (u.email || '').trim().toLowerCase() === email
    );
    if (existingUser) {
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('is_active')
        .eq('id', existingUser.id)
        .maybeSingle();

      if (existingProfile?.is_active !== false) {
        return c.json({ error: 'このメールアドレスは既に利用されています' }, 409);
      }

      const { error: cleanupError } = await adminClient.auth.admin.deleteUser(existingUser.id);
      if (cleanupError) {
        const msg = cleanupError.message.toLowerCase();
        if (!msg.includes('not found') && !msg.includes('does not exist')) {
          return c.json({ error: cleanupError.message }, 500);
        }
      }
    }
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    inviteRedirectUrl ? { redirectTo: inviteRedirectUrl } : undefined
  );

  if (inviteError) return c.json({ error: inviteError.message }, 400);

  const userId = inviteData.user?.id;
  if (userId) {
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        email,
        role: 'user',
        username,
        allowed_unit_ids: allowedUnitIds,
        company_id: request.company_id,
        is_active: true,
      });

    if (profileError) return c.json({ error: profileError.message }, 500);
  }

  const { error: updateError } = await adminClient
    .from('registration_requests')
    .update({
      status: 'approved',
      reviewed_by: authUser?.id ?? null,
      reviewed_at: new Date().toISOString(),
      invited_user_id: userId ?? null,
    })
    .eq('id', requestId);

  if (updateError) return c.json({ error: updateError.message }, 500);

  return c.json({ success: true });
});

app.post('/admin/registration-requests/:id/reject', requireAdmin, async (c) => {
  const authUser = c.get('authUser') as { id: string } | undefined;
  const requestId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';

  if (!isUuid(requestId)) return c.json({ error: 'Invalid request id' }, 400);

  const { data: request, error: requestError } = await adminClient
    .from('registration_requests')
    .select('status')
    .eq('id', requestId)
    .maybeSingle();

  if (requestError || !request) return c.json({ error: '申請が見つかりません' }, 404);
  if (request.status !== 'pending') return c.json({ error: 'この申請はすでに処理済みです' }, 409);

  const { error: updateError } = await adminClient
    .from('registration_requests')
    .update({
      status: 'rejected',
      notes,
      reviewed_by: authUser?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) return c.json({ error: updateError.message }, 500);

  return c.json({ success: true });
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
