-- ============================================================================
-- 咩時光 (MeiSchedule) — 獨立隔離 Supabase 資料庫遷移腳本
-- 目標專案：咩創意工作室獨立資料庫 (xtyuyuralrnwzsjvyslp / ap-northeast-1 / PG 17)
-- 隔離原則：
--   1. 所有資料表、索引、函式、觸發器與 RLS 政策嚴格採用 mei_schedule_* 前綴
--   2. 零修改、零干擾既有 public.mei_member_* 資料表與 auth.users 觸發器
--   3. 全數 7 張資料表皆強制啟用 ENABLE + FORCE ROW LEVEL SECURITY 並撤銷 anon 權限
--   4. 本檔案為本機交付之標準冪等 DDL，供管理員於 Supabase SQL Editor 手動審核套用
-- ============================================================================

BEGIN;

-- 1. 啟用必要擴充套件 (UUID 生成)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. 獨立前綴 updated_at 自動更新觸發函式 (使用 clock_timestamp() 確保語句內單調遞增)
CREATE OR REPLACE FUNCTION public.mei_schedule_handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.mei_schedule_handle_updated_at()
  IS '自動更新 mei_schedule_* 資料表 updated_at 欄位為當前伺服器時間戳';

-- ============================================================================
-- 3. 建立 7 張 mei_schedule_* 隔離資料表
-- ============================================================================

-- 3.1 行事曆與情境 / 多人共享日曆主表
CREATE TABLE IF NOT EXISTS public.mei_schedule_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color_token VARCHAR(32) NOT NULL DEFAULT 'sky',
  icon VARCHAR(48) NOT NULL DEFAULT 'calendar',
  calendar_set VARCHAR(32) NOT NULL DEFAULT 'personal'
    CHECK (calendar_set IN ('personal', 'work', 'study', 'shared')),
  is_shared BOOLEAN NOT NULL DEFAULT false,
  invite_code VARCHAR(12) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_mei_schedule_calendars_owner
  ON public.mei_schedule_calendars(owner_id);

CREATE INDEX IF NOT EXISTS idx_mei_schedule_calendars_invite
  ON public.mei_schedule_calendars(invite_code)
  WHERE invite_code IS NOT NULL;

