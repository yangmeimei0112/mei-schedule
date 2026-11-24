# 咩時光 (MeiSchedule) — 五端打包、部署與雲端資料庫遷移手冊

本手冊說明如何將 **咩時光 (MeiSchedule)** 部署至 **Web / PWA、Windows、macOS、Android 與 iOS** 五大平台，並啟用咩創意工作室專屬 Supabase 雲端即時同步與多人共享日曆。

---

## 一、Supabase 專屬雲端資料庫隔離遷移（選用，啟用跨裝置即時同步）

在尚未執行 SQL 遷移前，應用程式預設以 **IndexedDB 本機離線優先模式** 100% 順暢運作。欲啟用真實跨五端即時同步與多人共享日曆邀請碼，請依序執行：

1. 登入咩創意工作室專屬 Supabase 專案（`xtyuyuralrnwzsjvyslp`，東京區域 `ap-northeast-1`）。
2. 開啟 **SQL Editor**，貼上並執行本專案之 `supabase/mei_schedule_migrations.sql`。
3. 所有資料表皆採 `mei_schedule_*` 獨立前綴並強制啟用 `FORCE ROW LEVEL SECURITY`，不會改動既有的 `mei_member_*` 會員核心表。
4. 執行完畢後，可執行遷移腳本檔尾註解區內的 **Verification SQL** 檢驗 7 張資料表、RLS 政策與 Realtime Publication 是否皆正常生效。

---

## 二、網站與 PWA 部署 (Web / Vercel)

1. 於 Vercel 匯入 `yangmeimei0112/mei-schedule` 專案庫（Framework Preset 選 **Vite**）。
2. 建置指令：`npm run build`，輸出目錄：`dist`。
3. `vercel.json` 已內建嚴格安全標頭（CSP、HSTS、X-Frame-Options）與 SPA 路由重寫。
4. 上線後於 iOS Safari「分享 → 加入主畫面」或 Android Chrome / macOS / Windows Edge「安裝應用程式」，即可獲得獨立視窗與離線快取 PWA 體驗。

---

## 三、Windows (`.exe`) 與 macOS (`.dmg`) 桌面軟體打包

### 方式 A：GitHub Actions 全自動編譯（推薦）
推送版本標籤（例如 `git tag v1.1.0 && git push origin v1.1.0`）或於 GitHub Actions 頁面手動執行 **MeiSchedule Five-Platform CI & Release** (`workflow_dispatch`)，系統將自動於雲端產出以下下載產物：
- `meischedule-windows-exe`：Windows 64 位元 NSIS 安裝程式 (`.exe`)
- `meischedule-macos-dmg`：macOS Apple Silicon (`arm64`) 與 Intel (`x64`) 映像檔 (`.dmg`)

### 方式 B：本機編譯
```bash
npm ci
ELECTRON_BUILD=1 npm run build
npm run build:electron
npx electron-builder --mac   # 於 macOS 打包 .dmg
npx electron-builder --win   # 於 Windows 打包 .exe
```

桌面版額外啟用功能：
- 系統匣／macOS 選單列常駐圖示，點擊即彈出今日迷你快覽與自然語言快輸視窗（`#/tray`）。
- 全域快記快捷鍵：`Cmd + Shift + Space`（macOS）或 `Ctrl + Shift + Space`（Windows）。

---

## 四、Android (`.apk` / `.aab`) 與 iOS (Xcode / App Store) 行動端打包

### Android
- **自動化建置**：觸發上述 GitHub Actions 工作流即可直接下載 `meischedule-android-apk`。
- **本機建置與正式簽章上架 Google Play**：
  ```bash
  npm run build
  npx cap add android
  npx cap sync android
  npx cap open android   # 於 Android Studio 使用 Release Keystore 簽章產生 .aab
  ```

### iOS
- **自動化專案封存**：觸發 GitHub Actions 將自動執行 `npx cap sync ios` 並產出 `meischedule-ios-xcode-project.tar.gz`。
- **macOS Xcode 簽章安裝與上架 App Store**：
  ```bash
  npm run build
  npx cap add ios
  npx cap sync ios
  npx cap open ios
  ```
  於 Xcode 的 **Signing & Capabilities** 選擇您的 Apple Developer Team，即可安裝至實體 iPhone / iPad 或執行 Archive 上傳至 TestFlight / App Store。
