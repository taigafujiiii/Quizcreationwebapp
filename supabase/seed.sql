insert into public.units (id, name, description)
values
  ('11111111-1111-1111-1111-111111111111', 'プログラミング基礎', 'プログラミングの基本的な概念と原則'),
  ('22222222-2222-2222-2222-222222222222', 'Web開発', 'HTML、CSS、JavaScriptを使用したWeb開発'),
  ('33333333-3333-3333-3333-333333333333', 'データベース', 'データベースの設計と操作')
on conflict (id) do nothing;

insert into public.categories (id, unit_id, name, description)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', '変数とデータ型', '変数の宣言とデータ型について'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '11111111-1111-1111-1111-111111111111', '制御構文', '条件分岐とループ処理'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '22222222-2222-2222-2222-222222222222', 'HTML基礎', 'HTMLの基本構造とタグ'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '22222222-2222-2222-2222-222222222222', 'CSS基礎', 'CSSのセレクタとプロパティ'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', '33333333-3333-3333-3333-333333333333', 'SQL基礎', 'SQLの基本クエリ')
on conflict (id) do nothing;

insert into public.questions (
  id,
  category_id,
  text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  is_active,
  is_assignment
) values
  (
    '44444444-4444-4444-4444-444444444441',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'JavaScriptで変数を宣言する際、再代入可能な変数を定義するキーワードはどれですか？',
    'const',
    'let',
    'var',
    'define',
    'B',
    'letは再代入可能な変数を定義するキーワードです。constは再代入不可、varは古い書き方です。',
    true,
    true
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'JavaScriptのデータ型として正しくないものはどれですか？',
    'String',
    'Number',
    'Integer',
    'Boolean',
    'C',
    'JavaScriptにはIntegerという型はありません。数値はすべてNumber型です。',
    true,
    true
  ),
  (
    '44444444-4444-4444-4444-444444444443',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'if文の条件式として適切でないものはどれですか？',
    'if (true)',
    'if (x > 0)',
    'if x > 0',
    'if (x === 0)',
    'C',
    'if文の条件式は必ず括弧()で囲む必要があります。',
    true,
    false
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    'HTMLで段落を表すタグはどれですか？',
    '<paragraph>',
    '<p>',
    '<para>',
    '<text>',
    'B',
    '<p>タグが段落を表すHTMLの標準タグです。',
    true,
    true
  ),
  (
    '44444444-4444-4444-4444-444444444445',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    'CSSで要素の背景色を設定するプロパティはどれですか？',
    'color',
    'bg-color',
    'background-color',
    'background',
    'C',
    'background-colorが背景色を指定する正式なプロパティです。backgroundでも可能ですが、より包括的なプロパティです。',
    true,
    false
  ),
  (
    '44444444-4444-4444-4444-444444444446',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    'SQLでデータを取得する際に使用するコマンドはどれですか？',
    'GET',
    'SELECT',
    'FETCH',
    'RETRIEVE',
    'B',
    'SELECTがデータを取得するための標準SQLコマンドです。',
    true,
    true
  ),
  (
    '44444444-4444-4444-4444-444444444447',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'JavaScriptで配列の要素数を取得するプロパティはどれですか？',
    'size',
    'count',
    'length',
    'total',
    'C',
    'lengthプロパティが配列やstrのようなオブジェクトの要素数を返します。',
    true,
    false
  ),
  (
    '44444444-4444-4444-4444-444444444448',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'for文の基本構文として正しいものはどれですか？',
    'for i in range(10)',
    'for (let i = 0; i < 10; i++)',
    'for i = 0 to 10',
    'foreach (i in 10)',
    'B',
    'JavaScriptのfor文は「for (初期化; 条件; 増減)」の形式です。',
    true,
    true
  )
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from auth.users where email = 'education@maisonmarc.com') then
    update public.profiles
    set role = 'admin',
        allowed_unit_ids = '{}'::uuid[],
        is_active = true
    where id = (select id from auth.users where email = 'education@maisonmarc.com');
  else
    raise notice 'Admin seed skipped: auth.users not found for education@maisonmarc.com';
  end if;
end $$;