-- 3.2 多人共享日曆成員與權限表 (多人協作)
CREATE TABLE IF NOT EXISTS public.mei_schedule_calendar_members (
  calendar_id UUID NOT NULL REFERENCES public.mei_schedule_calendars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL DEFAULT '成員',
  role VARCHAR(16) NOT NULL DEFAULT 'editor'
    CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (calendar_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mei_schedule_cal_members_user
  ON public.mei_schedule_calendar_members(user_id);

-- 3.3 排程事件與視覺時間塊主表
CREATE TABLE IF NOT EXISTS public.mei_schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES public.mei_schedule_calendars(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  location VARCHAR(200) NOT NULL DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color_token VARCHAR(32) NOT NULL DEFAULT 'sky',
  category_tag VARCHAR(48) NOT NULL DEFAULT '一般',
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  buffer_before_min SMALLINT NOT NULL DEFAULT 0 CHECK (buffer_before_min >= 0),
  buffer_after_min SMALLINT NOT NULL DEFAULT 0 CHECK (buffer_after_min >= 0),
  is_flexible BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'canceled')),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  recurrence_rule JSONB DEFAULT NULL,
  subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  reminder_minutes INTEGER[] NOT NULL DEFAULT ARRAY[15]::INTEGER[],
  external_uid TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_mei_schedule_events_time_order CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_mei_schedule_events_cal_start
  ON public.mei_schedule_events(calendar_id, start_at);

CREATE INDEX IF NOT EXISTS idx_mei_schedule_events_creator
  ON public.mei_schedule_events(creator_id);

CREATE INDEX IF NOT EXISTS idx_mei_schedule_events_ext_uid
  ON public.mei_schedule_events(calendar_id, external_uid)
  WHERE external_uid IS NOT NULL;

-- 3.4 待辦收件匣 (未排程 / 已連結至時間塊)
CREATE TABLE IF NOT EXISTS public.mei_schedule_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES public.mei_schedule_calendars(id) ON DELETE SET NULL,
  scheduled_event_id UUID REFERENCES public.mei_schedule_events(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  estimated_minutes INTEGER NOT NULL DEFAULT 30 CHECK (estimated_minutes >= 5),
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  due_date DATE DEFAULT NULL,
  category_tag VARCHAR(48) NOT NULL DEFAULT '待辦',
  completed BOOLEAN NOT NULL DEFAULT false,
  subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_mei_schedule_tasks_user_order
  ON public.mei_schedule_tasks(user_id, completed, sort_order ASC);

-- 3.5 單一行程即時留言串 (多人協作討論)
CREATE TABLE IF NOT EXISTS public.mei_schedule_event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.mei_schedule_events(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name VARCHAR(100) NOT NULL,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_mei_schedule_comments_event_created
  ON public.mei_schedule_event_comments(event_id, created_at ASC);

-- 3.6 專注番茄鐘與執行統計紀錄
CREATE TABLE IF NOT EXISTS public.mei_schedule_focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.mei_schedule_events(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.mei_schedule_tasks(id) ON DELETE SET NULL,
  category_tag VARCHAR(48) NOT NULL DEFAULT '專注',
  planned_minutes INTEGER NOT NULL DEFAULT 25 CHECK (planned_minutes > 0),
  actual_minutes INTEGER NOT NULL DEFAULT 25 CHECK (actual_minutes >= 0),
  completed BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT chk_mei_schedule_focus_time_order CHECK (ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_mei_schedule_focus_user_started
  ON public.mei_schedule_focus_sessions(user_id, started_at DESC);

-- 3.7 使用者偏好設定 (三套主題風格、亮深模式、工作時段、情境日曆組)
CREATE TABLE IF NOT EXISTS public.mei_schedule_user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  design_theme VARCHAR(24) NOT NULL DEFAULT 'sky-glass'
    CHECK (design_theme IN ('sky-glass', 'minimal-linear', 'warm-journal')),
  color_mode VARCHAR(12) NOT NULL DEFAULT 'system'
    CHECK (color_mode IN ('light', 'dark', 'system')),
  work_start_hour SMALLINT NOT NULL DEFAULT 9 CHECK (work_start_hour BETWEEN 0 AND 23),
  work_end_hour SMALLINT NOT NULL DEFAULT 18
    CHECK (work_end_hour BETWEEN 1 AND 24 AND work_end_hour > work_start_hour),
  default_event_minutes SMALLINT NOT NULL DEFAULT 45
    CHECK (default_event_minutes BETWEEN 15 AND 240),
  week_starts_on SMALLINT NOT NULL DEFAULT 1 CHECK (week_starts_on IN (0, 1)),
  active_calendar_set VARCHAR(32) NOT NULL DEFAULT 'all'
    CHECK (active_calendar_set IN ('all', 'personal', 'work', 'study', 'shared')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 4. 冪等掛載 updated_at 自動更新觸發器
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_mei_schedule_calendars_updated_at ON public.mei_schedule_calendars;
CREATE TRIGGER trigger_mei_schedule_calendars_updated_at
  BEFORE UPDATE ON public.mei_schedule_calendars
  FOR EACH ROW
  EXECUTE FUNCTION public.mei_schedule_handle_updated_at();

DROP TRIGGER IF EXISTS trigger_mei_schedule_events_updated_at ON public.mei_schedule_events;
CREATE TRIGGER trigger_mei_schedule_events_updated_at
  BEFORE UPDATE ON public.mei_schedule_events
  FOR EACH ROW
  EXECUTE FUNCTION public.mei_schedule_handle_updated_at();

DROP TRIGGER IF EXISTS trigger_mei_schedule_tasks_updated_at ON public.mei_schedule_tasks;
CREATE TRIGGER trigger_mei_schedule_tasks_updated_at
  BEFORE UPDATE ON public.mei_schedule_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.mei_schedule_handle_updated_at();

DROP TRIGGER IF EXISTS trigger_mei_schedule_user_preferences_updated_at ON public.mei_schedule_user_preferences;
CREATE TRIGGER trigger_mei_schedule_user_preferences_updated_at
  BEFORE UPDATE ON public.mei_schedule_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.mei_schedule_handle_updated_at();

-- ============================================================================
-- 5. SECURITY DEFINER 共享權限檢查與邀請碼加入輔助函式 (避免 RLS 遞迴)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mei_schedule_is_calendar_member(
  p_calendar_id UUID,
  p_roles TEXT[] DEFAULT ARRAY['owner', 'editor', 'viewer']::TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL OR p_calendar_id IS NULL THEN
    RETURN false;
  END IF;

  IF 'owner' = ANY(p_roles) AND EXISTS (
    SELECT 1
    FROM public.mei_schedule_calendars c
    WHERE c.id = p_calendar_id AND c.owner_id = v_uid
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.mei_schedule_calendar_members m
    WHERE m.calendar_id = p_calendar_id
      AND m.user_id = v_uid
      AND m.role = ANY(p_roles)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mei_schedule_can_access_event(
  p_event_id UUID,
  p_roles TEXT[] DEFAULT ARRAY['owner', 'editor', 'viewer']::TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_calendar_id UUID;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT e.calendar_id
    INTO v_calendar_id
    FROM public.mei_schedule_events e
   WHERE e.id = p_event_id;

  IF v_calendar_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.mei_schedule_is_calendar_member(v_calendar_id, p_roles);
END;
$$;

CREATE OR REPLACE FUNCTION public.mei_schedule_join_by_invite_code(
  p_invite_code VARCHAR,
  p_display_name VARCHAR DEFAULT '成員'
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_code VARCHAR(12);
  v_calendar_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_code := UPPER(TRIM(COALESCE(p_invite_code, '')));
  IF v_code = '' THEN
    RAISE EXCEPTION 'Invite code is required';
  END IF;

  SELECT c.id
    INTO v_calendar_id
    FROM public.mei_schedule_calendars c
   WHERE c.is_shared = true
     AND UPPER(c.invite_code) = v_code
   LIMIT 1;

  IF v_calendar_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;

  INSERT INTO public.mei_schedule_calendar_members (
    calendar_id,
    user_id,
    display_name,
    role,
    joined_at
  ) VALUES (
    v_calendar_id,
    v_uid,
    COALESCE(NULLIF(TRIM(p_display_name), ''), '成員'),
    'editor',
    clock_timestamp()
  )
  ON CONFLICT (calendar_id, user_id) DO NOTHING;

  RETURN v_calendar_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mei_schedule_is_calendar_member(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mei_schedule_is_calendar_member(UUID, TEXT[]) TO authenticated;

REVOKE ALL ON FUNCTION public.mei_schedule_can_access_event(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mei_schedule_can_access_event(UUID, TEXT[]) TO authenticated;

REVOKE ALL ON FUNCTION public.mei_schedule_join_by_invite_code(VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mei_schedule_join_by_invite_code(VARCHAR, VARCHAR) TO authenticated;

-- ============================================================================
-- 6. 全面啟用 ENABLE + FORCE ROW LEVEL SECURITY 並鎖死匿名存取 (anon)
-- ============================================================================

ALTER TABLE public.mei_schedule_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mei_schedule_calendars FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mei_schedule_calendars FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mei_schedule_calendars TO authenticated;

ALTER TABLE public.mei_schedule_calendar_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mei_schedule_calendar_members FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mei_schedule_calendar_members FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mei_schedule_calendar_members TO authenticated;

ALTER TABLE public.mei_schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mei_schedule_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mei_schedule_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mei_schedule_events TO authenticated;

ALTER TABLE public.mei_schedule_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mei_schedule_tasks FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mei_schedule_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mei_schedule_tasks TO authenticated;

ALTER TABLE public.mei_schedule_event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mei_schedule_event_comments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mei_schedule_event_comments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mei_schedule_event_comments TO authenticated;

ALTER TABLE public.mei_schedule_focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mei_schedule_focus_sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mei_schedule_focus_sessions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mei_schedule_focus_sessions TO authenticated;

ALTER TABLE public.mei_schedule_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mei_schedule_user_preferences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.mei_schedule_user_preferences FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mei_schedule_user_preferences TO authenticated;

-- 6.1 mei_schedule_calendars 權限政策
DROP POLICY IF EXISTS mei_schedule_calendars_select_member ON public.mei_schedule_calendars;
CREATE POLICY mei_schedule_calendars_select_member
  ON public.mei_schedule_calendars
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.mei_schedule_is_calendar_member(id, ARRAY['owner', 'editor', 'viewer'])
  );

DROP POLICY IF EXISTS mei_schedule_calendars_insert_owner ON public.mei_schedule_calendars;
CREATE POLICY mei_schedule_calendars_insert_owner
  ON public.mei_schedule_calendars
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_calendars_update_owner ON public.mei_schedule_calendars;
CREATE POLICY mei_schedule_calendars_update_owner
  ON public.mei_schedule_calendars
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_calendars_delete_owner ON public.mei_schedule_calendars;
CREATE POLICY mei_schedule_calendars_delete_owner
  ON public.mei_schedule_calendars
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- 6.2 mei_schedule_calendar_members 權限政策
DROP POLICY IF EXISTS mei_schedule_cal_members_select ON public.mei_schedule_calendar_members;
CREATE POLICY mei_schedule_cal_members_select
  ON public.mei_schedule_calendar_members
  FOR SELECT
  TO authenticated
  USING (
    public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner', 'editor', 'viewer'])
  );

DROP POLICY IF EXISTS mei_schedule_cal_members_insert_owner ON public.mei_schedule_calendar_members;
CREATE POLICY mei_schedule_cal_members_insert_owner
  ON public.mei_schedule_calendar_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner'])
  );

DROP POLICY IF EXISTS mei_schedule_cal_members_update_owner ON public.mei_schedule_calendar_members;
CREATE POLICY mei_schedule_cal_members_update_owner
  ON public.mei_schedule_calendar_members
  FOR UPDATE
  TO authenticated
  USING (
    public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner'])
  )
  WITH CHECK (
    public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner'])
  );

DROP POLICY IF EXISTS mei_schedule_cal_members_delete_owner_or_self ON public.mei_schedule_calendar_members;
CREATE POLICY mei_schedule_cal_members_delete_owner_or_self
  ON public.mei_schedule_calendar_members
  FOR DELETE
  TO authenticated
  USING (
    public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner'])
    OR (user_id = auth.uid() AND role <> 'owner')
  );

-- 6.3 mei_schedule_events 權限政策 (viewer 僅能讀取，owner/editor 可異動)
DROP POLICY IF EXISTS mei_schedule_events_select_member ON public.mei_schedule_events;
CREATE POLICY mei_schedule_events_select_member
  ON public.mei_schedule_events
  FOR SELECT
  TO authenticated
  USING (
    public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner', 'editor', 'viewer'])
  );

DROP POLICY IF EXISTS mei_schedule_events_insert_editor ON public.mei_schedule_events;
CREATE POLICY mei_schedule_events_insert_editor
  ON public.mei_schedule_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner', 'editor'])
  );

DROP POLICY IF EXISTS mei_schedule_events_update_editor ON public.mei_schedule_events;
CREATE POLICY mei_schedule_events_update_editor
  ON public.mei_schedule_events
  FOR UPDATE
  TO authenticated
  USING (
    public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner', 'editor'])
  )
  WITH CHECK (
    public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner', 'editor'])
  );

DROP POLICY IF EXISTS mei_schedule_events_delete_editor ON public.mei_schedule_events;
CREATE POLICY mei_schedule_events_delete_editor
  ON public.mei_schedule_events
  FOR DELETE
  TO authenticated
  USING (
    public.mei_schedule_is_calendar_member(calendar_id, ARRAY['owner', 'editor'])
  );

-- 6.4 mei_schedule_tasks 權限政策 (僅限本人)
DROP POLICY IF EXISTS mei_schedule_tasks_select_own ON public.mei_schedule_tasks;
CREATE POLICY mei_schedule_tasks_select_own
  ON public.mei_schedule_tasks
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_tasks_insert_own ON public.mei_schedule_tasks;
CREATE POLICY mei_schedule_tasks_insert_own
  ON public.mei_schedule_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_tasks_update_own ON public.mei_schedule_tasks;
CREATE POLICY mei_schedule_tasks_update_own
  ON public.mei_schedule_tasks
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_tasks_delete_own ON public.mei_schedule_tasks;
CREATE POLICY mei_schedule_tasks_delete_own
  ON public.mei_schedule_tasks
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 6.5 mei_schedule_event_comments 權限政策
DROP POLICY IF EXISTS mei_schedule_comments_select_member ON public.mei_schedule_event_comments;
CREATE POLICY mei_schedule_comments_select_member
  ON public.mei_schedule_event_comments
  FOR SELECT
  TO authenticated
  USING (
    public.mei_schedule_can_access_event(event_id, ARRAY['owner', 'editor', 'viewer'])
  );

DROP POLICY IF EXISTS mei_schedule_comments_insert_editor ON public.mei_schedule_event_comments;
CREATE POLICY mei_schedule_comments_insert_editor
  ON public.mei_schedule_event_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.mei_schedule_can_access_event(event_id, ARRAY['owner', 'editor'])
  );

DROP POLICY IF EXISTS mei_schedule_comments_delete_author_or_owner ON public.mei_schedule_event_comments;
CREATE POLICY mei_schedule_comments_delete_author_or_owner
  ON public.mei_schedule_event_comments
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR public.mei_schedule_can_access_event(event_id, ARRAY['owner'])
  );

-- 6.6 mei_schedule_focus_sessions 權限政策 (僅限本人)
DROP POLICY IF EXISTS mei_schedule_focus_select_own ON public.mei_schedule_focus_sessions;
CREATE POLICY mei_schedule_focus_select_own
  ON public.mei_schedule_focus_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_focus_insert_own ON public.mei_schedule_focus_sessions;
CREATE POLICY mei_schedule_focus_insert_own
  ON public.mei_schedule_focus_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_focus_update_own ON public.mei_schedule_focus_sessions;
CREATE POLICY mei_schedule_focus_update_own
  ON public.mei_schedule_focus_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_focus_delete_own ON public.mei_schedule_focus_sessions;
CREATE POLICY mei_schedule_focus_delete_own
  ON public.mei_schedule_focus_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 6.7 mei_schedule_user_preferences 權限政策 (僅限本人)
DROP POLICY IF EXISTS mei_schedule_prefs_select_own ON public.mei_schedule_user_preferences;
CREATE POLICY mei_schedule_prefs_select_own
  ON public.mei_schedule_user_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_prefs_insert_own ON public.mei_schedule_user_preferences;
CREATE POLICY mei_schedule_prefs_insert_own
  ON public.mei_schedule_user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_prefs_update_own ON public.mei_schedule_user_preferences;
CREATE POLICY mei_schedule_prefs_update_own
  ON public.mei_schedule_user_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS mei_schedule_prefs_delete_own ON public.mei_schedule_user_preferences;
CREATE POLICY mei_schedule_prefs_delete_own
  ON public.mei_schedule_user_preferences
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 7. 冪等將事件與留言資料表加入 Supabase Realtime Publication
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'mei_schedule_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.mei_schedule_events;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'mei_schedule_event_comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.mei_schedule_event_comments;
    END IF;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- 8. 遷移後驗證查詢 (Verification SQL — 請依需要複製於 SQL Editor 唯讀檢核)
-- ============================================================================
/*
-- (A) 檢查 7 張 mei_schedule_* 資料表與欄位數量
SELECT table_name, COUNT(column_name) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE 'mei_schedule_%'
GROUP BY table_name
ORDER BY table_name;

-- (B) 檢查全數 7 張表皆開啟 ENABLE + FORCE ROW LEVEL SECURITY
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'mei_schedule_%'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- (C) 確認 anon 角色對 mei_schedule_* 具備零存取權限，並列出全部 RLS 政策
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'mei_schedule_%'
  AND grantee = 'anon';

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'mei_schedule_%'
ORDER BY tablename, policyname;

-- (D) 檢查 3 個 SECURITY DEFINER 輔助函式
SELECT proname, prosecdef, proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'mei_schedule_is_calendar_member',
    'mei_schedule_can_access_event',
    'mei_schedule_join_by_invite_code'
  )
ORDER BY proname;

-- (E) 檢查 Supabase Realtime Publication 註冊狀態
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('mei_schedule_events', 'mei_schedule_event_comments')
ORDER BY tablename;
*/

-- ============================================================================
-- 9. 完整回滾腳本 (Rollback SQL — 僅於需要徹底移除 mei_schedule_* 時手動執行)
-- ============================================================================
/*
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mei_schedule_event_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.mei_schedule_event_comments;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mei_schedule_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.mei_schedule_events;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_mei_schedule_user_preferences_updated_at ON public.mei_schedule_user_preferences;
DROP TRIGGER IF EXISTS trigger_mei_schedule_tasks_updated_at ON public.mei_schedule_tasks;
DROP TRIGGER IF EXISTS trigger_mei_schedule_events_updated_at ON public.mei_schedule_events;
DROP TRIGGER IF EXISTS trigger_mei_schedule_calendars_updated_at ON public.mei_schedule_calendars;

DROP TABLE IF EXISTS public.mei_schedule_focus_sessions CASCADE;
DROP TABLE IF EXISTS public.mei_schedule_event_comments CASCADE;
DROP TABLE IF EXISTS public.mei_schedule_tasks CASCADE;
DROP TABLE IF EXISTS public.mei_schedule_events CASCADE;
DROP TABLE IF EXISTS public.mei_schedule_calendar_members CASCADE;
DROP TABLE IF EXISTS public.mei_schedule_user_preferences CASCADE;
DROP TABLE IF EXISTS public.mei_schedule_calendars CASCADE;

DROP FUNCTION IF EXISTS public.mei_schedule_join_by_invite_code(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.mei_schedule_can_access_event(UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.mei_schedule_is_calendar_member(UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.mei_schedule_handle_updated_at();

COMMIT;
*/
