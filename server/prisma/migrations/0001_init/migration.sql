CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE role AS ENUM ('ADMIN', 'USER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE auth_token_type AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE quiz_mode AS ENUM ('A', 'B', 'C');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE choice_label AS ENUM ('A', 'B', 'C', 'D');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE answer_label AS ENUM ('A', 'B', 'C', 'D', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role role NOT NULL,
  email_verified_at timestamp,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type auth_token_type NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_tokens_user_type_idx ON auth_tokens(user_id, type);

CREATE TABLE IF NOT EXISTS admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_invites_email_idx ON admin_invites(email);

CREATE TABLE IF NOT EXISTS units (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id serial PRIMARY KEY,
  unit_id int NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL,
  UNIQUE (unit_id, name)
);

CREATE TABLE IF NOT EXISTS questions (
  id serial PRIMARY KEY,
  category_id int NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  body text NOT NULL,
  explanation text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS choices (
  id serial PRIMARY KEY,
  question_id int NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label choice_label NOT NULL,
  body text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  UNIQUE (question_id, label)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode quiz_mode NOT NULL,
  unit_id int REFERENCES units(id) ON DELETE SET NULL,
  requested_count int NOT NULL,
  actual_count int NOT NULL,
  current_seq int NOT NULL,
  status attempt_status NOT NULL,
  selection_json jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  CHECK (requested_count IN (10, 20, 30, 40, 50)),
  CHECK (current_seq >= 1)
);

CREATE TABLE IF NOT EXISTS quiz_attempt_questions (
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  seq int NOT NULL,
  question_id int NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  PRIMARY KEY (attempt_id, seq),
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id int NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer answer_label NOT NULL,
  answered_at timestamp NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_tokens_unique_unused_idx
  ON auth_tokens(user_id, type)
  WHERE used_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_invites_unique_unused_idx
  ON admin_invites(email)
  WHERE used_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS choices_one_correct_idx
  ON choices(question_id)
  WHERE is_correct = true;
