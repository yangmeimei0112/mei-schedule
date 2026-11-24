import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

function walkFiles(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'dist-electron' ||
      entry.name === '.git' ||
      entry.name === '.agents'
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, exts, out);
    } else if (exts.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

test('1. 全站零系統 Emoji 鐵律靜態掃描 (src, electron, public, supabase, docs, scripts, root)', () => {
  const exts = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.mjs',
    '.css',
    '.html',
    '.svg',
    '.sql',
    '.json',
    '.webmanifest',
    '.txt',
    '.md',
    '.yml',
    '.yaml'
  ]);
  const targets = [
    ...walkFiles(path.join(ROOT, 'src'), exts),
    ...walkFiles(path.join(ROOT, 'electron'), exts),
    ...walkFiles(path.join(ROOT, 'public'), exts),
    ...walkFiles(path.join(ROOT, 'supabase'), exts),
    ...walkFiles(path.join(ROOT, 'docs'), exts),
    ...walkFiles(path.join(ROOT, 'scripts'), exts),
    ...walkFiles(path.join(ROOT, '.github'), exts),
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'README.md'),
    path.join(ROOT, 'AGENTS.md'),
    path.join(ROOT, 'capacitor.config.ts'),
    path.join(ROOT, 'electron-builder.yml'),
    path.join(ROOT, 'vercel.json')
  ];

  assert.ok(targets.length >= 25, '預期至少涵蓋 25 支專案檔案');
  for (const filePath of targets) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(EMOJI_REGEX);
    assert.equal(
      match,
      null,
      `檔案 ${path.relative(ROOT, filePath)} 發現禁用系統 Emoji: ${match?.[0]}`
    );
  }
});

test('2. 專屬日曆時間塊標誌 (Time Blocks)、母品牌標誌、Lucide strokeWidth=1.75、三套視覺主題與行動端 dvh 規範驗證', () => {
  const brandSrc = fs.readFileSync(path.join(ROOT, 'src/components/BrandMark.tsx'), 'utf8');
  assert.match(brandSrc, /strokeWidth\s*=\s*1\.75/);
  assert.match(brandSrc, /absoluteStrokeWidth\s*=\s*true/);
  assert.ok(brandSrc.includes('M8.2 3.2v2.4M15.8 3.2v2.4'));
  assert.ok(brandSrc.includes('data-logo-design="time-blocks"'));
  assert.ok(brandSrc.includes('M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'));
  assert.ok(brandSrc.includes('M12 14.5c'));

  const favSvg = fs.readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8');
  assert.ok(favSvg.includes('M8.2 3.2v2.4M15.8 3.2v2.4'));
  const pwaSvg = fs.readFileSync(path.join(ROOT, 'public/pwa-maskable.svg'), 'utf8');
  assert.ok(pwaSvg.includes('M8.2 3.2v2.4M15.8 3.2v2.4'));

  const css = fs.readFileSync(path.join(ROOT, 'src/styles/index.css'), 'utf8');
  for (const token of [
    ':root[data-design-theme="sky-glass"]',
    ':root.dark[data-design-theme="sky-glass"]',
    ':root[data-design-theme="minimal-linear"]',
    ':root.dark[data-design-theme="minimal-linear"]',
    ':root[data-design-theme="warm-journal"]',
    ':root.dark[data-design-theme="warm-journal"]',
    '.min-h-dvh-screen',
    'min-height: 100dvh;',
    '@media (max-width: 360px)',
    '@media (orientation: landscape) and (max-height: 500px)'
  ]) {
    assert.ok(css.includes(token), `index.css 缺少必要規範片段：${token}`);
  }

  const toastSrc = fs.readFileSync(path.join(ROOT, 'src/components/StudioToast.tsx'), 'utf8');
  assert.ok(toastSrc.includes('bg-sky-100/95'));
  assert.ok(toastSrc.includes('text-slate-900'));
  assert.ok(toastSrc.includes('border-sky-300/80'));
  assert.ok(toastSrc.includes('dark:bg-sky-950/95'));
  assert.ok(toastSrc.includes('bottom-36 sm:bottom-24'));
});

