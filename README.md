# 咩時光 MeiSchedule

咩創意工作室（Mei Creative Studio）打造的跨五端全能智慧排程與多人共享時間軸軟體，一套統一現代化核心同時支援 **iOS、Android、macOS、Windows 與網站 (Web / PWA)**。

## 核心特色

1. **五大排程視角無縫切換**
   - 沉浸式單日時間軸（含可用空檔提示、子任務勾選、提早完成釋放空檔、手機防誤觸 `-15m / +15m` 微調）
   - 三日視圖與週視圖多欄網格（自動防重疊並排、支援待辦與行程拖曳改期）
   - 手機友善月總覽（所有螢幕尺寸皆完整顯示語意色彩條與事件標題，絕不只顯示灰點）
   - 依日期分組與即時關鍵字篩選清單視角
2. **中英文自然語言快速輸入**
   - 直接輸入「明天下午3點半跟產品團隊開會 90分鐘 #工作 每週三 !高」或英文語句，即時解析日期、時間段、時長、色標與免費重複規則。
3. **五大旗艦生產力模組**
   - **專注番茄鐘計時器與時間統計儀表板**：圓形進度環計時、連續專注天數（Streak）、近 7 日專注趨勢與分類時間投入佔比。
   - **智慧排程助手與「預覽重排」模式 (Preview Mode)**：未排待辦一鍵自動填入空檔、延誤衝突智慧順延彈性區塊（嚴格保護鎖定會議），所有變更皆先呈現前後差異預覽，確認套用後支援 50 層原子一鍵復原（Undo / Redo）。
   - **標準日曆互通**：完整支援 RFC 5545 `.ics` 檔案／文字雙向匯入（自動去重）與匯出，並內建一鍵加入 Google 日曆連結。
   - **TimeTree 級多人共享日曆與單一行程即時留言**：建立共享日曆與 6 碼邀請碼、成員角色權限管理（Owner / Editor / Viewer）及單一行程即時討論串。
   - **跨五端原生通知與系統匣迷你視窗**：Electron 桌面系統匣今日快覽（`#/tray`）與全域快記快捷鍵（`Cmd/Ctrl + Shift + Space`）、Capacitor 本地排程推播與觸覺回饋。
4. **三套視覺風格 × 亮／深雙模式（6 種外觀）**
   - 預設承襲咩創意工作室「晴空澄澈毛玻璃 (`sky-glass`)」，內建一鍵切換「極簡效率 (`minimal-linear`)」與「溫暖手帳 (`warm-journal`)」，全站嚴格零系統 Emoji、100% Lucide 向量圖示，並完整適配手機四大長寬比與動態視窗高度 (`dvh`)。
5. **本機優先離線可用 ＋ 咩創意工作室雲端帳號 SSO**
   - 免登入開箱即用（IndexedDB 離線持久化），登入咩創意工作室雲端帳號（原生 Google OAuth／信箱驗證碼註冊／Passkey）即無縫合併同步，並整合 `mei-dock.js` 返回工作室大廳膠囊。

## 快速開始

```bash
# 安裝依賴（純 Web 開發環境可略過 Electron 執行檔下載）
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install

# 啟動本機開發伺服器
npm run dev

# 執行完整驗證（型別檢查、單元與整合測試、Web 建置、Electron 編譯與靜態規範檢驗）
npx tsc --noEmit
npm test
npm run build
npm run build:electron:check
```

## 延伸文件

- 全站目錄架構與 AI 檢索索引：[docs/FILE_TAXONOMY_AND_INDEX.md](docs/FILE_TAXONOMY_AND_INDEX.md)
- 五端打包部署與 Supabase 遷移指南：[docs/CROSS_PLATFORM_DEPLOY_GUIDE.md](docs/CROSS_PLATFORM_DEPLOY_GUIDE.md)
- 雲端資料庫隔離遷移腳本：[supabase/mei_schedule_migrations.sql](supabase/mei_schedule_migrations.sql)
