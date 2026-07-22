-- X03: xlsx インポート用 RPC `import_questions(jsonb)`。
-- 単元/カテゴリ名の解決・自動作成、ID有り=UPDATE / ID無し=INSERT を
-- 単一トランザクションで実行し、いずれか1行でも失敗すれば全件ロールバックする。
--
-- 非破壊マイグレーション: 関数の create or replace と権限付与のみ。
-- alter table / データ update / drop は一切含まない(既存テーブル定義・既存レコードに非破壊)。
--
-- 認可: SECURITY DEFINER は RLS をバイパスするため、関数冒頭の public.is_admin()
-- ガードが認可の唯一の砦。set search_path = public でスキーマ差し替えを防止する。
--
-- 入力仕様(X01/X04 と厳密一致・値は X01 のパース+バリデーションで正規化済み前提):
--   row_number(任意) id(任意) unit_name category_name text
--   option_a..option_d correct_answer answer_method explanation(任意) is_active
-- correct_answer は無加工で INSERT/UPDATE する(昇順正規化は X01 に集約=REVIEW_NOTES A5)。
-- 形式の二重検証は行わない。DB CHECK 制約が最終安全網(REVIEW_NOTES A6)。

create or replace function public.import_questions(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_elem            jsonb;
  v_ord             bigint;
  v_row_number      int;
  v_id              text;
  v_unit_name       text;
  v_category_name   text;
  v_unit_id         uuid;
  v_category_id     uuid;
  v_text            text;
  v_option_a        text;
  v_option_b        text;
  v_option_c        text;
  v_option_d        text;
  v_correct_answer  text;
  v_answer_method   text;
  v_explanation     text;
  v_is_active       boolean;
  v_affected        int;
  v_inserted           int := 0;
  v_updated            int := 0;
  v_created_units      int := 0;
  v_created_categories int := 0;
begin
  -- 認可: 呼び出し元が admin でなければ拒否(SECURITY DEFINER 配下でも
  -- is_admin() は auth.uid() を参照するため呼び出し元ユーザーで判定される)。
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;

  -- 空チェック(null / 非配列 / 空配列は取り込み対象なしとしてエラー)。
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'no rows';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    raise exception 'no rows';
  end if;

  for v_elem, v_ord in
    select value, ordinality
    from jsonb_array_elements(p_rows) with ordinality
  loop
    v_row_number     := coalesce((v_elem->>'row_number')::int, v_ord::int);
    v_id             := nullif(trim(coalesce(v_elem->>'id', '')), '');
    v_unit_name      := v_elem->>'unit_name';
    v_category_name  := v_elem->>'category_name';
    v_text           := v_elem->>'text';
    v_option_a       := v_elem->>'option_a';
    v_option_b       := v_elem->>'option_b';
    v_option_c       := v_elem->>'option_c';
    v_option_d       := v_elem->>'option_d';
    v_correct_answer := v_elem->>'correct_answer';
    v_answer_method  := v_elem->>'answer_method';
    v_explanation    := coalesce(v_elem->>'explanation', '');
    v_is_active      := (v_elem->>'is_active')::boolean;

    -- (a) 単元解決 / 自動作成。UNIQUE 制約が無いため最古を採用(first-wins)。
    -- 同一トランザクション内で先行行が作成した単元は後続行の select で可視。
    select id into v_unit_id
    from public.units
    where name = v_unit_name
    order by created_at asc
    limit 1;

    if v_unit_id is null then
      insert into public.units (name, description)
      values (v_unit_name, 'xlsxインポートで自動作成')
      returning id into v_unit_id;
      v_created_units := v_created_units + 1;
    end if;

    -- (b) カテゴリ解決 / 自動作成((unit_id, name) で検索)。
    select id into v_category_id
    from public.categories
    where unit_id = v_unit_id and name = v_category_name
    order by created_at asc
    limit 1;

    if v_category_id is null then
      insert into public.categories (unit_id, name, description)
      values (v_unit_id, v_category_name, 'xlsxインポートで自動作成')
      returning id into v_category_id;
      v_created_categories := v_created_categories + 1;
    end if;

    -- (c) ID有り=UPDATE / ID無し=INSERT。
    if v_id is not null then
      -- 上書き。is_assignment / created_at には触れない(既存値維持=REVIEW_NOTES A10)。
      -- updated_at は questions_set_updated_at トリガで更新。楽観ロックは付けない(A12)。
      update public.questions set
        text           = v_text,
        option_a       = v_option_a,
        option_b       = v_option_b,
        option_c       = v_option_c,
        option_d       = v_option_d,
        correct_answer = v_correct_answer,
        answer_method  = v_answer_method,
        explanation    = v_explanation,
        category_id    = v_category_id,
        is_active      = v_is_active
      where id = v_id::uuid;

      get diagnostics v_affected = row_count;
      if v_affected = 0 then
        -- ID有り + DB 不存在 → 例外 → プロシージャ全体が失敗し全件ロールバック。
        raise exception '行 % : 指定IDの問題が見つかりません (%)', v_row_number, v_id;
      end if;
      v_updated := v_updated + 1;
    else
      -- 新規。is_assignment は false 固定(REVIEW_NOTES A10)。
      insert into public.questions
        (category_id, text, option_a, option_b, option_c, option_d,
         correct_answer, answer_method, explanation, is_active, is_assignment)
      values
        (v_category_id, v_text, v_option_a, v_option_b, v_option_c, v_option_d,
         v_correct_answer, v_answer_method, v_explanation, v_is_active, false);
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'created_units', v_created_units,
    'created_categories', v_created_categories
  );
end;
$$;

-- 権限: デフォルトの public 実行権を剥奪し authenticated のみに付与(多層防御)。
-- admin 判定は関数内で実施済みだが anon から呼べないようにする。
revoke all on function public.import_questions(jsonb) from public;
revoke all on function public.import_questions(jsonb) from anon;
grant execute on function public.import_questions(jsonb) to authenticated;
