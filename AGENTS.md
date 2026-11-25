# 咩時光 (MeiSchedule) — 工作區工程規範 (Workspace Engineering Rules)

本專案為「咩創意工作室 (Mei Creative Studio)」旗下跨五端（Web/PWA、macOS、Windows、iOS、Android）全能智慧排程系統，所有 AI 代理與開發者必須嚴格遵守以下六大鐵律，無一例外。

## 1. 行動端多比例響應式規範 (Multi-Aspect-Ratio Mobile Adaptation)
- **動態視窗高度 (`dvh`)**：全站主容器、抽屜、側邊欄與彈窗必須優先使用 `dvh` 單位（`.min-h-dvh-screen`、`.h-dvh-90`、`.max-h-dvh-92`、`.max-h-dvh-90`、`.max-h-dvh-85`、`.max-h-dvh-60`，並一律保留 `vh` 退路於前一行），防止 iOS Safari 與 Android Chrome 動態網址列裁切底部操作鈕。
- **四大長寬比自適應矩陣**：
  1. **窄屏 / 摺疊外螢幕 (`21:9 ~ 22:9`, `320px-360px`)**：主標題使用 `clamp()` 流體字級（`.studio-hero-title-zh` / `.studio-hero-title-en`）；`<=374px` 時標語取消強制兩端對齊以防字距拉寬；頂部導覽列會員名稱須加上 `truncate` 與最大寬度限制；套用 `.narrow-compact-px` 防水平溢位。
  2. **主流直向手機 (`16:9 ~ 20:9`, `375px-430px`)**：維持單欄時間軸、非灰點月總覽色條、平齊式底部單手導覽列（禁止 `-mt-4` 凸出）、`-15m/+15m` 防誤觸微調按鈕與安全區域內距（`env(safe-area-inset-*)`）。
  3. **摺疊內螢幕 / 小平板 (`4:3 ~ 1:1`, `600px-840px`)**：統計儀表板、外觀主題卡與雙欄網格於 `sm:` (`640px+`) 與 `.foldable-inner-grid` 自動啟用雙欄佈局，並優化三日視角顯示密度。
  4. **手機橫向短高模式 (`orientation: landscape` 且 `max-height: 500px`)**：自動套用 `.mobile-header-bar`、`.mobile-bottom-nav` 與 `.landscape-compact-modal` 收斂上下導覽列與彈窗高度。
- **按鈕過渡禁令**：`.btn-sky-primary` 與 `.btn-sky-secondary` 嚴禁使用 `transition: all`，必須明確列舉過渡屬性，防止干擾響應式寬度收斂。

## 2. 狀態通知膠囊 (Toast) 視覺對比與防重疊規範
- **亮色模式高對比淡藍底色**：`[data-testid="studio-toast"]` 在亮色模式下必須使用淡藍色高對比底色 `bg-sky-100/95`、深色文字 `text-slate-900` 與邊框 `border-sky-300/80`（深色模式為 `dark:bg-sky-950/95 dark:text-white dark:border-sky-400/40`），嚴禁使用透明或純白底色；支援內嵌「復原 (Undo)」動作按鈕。
- **行動端浮動元件防重疊**：在手機端當底部懸浮按鈕或 `mei-dock.js` 作用中時，Toast 必須自動上移至 `bottom-36 sm:bottom-24`，並加上 `max-w-[calc(100vw-2rem)]` 防止窄屏溢位。