test('3. Supabase Cloud SSO v3.0 與 7 張 mei_schedule_* FORCE RLS 資料庫隔離驗證', () => {
  const supaSrc = fs.readFileSync(path.join(ROOT, 'src/services/supabaseClient.ts'), 'utf8');
  assert.ok(supaSrc.includes('xtyuyuralrnwzsjvyslp'));
  assert.ok(supaSrc.includes("flowType: 'pkce'"));

  const authSrc = fs.readFileSync(path.join(ROOT, 'src/services/memberAuthService.ts'), 'utf8');
  assert.ok(authSrc.includes("prompt: 'select_account'"));
  assert.ok(authSrc.includes("access_type: 'offline'"));
  assert.equal(authSrc.includes('skipBrowserRedirect: true'), false);
  assert.equal(authSrc.includes('creator@' + 'meistudio.live'), false);

  const sql = fs.readFileSync(path.join(ROOT, 'supabase/mei_schedule_migrations.sql'), 'utf8');
  assert.equal(/(?:CREATE|ALTER|DROP)\s+TABLE[^;]*mei_member_/i.test(sql), false);
  for (const table of [
    'mei_schedule_calendars',
    'mei_schedule_calendar_members',
    'mei_schedule_events',
    'mei_schedule_tasks',
    'mei_schedule_event_comments',
    'mei_schedule_focus_sessions',
    'mei_schedule_user_preferences'
  ]) {
    assert.ok(sql.includes(`public.${table}`), `SQL 缺少資料表 ${table}`);
    assert.ok(
      sql.includes(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`),
      `SQL 缺少 ${table} FORCE RLS`
    );
  }
});

test('4. 跨五端原生封裝設定、Electron 安全隔離與 PWA／Vercel／CI 管線完整性驗證', () => {
  // Electron source security + compiled JS check
  const electronMain = fs.readFileSync(path.join(ROOT, 'electron/main.ts'), 'utf8');
  assert.ok(electronMain.includes('contextIsolation: true'));
  assert.ok(electronMain.includes('nodeIntegration: false'));
  assert.ok(electronMain.includes('sandbox: true'));
  assert.ok(electronMain.includes('#/tray'));
  assert.ok(electronMain.includes('CommandOrControl+Shift+Space'));

  const electronPreload = fs.readFileSync(path.join(ROOT, 'electron/preload.ts'), 'utf8');
  assert.ok(electronPreload.includes("contextBridge.exposeInMainWorld('MeiDesktop'"));

  assert.ok(
    fs.existsSync(path.join(ROOT, 'dist-electron/main.js')),
    '必須先編譯產生 dist-electron/main.js'
  );
  assert.ok(
    fs.existsSync(path.join(ROOT, 'dist-electron/preload.js')),
    '必須先編譯產生 dist-electron/preload.js'
  );

  // Capacitor & electron-builder configs
  const capCfg = fs.readFileSync(path.join(ROOT, 'capacitor.config.ts'), 'utf8');
  assert.ok(capCfg.includes("appId: 'studio.meicreative.schedule'"));
  assert.ok(capCfg.includes("webDir: 'dist'"));

  const ebCfg = fs.readFileSync(path.join(ROOT, 'electron-builder.yml'), 'utf8');
  assert.ok(ebCfg.includes('target: dmg'));
  assert.ok(ebCfg.includes('target: nsis'));

  // PWA manifest & Service Worker
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public/manifest.webmanifest'), 'utf8')
  );
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#38BDF8');
  assert.ok(fs.existsSync(path.join(ROOT, 'public/sw.js')));

  // Vercel security headers
  const vercelCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const hdrs = Object.fromEntries(vercelCfg.headers[0].headers.map((h) => [h.key, h.value]));
  assert.equal(hdrs['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(hdrs['X-Content-Type-Options'], 'nosniff');
  assert.ok(hdrs['Strict-Transport-Security'].includes('max-age=63072000'));
  assert.ok(hdrs['Content-Security-Policy'].includes("default-src 'self'"));

  // GitHub Actions 5-platform jobs
  const ciYml = fs.readFileSync(
    path.join(ROOT, '.github/workflows/ci-and-release.yml'),
    'utf8'
  );
  for (const job of ['ci:', 'build-windows:', 'build-macos:', 'build-android:', 'package-ios-project:']) {
    assert.ok(ciYml.includes(job), `CI workflow 缺少工作項目：${job}`);
  }
});

test('5. 檔案索引完整與根目錄零雜物檢核', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/FILE_TAXONOMY_AND_INDEX.md')));
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/CROSS_PLATFORM_DEPLOY_GUIDE.md')));

  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('.agents/'), '.gitignore 必須排除 .agents/');

  const rootEntries = fs.readdirSync(ROOT);
  for (const name of rootEntries) {
    assert.equal(
      /\.sql$/i.test(name),
      false,
      `根目錄不應出現裸露 .sql 檔案：${name}`
    );
  }
});
