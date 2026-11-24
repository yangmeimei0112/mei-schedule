# 咩時光 (MeiSchedule) — 全站檔案分類標準與 AI 代理檢索索引

> **文件定位**：本文件為 AI 代理與開發者進行「咩時光 (MeiSchedule)」跨五端排程系統檔案定位、修改路由與目錄整潔維護之唯一權威索引（Single Source of Truth）。

---

## 一、全站標準目錄分類架構 (Directory Taxonomy)

```text
mei-schedule/
├── .env.example                           # Supabase 雲端連線範本（不含機密金鑰）
├── .gitignore                             # Git 忽略規則（排除 node_modules、dist、.agents、原生編譯產物）
├── .github/workflows/ci-and-release.yml   # 五端自動化 CI 驗證與 Win/Mac/Android/iOS 打包發布管線
├── AGENTS.md                              # 工作區最高工程規範（承襲咩創意工作室六大鐵律）
├── README.md                              # 專案總覽與快速啟動指南
├── index.html                             # 入口 HTML（掛載 PWA Manifest、字體與 mei-dock.js）
├── package.json                           # 依賴宣告與建置／測試／Electron 檢核腳本
├── package-lock.json                      # 鎖定依賴樹
├── tsconfig.json                          # 前端嚴格 TypeScript 設定
├── tsconfig.electron.json                 # Electron 主程式 CommonJS 編譯設定
├── vite.config.ts                         # Vite 6 + Vitest 3 設定
├── tailwind.config.ts                     # Tailwind CSS 主題色票與字體設定
├── postcss.config.js                      # PostCSS 管線設定
├── vercel.json                            # Vercel 邊緣安全標頭 (CSP / HSTS) 與 SPA 重寫
├── capacitor.config.ts                    # Capacitor 6 (iOS / Android) 原生封裝配置
├── electron-builder.yml                   # macOS (.dmg) 與 Windows (.exe) 桌面封裝配置
├── docs/
│   ├── FILE_TAXONOMY_AND_INDEX.md         # 全站檔案分類標準與 AI 代理檢索索引（本文件）
│   └── CROSS_PLATFORM_DEPLOY_GUIDE.md     # 五端部署、簽章打包與 Supabase 資料庫遷移手冊
├── supabase/
│   └── mei_schedule_migrations.sql        # 7 張獨立 mei_schedule_* 資料表、FORCE RLS 與 Realtime 遷移腳本
├── electron/
│   ├── main.ts                            # 主視窗、系統匣／選單列迷你視窗 (#/tray)、全域快捷鍵與原生通知
│   └── preload.ts                         # 安全隔離 contextBridge API (window.MeiDesktop)
├── public/
│   ├── favicon.svg                        # 品牌向量圖示 (Candidate F)
│   ├── pwa-maskable.svg                   # PWA 自適應遮罩圖示
│   ├── manifest.webmanifest               # 標準 Web App Manifest
│   ├── sw.js                              # 離線優先 Service Worker
│   ├── robots.txt                         # 爬蟲存取政策
│   └── sdk/mei-dock.js                    # 咩創意工作室返回大廳膠囊與跨專案 SSO SDK
├── scripts/
│   └── verify-schedule.mjs                # 靜態規範、Zero Emoji、資安與五端設定自動檢驗腳本
└── src/
    ├── main.tsx                           # React 入口與生產環境 PWA Service Worker 註冊
    ├── App.tsx                            # 全站協調器、全域鍵盤快捷鍵、#/tray 路由與 Toast 控制
    ├── types/schedule.ts                  # 全域領域模型與凍結型別合約
    ├── styles/index.css                   # 三套視覺風格 x 亮深雙模式、字體系統與四大比例 dvh 響應式樣式
    ├── data/seedData.ts                   # 8 種語意色票、日曆組、主題資訊與動態今日示範排程
    ├── store/useScheduleStore.tsx         # 全域狀態管理、50 層原子 Undo/Redo 與離線同步佇列整合
    ├── services/                          # 核心業務與純前端演算法層
    ├── components/                        # UI 元件層（五大視角、五大旗艦模組、認證與桌面迷你窗）
    └── __tests__/                         # 自動化單元、整合與跨平台規格測試套件
```

---

## 二、AI 代理任務導向快速檢索表 (Task-to-File Quick Lookup Matrix)

| 修改需求／功能領域 | 首要目標檔案 (Primary Files) | 關聯驗證測試 (Verification Tests) |
| :--- | :--- | :--- |
| **中英文自然語言快速輸入** | `src/services/naturalLanguageParser.ts`<br>`src/components/QuickCaptureBar.tsx` | `src/__tests__/naturalLanguageParser.test.ts` |
| **免費彈性重複規則與系列編輯** | `src/services/recurrenceEngine.ts`<br>`src/components/EventDetailDrawer.tsx` | `src/__tests__/recurrenceEngine.test.ts` |
| **智慧排程、衝突偵測與預覽重排 (Diff)** | `src/services/smartScheduler.ts`<br>`src/components/SmartRescheduleDrawer.tsx` | `src/__tests__/smartScheduler.test.ts` |
| **RFC 5545 `.ics` 互通與 Google 日曆連動** | `src/services/icsService.ts`<br>`src/components/CalendarSyncModal.tsx` | `src/__tests__/icsService.test.ts` |
| **五大排程視角與拖曳時間塊** | `src/components/TimelineView.tsx`<br>`src/components/WeekGridView.tsx`<br>`src/components/MonthView.tsx`<br>`src/components/AgendaListView.tsx`<br>`src/components/TaskInboxSidebar.tsx` | `src/__tests__/timelineAndViews.test.tsx` |
| **專注番茄鐘、統計儀表板與共享日曆留言** | `src/components/FocusTimerModal.tsx`<br>`src/components/AnalyticsDashboard.tsx`<br>`src/components/SharedCalendarModal.tsx`<br>`src/components/EventDetailDrawer.tsx` | `src/__tests__/sharedAndFocus.test.tsx` |
| **三套設計風格、亮深雙模式、Toast 與 `dvh`** | `src/styles/index.css`<br>`src/components/AppearanceSettingsModal.tsx`<br>`src/components/StudioToast.tsx`<br>`src/components/BrandMark.tsx` | `src/__tests__/themeAndResponsive.test.tsx`<br>`scripts/verify-schedule.mjs` |
| **Supabase Cloud SSO v3.0、離線儲存與同步** | `src/services/supabaseClient.ts`<br>`src/services/memberAuthService.ts`<br>`src/services/localStore.ts`<br>`src/services/scheduleSyncService.ts`<br>`supabase/mei_schedule_migrations.sql` | `src/__tests__/authAndCrossPlatform.test.tsx` |
| **Electron 桌面端、Capacitor 行動端與 CI/CD** | `electron/main.ts`<br>`electron/preload.ts`<br>`src/services/notificationBridge.ts`<br>`capacitor.config.ts`<br>`electron-builder.yml`<br>`.github/workflows/ci-and-release.yml` | `scripts/verify-schedule.mjs`<br>`npm run build:electron:check` |

---

## 三、標準必跑驗證指令

每次修改後須確認以下 5 道檢查全數通過：
1. `npx tsc --noEmit` — TypeScript 嚴格型別檢查
2. `npm test` — Vitest 全套單元、元件與整合測試
3. `npm run build` — Vite 正式環境 Web/PWA 打包檢查
4. `npm run build:electron:check` — Electron 主程式編譯與 `scripts/verify-schedule.mjs` 靜態規範快篩