## 3. 全站會員註冊、Gmail 快速登入、憑證綁定與跨專案 SSO 規範 (Supabase Cloud SSO v3.0)
- **本機離線優先 (Local-First)**：免登入開箱即用，所有排程、待辦、專注紀錄與共享示範均優先讀寫本機 IndexedDB (`mei_schedule_db_v1`，含 `localStorage` 與記憶體安全降級)；登入後無縫合併同步至雲端。
- **正式雲端註冊與驗證碼**：會員註冊表單必須包含「暱稱」、「信箱 (Email)」、「密碼」、「密碼雙重確認」與「純向量 SVG 數學防機器人驗證碼」，完成註冊並同步 `mei_member_profiles`。
- **原生 Google OAuth 強制帳號選擇規範**：點擊 Google／Gmail 登入必須調用 `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'select_account' } } })` 導向真實 Google 官方帳號選擇畫面；嚴禁傳入 `skipBrowserRedirect: true`，嚴禁在未完成授權前自動合成 `creator@meistudio.live` 等本地假帳號。
- **雙重憑證綁定與跨站 SSO**：支援登入後增設密碼、綁定 Gmail 與綁定生物辨識 Passkey；維持 `mei_universal_member_sso_v1`、`mei_universal_sso_channel_v1`、`mei:sso-state-changed` 與 `mei_sso_v2.*` 簽章權杖（拒絕舊版 `MEI-SSO-*`）；嵌入 `public/sdk/mei-dock.js`（Electron `#/tray` 路由自動抑制）。
- **獨立資料庫與表前綴隔離**：嚴格直連「咩創意工作室」專屬獨立資料庫（`xtyuyuralrnwzsjvyslp` in `ap-northeast-1`，`flowType: 'pkce'`，`storageKey: 'mei_studio_supabase_auth_token_v1'`）；所有排程資料表嚴格採用 `mei_schedule_*` 前綴、`clock_timestamp()` 與 `ENABLE` / `FORCE ROW LEVEL SECURITY`（零污染既有 `mei_member_*` 資料表）；AI 代理僅可撰寫與檢驗 `supabase/mei_schedule_migrations.sql`，嚴禁擅自對遠端資料庫執行 DDL。

## 4. 零系統 Emoji、Lucide 1.75 與三套視覺風格規範
- **零系統 Unicode Emoji**：全站所有原始碼、HTML、SVG、SQL、測試與文件嚴格禁止命中 `/[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u` 之字元（包含 `U+2318`、`U+2713`、`U+2715`、`U+23F0` 等符號區；鍵盤快捷鍵一律以純 ASCII `Cmd/Ctrl + K` 呈現）。100% 使用 Lucide 向量圖示（統一封裝預設 `strokeWidth=1.75`、`absoluteStrokeWidth=true`）。
- **品牌標誌規範**：
  - 本專案專屬產品標誌 `MeiScheduleLogo` 採用 **日曆時間塊 (Time Blocks)** 純向量幾何（圓角日曆外框 `rx="4.2"` ＋ 雙裝訂針 `M8.2 3.2v2.4M15.8 3.2v2.4` ＋ 兩段錯落時間塊膠囊，`strokeWidth=1.75`、支援 7 級尺寸 `2xs` 至 `2xl`），統一套用於頂部導覽列、Electron 系統匣、`public/favicon.svg` 與 `public/pwa-maskable.svg`。
  - 母品牌「咩創意工作室」識別 `StudioLogo`（用於會員專區與 `public/sdk/mei-dock.js`）維持既有工作室標誌規範與 7 級尺寸矩陣，不混用子專案產品標誌。
- **三套風格 x 亮深雙模式**：支援 `sky-glass`（預設：晴空澄澈毛玻璃）、`minimal-linear`（極簡效率專業）、`warm-journal`（溫暖質感手帳）三套設計風格，搭配亮色／深色模式即時零閃爍切換。

## 5. 任務狀態回報與多代理監控紀律 (Task Status Reporting Integrity & Anti-Noise Protocol)
- **靜默過濾純心跳檢查**：攔截 `[Sentinel Liveness Check]` 或僅表達「運作正常／請稍候」且無實質代碼或閘門狀態變更的訊息，嚴禁轉發給使用者；僅於任務完成、里程碑狀態切換（過閘或退回）、發生阻塞／錯誤／重啟、或需要使用者輸入資料時才回報。
- **零幻覺與零重複贅詞**：嚴格依據實際讀取的檔案（`GATE_STATUS.md`、`handoff.md`、`git status`）回報，禁止推測尚未發生的輪次或重複貼上「請稍候」模板語句。
- **子軌道閘門直讀查核**：彙整進度前必須直接核對所有活躍子協調員的 `GATE_STATUS.md`，凡出現 `FAIL`、`REQUEST_CHANGES` 或 `INTEGRITY VIOLATION` 必須如實揭露影響檔案與退回原因。
- **佇列合併與四欄固定看板**：多條非同步通知合併去重為單一看板，固定分四欄：`已完成`、`進行中`、`待處理／阻礙與退回原因`、`需要您配合或輸入的事項`。

## 6. 全站檔案分類標準、AI 代理檢索索引與無用檔案清理規範 (Workspace File Taxonomy & Hygiene Standard)
- **詳細架構索引入口**：任何 AI 代理在查找、新增、修改或搬移檔案前，必須優先查閱 `docs/FILE_TAXONOMY_AND_INDEX.md`。
- **標準目錄職責分區**：
  1. `src/types/`：凍結領域型別契約（`schedule.ts`）。
  2. `src/components/`：UI 視覺、五大排程視角、五大旗艦模組、會員專區與品牌圖示元件。
  3. `src/services/`：純演算法引擎（NLP、重複規則、智慧預覽排程、ICS）、本機 IndexedDB、Supabase SSO 與雲端同步服務、跨平台通知橋接。
  4. `src/store/`：全域狀態管理與 50 層 Undo/Redo 歷史棧（`useScheduleStore.tsx`）。
  5. `src/data/`：首次開啟繁體中文示範排程、語意色票與情境日曆組配置（`seedData.ts`）。
  6. `src/styles/`：三套視覺風格 x 亮深雙模式、字體導入與四大比例 `dvh` 響應式樣式（`index.css`）。
  7. `src/__tests__/`：單元／元件／整合測試與 `e2e_requirements/` 分層規格測試。
  8. `electron/`：桌面主程式（`main.ts`）與安全預載橋接（`preload.ts`）。
  9. `public/`：公開靜態資產（`favicon.svg`、`pwa-maskable.svg`、`manifest.webmanifest`、`sw.js`、`robots.txt`、`ai.txt`、`sdk/mei-dock.js`）。
  10. `scripts/`、`supabase/`、`docs/`、`.github/workflows/`：靜態檢核腳本（`verify-schedule.mjs`）、隔離資料庫遷移腳本（`mei_schedule_migrations.sql`）、繁體中文架構與五端部署文件、五端自動化 CI/Release 管線。
- **根目錄零雜物與清理紀律**：`.agents/` 必須納入 `.gitignore` 且永不提交至 Git；根目錄嚴禁殘留 `TEST_*.md`、`*_REPORT.md`、裸露 `.sql` 或一次性實驗腳本。
- **全繁體中文交付規範**：所有向使用者呈現之文件、審查報告、驗收紀錄與提交摘要，一律使用繁體中文撰寫。

## 7. 全站行程與內容自動換行閱讀規範 (Schedule Content Auto-Wrap & Zero-Ellipsis Rule)
- **嚴禁以 `...` (`truncate`) 截斷行程與待辦標題**：三日視圖、週視圖、月總覽色條、時間軸時段格、待辦收件匣、智慧排程預覽、指令搜尋列與系統匣等所有使用者閱讀區之行程與任務標題，一律必須套用 `.schedule-title-wrap`（自動換行、`overflow-wrap: anywhere`、`word-break: break-word`），搭配 `items-start` 確保圓點／圖示對齊首行。
- **短時長區塊智慧擴展防裁切**：於時間網格（`WeekGridView`）中，短時長排程在下方空檔允許範圍內自動微調高度以完整呈現換行文字，並透過 `preferences.autoWrapTitles`（預設 `true`，同步至 `<html data-title-wrap="wrap | nowrap">`）提供系統級控制。

