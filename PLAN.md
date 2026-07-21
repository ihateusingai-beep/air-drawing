# Air Drawing Fork Plan

**Source**: `~/workspace/vs code/air drawing/index.html` (33 KB / 655 行 / single-file)
**Target Stack**: Vite + React 19 + TypeScript + Tailwind v4 + Zustand + **PWA** + **MediaPipe Pose + Hands**
**Target Path**: `~/workspace/vs code/air drawing/`(同目錄,逐步演進,保留原 `index.html` 作 archive)
**模式**: 純 client-side、私隱零外流(同 source 立場一致,**對智障 / ASD / non-verbal 學生更敏感**)
**Target Devices**: **iPad + Notebook 跨裝置** — 兩種形態都要 work
- **iPad**:Safari Add to Home Screen → PWA 全螢幕獨立 app,免 App Store
- **Notebook**(macOS / Windows / Linux):Chrome / Edge / Firefox desktop layout + Chromium 系列 PWA install banner
- **iPad 條款**: iOS 16.4+(Manifest 支援)、HTTPS 部署(鏡頭權限)、A12+ 晶片(MediaPipe wasm 順)
- **Notebook 條款**: 任何 modern browser(Chrome 90+ / Edge 90+ / Firefox 88+ / Safari 14+)、HTTPS 鏡頭權限(MediaPipe 性能綽綽有餘)
**Project 定位**(2026-07-21 v2.0 pivot,3-tier accessibility):
- ❌ 唔再係「AI 魔法空中畫筆」嘅純 clone
- ✅ 定位為 **Non-verbal 表達輔具**(AAC lite)— 透過肢體動作 + 情緒畫筆,**幫不常說話 / 不能說話 / 不喜表達嘅智障 / ASD 學生學表達情緒**
- **核心 user value**:學表達 > 學畫畫;學被理解 > 學形狀
- **對標**:AAC(輔助溝通)/ Art Therapy / Snoezelen / PECS / DIR/Floortime
- **情緒 model**:**Plutchik 8 emotions**(國際教育 standard)
- **Plutchik 8** = Joy / Sadness / Anger / Fear / Trust / Disgust / Surprise / Anticipation(每個有 emoji + 中文 + 顏色綁定)
- **🆕 3 個難度模式 / Accessibility Tiers**(對應唔同能力學生):
  - **🟢 弱(Low / Beginner)**:鏡頭見到 → mon 顯示 8 個表情 chip → **cam trace 學生手指 click chip** → chip 有 **animation + 語音(TTS)**。**唔需要做動作,只揀**
  - **🟡 中(Mid / Intermediate)**:cam trace 學生做**特定動作才 trigger 情緒**(動作 → 情緒 classifier,8 個動作對應 8 種情緒)
  - **🔴 強(High / Advanced)**:跟 v1.0 plan(自由畫 / 情緒畫筆 / 表達 vocabulary)
  - **模式入口**:開 app 預設顯示「揀模式」畫面(3 個 mode chip + 上次用過嘅 mode highlight)
  - **模式持久化**:per-profile 記低上次 mode
**Version**: v4.0.0(由 source v3.0 系列 major bump,因 stack + 定位改變)

---

## 1. 為何揀呢個 stack

| 因素 | 結論 |
|---|---|
| 個人 stack 一致性 | Gundam Halo / OpenJarvis 都係 React 19,mental model 唔使重新學 |
| Source 規模 | 655 行 single-file,拆 component 唔太難,5 個主要 UI section |
| iPad 免安裝 + Notebook | Vite PWA + `vite-plugin-pwa` 一行 config,跨裝置 native-feel |
| CDN 私隱問題 | Vite + npm 可完全本地化 vendor,4 個 CDN → 0 CDN(未來需求) |
| MediaPipe 維護 | 官方 `@mediapipe/tasks-vision` npm package,`@mediapipe/hands` 仍有維護但 tasks-vision 係新標準 |
| Tailwind v4 | 跟 Gundam Halo stack,config 可復用 |

**唔揀 Tauri 嘅原因**:用戶確認「普通 dev 環境」,無需離線 desktop-only;Tauri 係後續 Phase 6 可選。
**唔揀 Vue / Svelte 嘅原因**:個人 stack drift,無長期維護動力。
**唔揀 Capacitor / Cordova 嘅原因**:用戶要「免安裝」,App Store / TestFlight 流程違反呢個訴求。PWA 係正解。
**唔揀 Next.js / SSR 嘅原因**:鏡頭 + Canvas 必須 client-only,SSR 帶嚟嘅 overhead 零價值。

---

## 1.5 跨裝置差異表(plan 設計基準)

> iPad 同 notebook 嘅 UX 假設、輸入模型、瀏覽器限制都唔同。**一份 code 兩個 device,React 條件式 render + Tailwind responsive prefix**。

| 維度 | iPad | Notebook |
|---|---|---|
| **主要輸入** | 觸控(finger) | 滑鼠 + 鍵盤 |
| **次要輸入** | Apple Pencil / Magic Keyboard trackpad | Touchpad(2 finger gesture) |
| **Pointer 事件** | `touchstart` / `touchmove` / `touchend` | `mousedown` / `mousemove` / `mouseup` + `pointermove` |
| **鍵盤** | 冇實體鍵(除非 Magic Keyboard) | 完整實體鍵盤 → hotkey 期望高 |
| **Hover state** | ❌ 冇 hover,UI 要靠 active + 顏色差異 | ✅ 期待 hover 高亮、tooltip |
| **Focus ring** | iOS 自動 focus visible(藍框)| Desktop 期待 focus-visible ring |
| **視窗** | 全螢幕 PWA,固定 834×1194 / 1194×834 / 1024×1366 | Resizable,自由 resize |
| **鏡頭** | 前置 / 後置(`facingMode: environment` 預設後置)| 視像鏡頭 + USB 外接(罕見) |
| **PWA install** | Add to Home Screen | Chrome / Edge `beforeinstallprompt` banner |
| **MediaPipe 性能** | 中(A12+ 順,A10 慢)| 高 |
| **Web Audio autoplay** | 需 first touch 解鎖(`audioCtx.resume()`) | 視乎 browser policy |
| **Web Share API** | ✅ iOS 完整支援 | ⚠️ Chrome/Edge 部分(2026 已綠) |
| **離線 storage** | iOS PWA ~50MB 起跳(iOS 17.4+ 解封)| Desktop 充裕(Quota 數 GB) |
| **iOS 版本需求** | 16.4+(Manifest 支援)| N/A |

**設計含義**:

1. **Input 統一**:`useDrawingPointer` hook 內部自動偵測 — `matchMedia('(pointer: coarse)')` → touch path,`(pointer: fine)` → mouse path。**唔好用 user agent 嗅探**,要 media query level
2. **Keyboard shortcuts**:Phase 3 寫 `<KeyboardShortcuts>` listener,只喺 notebook(i.e. `pointer: fine + hover: hover`)enable
3. **Hover state**:Tailwind class pattern:
   ```
   <button class="active:scale-95 
                  md:hover:bg-slate-700 
                  focus-visible:ring-2 focus-visible:ring-amber-400">
   ```
4. **Source 嗰個「滑鼠/觸控繪圖模式」label** 要 device-aware:
   - iPad → 「手指/Apple Pencil 繪圖模式」
   - Notebook → 「滑鼠/觸控板繪圖模式」
5. **viewport meta** 兩套:
   - 一份 base:`width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no`
   - 兩者都共用,PWA 自動 standalone mode
6. **Layout 寬度**:
   - iPad 直向(834w):右欄 panel 摺疊入 hamburger drawer
   - iPad 橫向(1194w+):同 notebook layout,左 canvas + 右 panel
   - Notebook:< 1024px 自動 stack(縱向)
   - Notebook:≥ 1024px 左右分欄
7. **PWA install UX**:
   - iPad:custom in-app banner「加入主畫面教學」(iOS 唔彈原生 prompt)
   - Chrome/Edge:`beforeinstallprompt` → system banner
   - Firefox / Safari desktop:hidden(只 bookmark)

**Acceptance 對兩 device 各列**:每個 Phase 嘅 acceptance 拆 `iPad:` / `Notebook:` 兩行(下面 phase 章節統一)。

---

## 2. Source 模組地圖(現狀 baseline)

```
index.html (655 行,單檔)
├── <head> 載入 4 個 CDN
│   ├── tailwindcss.com/cdn          (Tailwind v3 JIT CDN)
│   ├── jsdelivr/mediapipe/camera_utils
│   └── jsdelivr/mediapipe/hands
│
├── <body> DOM 結構
│   ├── <header>     頂部狀態列(鏡頭指示燈、提示)
│   ├── <main>       左右兩欄
│   │   ├── 左:Canvas Stack(4 層)
│   │   │   ├── <video webcam>          鏡頭底層(opacity 可調)
│   │   │   ├── <canvas templateCanvas> 描紅模板中層
│   │   │   ├── <canvas drawingCanvas>  用戶畫作頂層(mirror CSS)
│   │   │   └── <div virtualCursor>     指尖虛擬游標
│   │   └── 右:Control Panel
│   │       ├── 模板選擇 (5 個)
│   │       ├── 顏色選擇 (5 + rainbow + eraser)
│   │       └── 筆觸大小 (3 檔)
│   ├── <footer>     私隱聲明
│   └── <script>     全部邏輯 (8 個 section,見下)
```

**8 個 JS section**:

| § | 名 | 行 | 移植難度 |
|---|---|---|---|
| 1 | Web Audio 引擎 (`playTone` + 4 個 wrapper) | 178-212 | ⭐ trivial |
| 2 | Global state(`let lastX/Y/isDrawingMouse/...`)| 214-238 | ⭐⭐ hoist 到 Zustand |
| 3 | Init + `initDrawCanvas` + webcam control | 240-262 | ⭐ trivial |
| 4 | 畫筆控制器(顏色/rainbow/eraser/粗細)| 264-328 | ⭐⭐ 拆 component |
| 5 | 描紅模板(4 種形狀 + 數字)| 330-385 | ⭐⭐ 拆 component + data 化 |
| 6 | 存檔下載(`saveArtwork` 合併 + 鏡像翻轉)| 387-416 | ⭐⭐⭐ Canvas 鏡像 flip 要 audit |
| 7 | 滑鼠/觸控 fallback(`setupMouseAndTouchEvents`)| 418-503 | ⭐⭐ 拆 hook |
| 8 | MediaPipe AI 追蹤(`onResults` + Hands + Camera)| 538-652 | ⭐⭐⭐⭐ 拆 hook + effect 管理 |

**已 ship 嘅 fix(由 source 內 BUG 標記推斷)**:
- BUG 1: `beforeunload` 停鏡頭(綠燈卡住 + 私隱)— line 642
- BUG 10: CDN 失敗顯示錯誤 — line 513
- 指尖游標定位精度 — line 565

---

## 3. 目標架構(React 化後)

```
air-drawing/
├── index.html                       (Vite 入口,空殼)
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts               (v4)
├── postcss.config.js
├── public/
│   └── (空,留位)
├── src/
│   ├── main.tsx                     (ReactDOM.createRoot)
│   ├── App.tsx                      (layout shell)
│   ├── index.css                    (Tailwind directives + .mirror utility)
│   │
│   ├── components/
│   │   ├── HeaderBar.tsx            (status indicator + gesture tip)
│   │   ├── CameraStack.tsx          (組合 4 層 canvas/video)
│   │   ├── DrawingCanvas.tsx        (核心畫圖,封裝 ctx + smoothing)
│   │   ├── TemplateLayer.tsx        (隱藏 canvas,描紅模板)
│   │   ├── VirtualCursor.tsx        (指尖追蹤點)
│   │   ├── TemplatePicker.tsx       (右欄 §5)
│   │   ├── ColorPalette.tsx         (右欄 §4 顏色 + rainbow + eraser)
│   │   ├── BrushSize.tsx            (右欄 §4 粗細)
│   │   ├── ControlPanel.tsx         (右欄 layout wrapper)
│   │   └── SaveButton.tsx           (§6 存檔)
│   │
│   ├── hooks/
│   │   ├── useAudioEngine.ts        (§1 4 個 sound effect)
│   │   ├── useWebcam.ts             (getUserMedia + 5s timeout fallback)
│   │   ├── useHandTracker.ts        (MediaPipe Hands + Camera util)
│   │   ├── useDrawingPointer.ts     (統一滑鼠/觸控/AI 手指三種 input source)
│   │   └── useArtworkExport.ts      (§6 合併 + 下載)
│   │
│   ├── store/
│   │   └── drawingStore.ts          (Zustand: brush/eraser/rainbow/size/template)
│   │
│   ├── lib/
│   │   ├── audio.ts                 (純函數,playTone)
│   │   ├── canvas.ts                (drawStart/drawMove + smoothing)
│   │   ├── templates.ts             (4 種 template definition)
│   │   └── export.ts                (合併 canvas + toDataURL)
│   │
│   ├── types/
│   │   └── index.ts                 (TemplateType, BrushState, etc.)
│   │
│   └── constants.ts                 (顏色、尺寸、CDN URL if any)
│
└── PLAN.md / ROADMAP.md / README.md
```

**架構重點**:
1. **Store 邊界**:Zustand 只管 UI state(brush color/size/mode/template),**唔管** drawing strokes(嗰啲係 imperative Canvas,留喺 ref)
2. **Hook 邊界**:`useDrawingPointer` 統一 3 種 input source(滑鼠/觸控/MediaPipe),`DrawingCanvas` 唔使 care 來源
3. **Canvas imperative 區**:Canvas 2D API 係 imperative,React 唔好勉強 declarative。`useRef` + `useEffect` 控制 ctx,`Zustand` 只 sync 設定值。

---

## 4. 6 階段路線(PWA 加 Phase 4b)

### Phase 1 — Vite scaffold + 單 component 跑通(1 個 component)
**目標**: 證明 stack 行得通 + 跨裝置 baseline
- `npm create vite@latest` (React 19 + TS)
- 把現有 `index.html` 嘅 `<body>` 整段剪入 `App.tsx`,**唔拆 component**
- 把 `<script>` 整段剪入 `App.tsx` 嘅 `useEffect`,window-level `let` 改 component-level
- CDN 照用(暫時),確認鏡頭 + MediaPipe + 畫圖邏輯全部 work
- **跨裝置 baseline**:
  - `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">`
  - canvas / video 加 `touch-action: none`
  - `height: 100dvh` 取代 `100vh`(iOS dynamic toolbar)
  - `matchMedia('(pointer: coarse)')` 偵測,set `data-input-mode="touch"` / `"mouse"` 喺 `<html>`
  - 橫向 / 直向 + desktop resize audit
- **Acceptance**:
  - **iPad**:Safari(實機或 simulator) 鏡頭+觸控+畫圖 work,橫/直切換唔破 layout
  - **Notebook**:Chrome / Edge / Firefox 鏡頭+滑鼠+畫圖 work,resize 1024↔1920 唔破 layout
  - 兩 device 都:`npm run dev` 鏡頭+畫圖+存檔 work
- **LoC budget**: 250 行內(net add,因 cross-device baseline)

### Phase 2 — 拆 `<DrawingCanvas>`(核心 1 個 component)
**目標**: 隔離 imperative Canvas 邏輯
- 新 `src/lib/canvas.ts`(drawStart / drawMove / smoothing)
- 新 `src/components/DrawingCanvas.tsx`(useRef + useEffect 接管 ctx)
- 把 §7(滑鼠/觸控)同 §8(MediaPipe)嘅 *drawing 副作用* 收埋入 component
- **Acceptance**: `<App>` 入面只有 `<DrawingCanvas />`,行為 1:1
- **LoC budget**: 350 行內(包含新檔)

### Phase 3 — 拆右欄 control panel(4 個 component) + 鍵盤 hotkey
**目標**: UI component 化 + notebook 鍵盤 hotkey
- `<TemplatePicker>` + `<ColorPalette>` + `<BrushSize>` + `<SaveButton>`
- 新 Zustand store,管 brush/eraser/rainbow/size/template
- 把 §4 嘅 UI 反饋邏輯(classList toggle)收埋入各 component
- 新 `<KeyboardShortcuts>` listener(notebook only):
  - `Ctrl/Cmd + Z` 撤銷(source 冇呢個功能,做嘅話要加 stroke history stack — Phase 3 範圍?)
  - `Delete` / `Backspace` 全部擦除
  - `S` 存檔
  - `1`-`5` 切模板
  - `E` 切橡皮擦
  - `R` 切 rainbow
  - `[` / `]` 調粗細
  - Scope:`pointer: fine + hover: hover` only(iPad disable)
- iPad 直向(834w)右欄變 bottom sheet / drawer
- **Acceptance**:
  - **iPad**:橫向 layout = 源,直向 panel 入 drawer
  - **Notebook**:每個 hotkey 有效 + 不喺 input field 觸發 + hover 高亮 + focus ring
  - 4 個 component,每檔 < 80 行
- **LoC budget**: 700 行內

### Phase 4 — Tailwind v4 + 統一 cleanup
**目標**: 取代 CDN,統一 styling
- Tailwind v4 取代 CDN(via `@tailwindcss/vite` plugin)
- 移除 `https://cdn.tailwindcss.com` CDN
- 共用 color/size 常數
- 移除 `mix-blend` smell、補 React 19 `useEffect` cleanup
- **Acceptance**: 0 個 CDN,`npm run build` 純本地產物
- **LoC budget**: 700 行內

### Phase 4b — Universal PWA(iPad + Notebook)
**目標**: 兩種 device 都做到「免安裝」native-feel app
- 裝 `vite-plugin-pwa`(Workbox 底層)
- 新 `public/manifest.webmanifest`:
  - `name: "AI 魔法空中畫筆"`
  - `short_name: "魔法畫筆"`
  - `start_url: "/"`
  - `display: "standalone"`
  - `background_color: "#0f172a"`(slate-900)
  - `theme_color: "#f59e0b"`(amber-500)
  - `orientation: "any"`(iPad 橫/直都 work,notebook 都 any)
  - icons: 192×192 + 512×512 + **maskable** 512×512(iOS 圓角自適應)
- 新 `public/apple-touch-icon.png` (180×180,iOS legacy 仍讀呢個)
- 新 `public/icon-192.png` + `icon-512.png` + `icon-maskable-512.png`
- `index.html` 加 `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` + manifest link
- Service worker:
  - precache 所有 build 產物(html / css / js / icons)
  - runtime cache: MediaPipe wasm + 模型檔案
  - strategy:`generateSW`(默認)+ `injectManifest`(進階可選)
- 雙 install prompt UX:
  - **iPad**:custom in-app banner「點下面分享 → 加到主畫面」,偵測 `navigator.standalone` 隱藏 banner
  - **Chrome/Edge notebook**:`beforeinstallprompt` event → system banner + fallback 文字
  - **Firefox / Safari notebook**:hidden(只 bookmark)
- **Acceptance**:
  - **iPad**:Safari 開網址 → 「加入主畫面」 → icon 出現 → 點開係全螢幕冇 Safari chrome
  - **iPad**:離線 reload 仍能 launch,空 cache 仍 work
  - **iPad**:鏡頭 + MediaPipe 喺 PWA 模式仍 work
  - **Notebook Chrome / Edge**:網址 bar 右邊出現 install icon → 裝成 standalone window
  - **Notebook**:鏡頭 + MediaPipe 喺 standalone mode 仍 work
  - 兩 device 都:0 個外連 CDN
- **LoC budget**: 950 行內

### Phase 5 — Audio + Export 模組化 + 測試
**目標**: 純函數化,加最小測試
- §1 Web Audio 抽 `lib/audio.ts`
- §6 Export 抽 `lib/export.ts`
- Vitest 覆蓋 `lib/canvas.ts` smoothing + `lib/export.ts` flip
- **Acceptance**: `lib/` 下 4 檔有 unit test,跑 `npm test` 全綠

### Phase 6(可選)— Tauri 2 桌面版
- 等用戶確認要離線再用

---

## 5. 風險表

| # | 風險 | 等級 | Phase | 緩解 |
|---|---|---|---|---|
| R1 | MediaPipe Hands `locateFile` 仍需 CDN 路徑 | 🟡 中 | 1,4,4b | 用 `@mediapipe/tasks-vision` 取代(本地 wasm),或保留 CDN 加 fallback |
| R2 | Canvas mirror `scaleX(-1)` 影響 export 座標 | 🟡 中 | 2,5 | export 時用 `ctx.scale(-1,1)` flip(已喺 source §6 處理),unit test 鎖住 |
| R3 | 滑鼠/觸控 + MediaPipe 3 種 input 同時 active | 🟠 高 | 2 | `useDrawingPointer` 統一 mutex,鏡頭 active 時 disable mouse event |
| R4 | Zustand subscribe 導致 canvas 重繪 storm | 🟡 中 | 3 | 畫筆設定用 `getState()` 而非 `subscribe`,只 ref sync |
| R5 | `useEffect` 內建 Camera/Hands 實例,re-mount 漏 cleanup | 🟠 高 | 2 | mount-time side effect 用 module-level `Set` keyed guard(memory rule 10) |
| R6 | Source 嗰個 5s `webcamTimeoutId` 自我 clear 係 dead code | 🟢 低 | 1 | 改用 `useRef` 保留 timeout id,cleanup 時 abort |
| R7 | Tailwind v4 動態 class(`ring-red-500/30`)safelist 漏 | 🟢 低 | 4 | safelist 包 5 個顏色 ring |
| R8 | `playTone` 用 `audioCtx` singleton,React StrictMode 雙 mount | 🟡 中 | 5 | AudioContext 放 module-level,而非 component state |
| R9 | 描紅模板 font 36px 喺 1280px 螢幕太細 | 🟢 低 | 3 | 按 canvas 640x480 鎖死,等比縮放用 transform |
| R10 | MediaPipe 鏡頭 + React effect 雙重啟動,綠燈卡住 | 🟠 高 | 1,2 | BUG 1 fix 保留,加 effect cleanup + AbortController |
| **R11** | **iPad Safari 100vh 跳動(dynamic toolbar)** | 🟠 高 | 1 | 100dvh + viewport-fit=cover + safe-area-inset |
| **R12** | **iOS PWA 鏡頭權限 active engage 要求** | 🟠 高 | 1,4b | 必須 click / touch 觸發 `getUserMedia`,唔好喺 useEffect auto call |
| **R13** | **iPad 後置鏡頭方向 4:3 vs 16:9 + mirror** | 🟡 中 | 1,2 | `facingMode: 'environment'` + canvas 鎖 4:3 + object-cover |
| **R14** | **PWA 鏡頭喺 background 時被 iOS suspend** | 🟠 高 | 4b | page visibility API 監聽,resume 時 re-init Camera |
| **R15** | **Service worker precache 同鏡頭 CSP 衝突** | 🟡 中 | 4b | CSP `media-src blob:` + `img-src 'self' data: blob:` |
| **R16** | **MediaPipe wasm 喺 iPad Safari 慢/唔 work** | 🟡 中 | 1,4b | 測試時 fallback `modelComplexity: 0`,鏡頭降 480p |
| **R17** | **iOS keyboard 彈出時 viewport 縮放** | 🟢 低 | 1 | 鎖 `user-scalable=no`,input 全部 button(本 app 冇 text input) |
| **R18** | **Notebook 滑鼠 hover state 期待 vs iPad 冇 hover** | 🟡 中 | 1,3 | Tailwind `md:hover:` prefix + `focus-visible:` ring + `:active` scale |
| **R19** | **Notebook 鍵盤 hotkey 喺 iPad 誤觸(藍牙鍵盤)** | 🟢 低 | 3 | scope guard `pointer: fine + hover: hover` |
| **R20** | **Notebook resize 1024↔1920 panel 切換** | 🟡 中 | 1,3 | Tailwind `lg:` breakpoint + drawer 動畫 |
| **R21** | **Desktop Chrome PWA install prompt 唔彈** | 🟡 中 | 4b | manifest + SW + 1 次 engagement 先 fire,做 onboarding 確保 user click 過按鈕 |
| **R22** | **Notebook 滑鼠 + 觸控板 兩指 gesture 同時 active** | 🟢 低 | 1 | `useDrawingPointer` 內部鎖 single source(`pointerdown` 1 個 pointer id) |
| **R23** | **MediaPipe Pose 喺 iPad 性能(雙手 33 keypoints)** | 🟠 高 | 2 | `modelComplexity: 0`、鏡頭降 480p、可關閉 Pose 只用 Hands |
| **R24** | **肢體動作 classifier 8 個動作混淆**(e.g. 雙手舉高 vs 拍手)| 🟠 高 | 3,5 | 動作定義要明確(坐姿 vs 站姿 / 距離鏡頭遠近)+ on-device 校準 step |
| **R25** | **Plutchik 8 嘅文化適配**(西方 8 emotions vs 中文 / 廣東話)| 🟡 中 | 3 | 提供 i18n strings + 預設中英對照,情緒順序不變 |
| **R26** | **學生情緒 label 可能錯誤(AI 判斷錯誤)** | 🟠 高 | 3 | 永遠俾學生 override(顯示「我覺得係 XXX,啱唔啱?」);唔做自動判斷總結 |
| **R27** | **智障學生私隱特別敏感(可能被識別為殘疾)** | 🟠 高 | 1,4b | profile 用亂數 ID(唔用真名)+ localStorage 加密 + 任何上傳 disable |
| **R28** | **PIN 鎖忘記 / 學生自助 lock-out** | 🟡 中 | 2 | 提供「老師 master reset」(file-based recovery code)|
| **R29** | **AAC mode(無鏡頭)用戶放棄** | 🟡 中 | 2 | 預設 AAC mode 喺 loading state,**唔好等到鏡頭 fail 先 fallback**(智障學生未必主動 click)|
| **R30** | **觸覺敏感(智障 / ASD 學生)** | 🟡 中 | 3 | 任何 hover / scale 動畫要 respect `prefers-reduced-motion`;聲音可關 |
| **R31** | **「今日感覺」prompt 變 routine(失去意義)** | 🟡 中 | 3 | 提示要隨機化、配合時間(朝早 vs 下晝)、可 skip |

---

## 6. Scope guard(2026-07-21 user unblock:可以加新 feature)

> **Status**: User 解禁 scope guard — 可以加新 feature,**前提係落 PLAN §11 評估過**。
> 呢個 section 仍然守住嘅底線:**架構性決定 / 私隱立場 / 開發體驗**。Feature scope 由 §11 管。

**仍然唔做嘅嘢**(架構 / 私隱底線):
- ❌ 唔做 Tauri 化(scope 外 — 但 user 可以主動要求,變 §11 候選)
- ❌ 唔做 Capacitor / Cordova(違反「免安裝」訴求)
- ❌ 唔做 App Store / TestFlight native 殼(同上)
- ❌ 唔換 gesture 演算法(source 嗰套食指+中指判定 OK)
- ❌ 唔做國際化(source zh-TW 維持,後續可 i18n)
- ❌ 唔做 SSR / Next.js(Vite 純 SPA 就夠)
- ❌ 唔加 React Router(單頁 app)
- ❌ 唔加任何後端(私隱立場 source 明確)
- ❌ 唔 import 任何 tracking / analytics SDK
- ❌ 唔做 Android / Windows PWA 優化(只 iPad Safari + 主流 desktop browser)

**新 feature 入 plan 嘅流程**(取代舊「唔加新 feature」):
1. User 提議 / Mavis 提議 → 落 §11 Feature Backlog
2. 三軸評估:**User value**(對 SEN 教育 / 2B niche 嘅實質助益) × **Tech cost**(LoC + phase 影響) × **PWA / iPad 兼容性**
3. User 揀 wave 收落 plan / 擱置 / drop
4. 揀咗嗰啲先加 phase + acceptance criteria

---

## 6.5 跨裝置 PWA 部署要求

**部署目標**: HTTPS 靜態 host(用戶自選),**iPad Safari 訪問後 Add to Home Screen 即可,notebook Chrome/Edge 訪問後 install banner 即可**。

**必要 hosting 屬性**:
- HTTPS 強制(鏡頭權限要求,localhost 例外)
- `Content-Security-Policy: default-src 'self'; media-src 'self' blob:; img-src 'self' data: blob:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cdn.jsdelivr.net`(最後一項只 Phase 1 暫時,Phase 4b 歸零)
- `X-Content-Type-Options: nosniff`
- Service worker scope 必須係 `/`(唔可以係 `/subpath/`)
- `Permissions-Policy: camera=(self), microphone=()`(iPad Chrome 都 honor)

**部署選擇**(推薦順序):
1. **Cloudflare Pages** — 免費、HTTPS 自動、PR preview、custom domain,**首選**
2. **Vercel** — 免費 tier、Vite 默認 support
3. **Netlify** — 免費 tier、簡單 `netlify deploy`
4. **GitHub Pages** — 免費但 user 須自行加 HTTPS(通常已有)
5. **自托管 NAS / Pi** — 適合學校內網,PWA + HTTPS cert(Let's Encrypt)即可

**iOS PWA 限制(必讀,2026-07 仍生效)**:
- iOS 16.4+ 支援完整 `Web App Manifest`(2023-03)
- iOS 16.4 之前:fallback 為「加到主畫面 bookmark」,**冇** standalone mode
- iOS 17+ 支援 Web Push(本 app 唔需要)
- iOS PWA storage limit 從 50MB 開始(iOS 17.4+ 解封,但仍受瀏覽器策略影響)
- iOS PWA 鏡頭權限 = Safari 鏡頭權限,用戶可喺 Settings → Safari → Camera 撤回

**Desktop PWA 限制**:
- Chrome / Edge:`beforeinstallprompt` 觸發 install banner(已落地條件:有 SW + manifest + 至少 1 user engagement)
- Firefox:2026 仍**冇** desktop PWA install UX,只 bookmark
- Safari macOS:**冇** desktop PWA UX,只「Add to Dock」(2026 macOS Sonoma+,部分支援)

**PWA vs Native App 取捨**:
| 項 | PWA(iPad + Notebook) | Native App Store |
|---|---|---|
| 安裝 | Add to Home Screen / install banner(2 click) | TestFlight + App Store review(2-4 週) |
| 鏡頭權限 | ✅ 標準 Web API | ✅ 同 |
| 離線 | ✅ Service worker | ✅ |
| Bundle size | ~2-5 MB | ~30 MB+(Xcode 編譯) |
| Push notification | iOS 16.4+ 有限 / Desktop 部分 | ✅ 完整 |
| 後台鏡頭 | ❌ iOS suspend / Desktop suspend | ✅(需 entitlement) |
| 私隱立場 | ✅ 100% client-side | ✅(但要 trust App Store) |
| 維護成本 | ✅ Web 單一代碼base | ❌ iOS + Android 兩份 |
| 跨裝置 sync | ❌(本 app scope 外) | ✅ iCloud |

**本 app 結論**:PWA 完全足夠。鏡頭、畫圖、存檔全部 client-side,Push / 後台 / In-App Purchase / iCloud sync 都唔需要。**App Store 路線違反用戶「免安裝」訴求,排除**。

---



---

## 7. 成功指標(Definition of Done)

| Phase | DoD |
|---|---|
| 1 | `npm run dev` 起,**Mode entry router(F24) + 3 個 mode UI shell(weak/mid/high,各 ~50 LoC) + AAC default + iPad Safari 觸控 + Notebook desktop layout 通過** |
| 2 | **3 個 mode shell 各自行為 1:1 + finger dwell-click(weak)+ Plutchik 8 emotion constants + 多 profile(亂數 ID) + PIN 鎖 + TTS service + 「今日感覺」** |
| 3 | **Weak mode**:8 chip + animation + TTS + emotion log。**Mid mode**:動作 classifier + pose prompt + 動作 log。**High mode**:Plutchik 8 情緒卡 dock + 情緒畫筆 mode + 今日感覺 prompt + 情緒 vocabulary 教學 mode + Undo/Redo + 情緒日記(project) + 情緒顏色記憶遊戲 + 印章(情緒符號),iPad 直向 drawer + notebook 鍵盤 hotkey |
| 4 | 0 CDN,`npm run build` 純本地產物 |
| 4b | **iPad Add to Home Screen + Notebook Chrome/Edge install banner,兩 device PWA 全螢幕啟動,離線可用,智障學生私隱保護(亂數 ID / 加密 / 0 上傳)驗證** |
| 5 | `lib/` 全 unit test 綠,coverage > 70%,含 pointer 統一測試 + 情緒 classifier 測試 + **finger dwell-click 測試** + **TTS 服務 mock 測試** + Plutchik 8 i18n 測試 |
| 6(可選)| Tauri app 可 launch |

**最終 source 終態**:
- v5.0.0 取代 v3.0 source(由 single-file → modular + **3-tier 難度模式 + non-verbal 表達輔具**)
- 原本 `index.html` 保留喺 `archive/index.html`(reference)
- `CHANGELOG.md` 標明 v3.0 → v5.0 嘅 stack + 定位 + accessibility 3-tier 變更
- 私隱聲明保留 + 加強(智障學生保護,亂數 ID,全本地)

---

## 8. 記憶 rule check(交叉驗證)

- Memory rule 5(senior-engineer audit gates):>100 LoC 必 10min mini-audit — 每 phase 後跑
- Memory rule 10(session-scoped idempotency guard):useEffect mount 必加 module-level Set keyed guard
- Memory rule 11(single-file HTML `</script>` trap):Phase 1 之前確認,Phase 1 之後 Vite 自動避開
- Memory rule 13(5-bug-family check):每 phase ship 前跑 F1-F5
  - F1(default-state desync):Zustand persist + 初始 render 對齊
  - F2(reset-on-render):canvas clear 喺 mode change 時
  - F3(enable-condition off-by-concept):eraser/rainbow button 互斥
  - F4(silent data loss):export 合併 layer 順序鎖死
  - F5(dead code via name collision):清掉 source 嗰個 `clearTimeout` 自我 clear

---

## 9. 下一步

等 user review 呢個 plan → 確認 / 改方向 → Phase 1 動工

**Phase 1 動工前必備**:
- 確認 Vite + React 19 + TS template(目前 React 19 stable,2025-12 出咗)
- 確認 `@mediapipe/tasks-vision` 仍維護(或保留 `@mediapipe/hands` v0.4.x)
- 確認 Tailwind v4 穩定度(2025-12 1.0 released,可用)

---

## 10. Reference sites(同類 / 競品觀察)

> 純 reference,**唔代表 fork 或借 code**。只係觀察 UX、tech、business model 等層面,等 fork 過程有對標對象。
> 用戶主動提及嘅 URL 會收埋入呢度,順手記低對我哋 plan 嘅啟發。

### 10.1 [Active Arcade](https://www.activearcade.ai)(2026-07-21 reference)

**定位**: 「Nex is a motion-based entertainment company that is transforming activity into play」 — 由 NEX Team Inc. 經營,Squarespace marketing site(2022 截圖內容),主站似乎已 archive,後續可能併入 [nex.inc](https://www.nex.inc)。

**觀察重點**:
- **Business model**:娛樂 / 健身混合,**2C consumer**(家用體感遊戲機)
- **Tech 線索**:Squarespace marketing site(非 PWA,純靜態),產品本身已 hard to find(2022 截圖)
- **同我哋 air drawing fork 嘅對比**:

| 維度 | Active Arcade | Air Drawing (我哋) |
|---|---|---|
| 目標用戶 | 2C 家用 | 2B 特殊教育 / 教室 |
| 互動方式 | 全肢體動作遊戲 | 單手食指 / 觸控 畫畫 |
| 部署 | 似乎 desktop hardware(可能 Windows app)| **PWA iPad / Notebook,純 client-side** |
| 私隱立場 | 商業產品(可能有 telemetry) | **完全本地**,源碼 footer 明示零外流 |
| 模式 | 遊戲化(計分 / 過關) | 教育化(描紅 / 形狀 / 數字) |
| 安裝 | 硬件 / 軟件二選一 | **免安裝 PWA** |

**啟發(僅 reference,唔抄)**:
1. **Motion-based 市場存在**:Active Arcade 2022 前用 marketing site 推,證明「體感 + Web」有 2C 興趣。我哋 2B 教育市場更穩定
2. **私隱係賣點**:Active Arcade 從未公開強調「零外流」。我哋 fork 後應保留 footer 私隱聲明,呢個係**對標 niche 差異化**
3. **PWA 對 desktop hardware 嘅替代價值**:Active Arcade 似乎要走硬件(sensor + TV),我哋 PWA 路線成本接近零,教育市場更易落地
4. **Marketing site 簡單即夠**:Active Arcade marketing site 都係 Squarespace,證明早期 marketing 唔需要複雜 stack。我哋 Phase 4b 部署後甚至可以同樣用 Cloudflare Pages 靜態 host

**不採用嘅嘢**:
- 唔做體感全身偵測(超出 MediaPipe Hands 範圍,MVP 過複雜)
- 唔做硬件配套(違背免安裝訴求)
- 唔做計分 / 排行榜(超出源 app scope,source 冇)

**冇拿到嘅資料**(待 user 提供更多):
- 官網真正嘅 demo / 試玩(現 marketing site 似乎停咗)
- 商業模式細節(硬件售價 / 訂閱)
- AI model 選擇(MediaPipe? TensorFlow.js? 自家?)

**Status**: reference-only,monitoring

---

### 10.2 Proloquo2Go / TouchChat(iOS AAC app 對標)(2026-07-21 reference)

**Proloquo2Go**:AssistiveWare 出嘅 iOS AAC app,香港 / 國際 SEN 界 standard 之一,功能:
- 動態 / 靜態 communication board
- 8 個 / 9 個 / 16 個 per page grid(類似我哋 weak mode 嘅 8 chip)
- TTS 內建(類似我哋 E18)
- 多 user profile(類似我哋 E6)
- Type to talk / 詞彙預測
- Symbol library(類似我哋 Plutchik 8 emoji)

**TouchChat**:A PRC 出,iPad / iPhone AAC app,類似 Proloquo2Go。

**觀察重點**(對我哋 weak / mid mode 嘅 UX 啟發):
1. **Grid size** — Proloquo2Go 預設 9 grid(3×3),TouchChat 預設 4 / 8 / 16。我哋 8 個 Plutchik 情緒 → **3×3 grid,1 格空白或者「我冇感覺」**
2. **TTS 速度** — 預設 normal,家長 / 老師可調慢
3. **Tap target** — 必須 ≥ 100×100pt(iPad standard),SEN app 標準甚至 200×200pt(我哋嘅 250×250 啱)
4. **多 page 詞彙** — 1 page 唔夠 → 1 level 多 page(情緒 / 動作 / 人物 / 食物)
5. **Visual scene** — 智障學生未必讀到字 → 純 emoji + image(我哋已 default)
6. **Core word + fringe vocabulary** — 核心詞 vs 個人化詞彙(我哋 profile 系統可加 fringe)

**我哋唔採用嘅嘢**:
- Proloquo2Go 嘅 symbol library 過萬個(超出 MVP scope,我哋 Wave 1 集中 8 個 Plutchik)
- 詞彙預測 ML(超出 MVP)
- Type to talk(智障學生未必識打字)

**對 plan 嘅影響**:
- Phase 1 chip 尺寸要 ≥ 200×200pt(SEN 友善)
- 3×3 grid 排版(8 chip + 1 「跳過」/ 「其他」)
- TTS 速度可調(0.5x / 1x / 1.5x)— 加 Phase 2 E18
- Wave 2 考慮加 **多 page 詞彙**(情緒 / 動作 / 需要)— 對齊 E19 圖卡模板
- Wave 2 考慮加 **Visual scene 模式**(整頁背景圖 + 點圖位置觸發)— 對齊 E16 共同構圖嘅 UX 變體

**冇拿到嘅資料**(待 user 提供更多):
- 兩個 app 嘅 UX detail 截圖
- AAC 教育研究 / 業界共識 standard
- 香港 SEN 班房嘅 AAC 工具使用習慣

**Status**: reference-only,monitoring

---

## 11. Feature Backlog(2026-07-21 PIVOT — 情緒 / 表達導向)

> ⚠️ **重大 pivot**:User 喺 2026-07-21 重新定位 project 為 **non-verbal 表達輔具**,
> 唔再係「AI 魔法空中畫筆」嘅純 clone。重心由「學畫畫」改為「學表達情緒」。
>
> 評估準則亦改:
> - **表達價值**(對 non-verbal / 智障 / ASD 學生嘅實質助益)— 取代舊「教育價值」
> - **溝通橋樑**(幫學生被理解 / 學會表達)— 取代舊「教學成效」
> - **情緒 vocabulary 增量**(Plutchik 8 覆蓋率)— 取代舊「功能豐富度」
> - **Tech cost** + **PWA / iPad compat** 維持

### 11.0 核心新能力(必須先講)

呢 3 個能力**先於任何 feature**,係 pivot 嘅基礎:

| 核心 | 描述 | Tech |
|---|---|---|
| **C1: Plutchik 8 emotion vocabulary** | 8 個情緒每個有 emoji + 中文 + 顏色綁定:😊 Joy / 😢 Sadness / 😠 Anger / 😨 Fear / 🤝 Trust / 🤢 Disgust / 😲 Surprise / 🤔 Anticipation | `constants/emotions.ts`(純 data)+ UI chip |
| **C2: 肢體動作 classifier** | MediaPipe Pose 偵測 6 個關鍵動作:雙手舉高(joy) / 雙手垂下(sadness) / 握拳(anger) / 雙手掩面(fear) / 擁抱姿勢(trust) / 退後(disgust) / 拍手(surprise) / 來回踱步(anticipation) | MediaPipe Pose + rule-based classifier(無需 ML) |
| **C3: 情緒畫筆** | 8 種顏色綁定 8 種情緒,揀色 = 揀情緒,畫 = 表達 | Canvas 擴展(已有 brush 系統) |

呢 3 個 core 唔係 feature,**係 pivot 嘅前提**。無咗 C1/C2/C3,呢個 app 同 source clone 冇分別。

### 11.1 候選 feature 列表(pivot 後重新排序)

| # | Feature | 表達價值 | 溝通橋樑 | Tech cost | PWA / iPad | 評估 |
|---|---|---|---|---|---|---|
| **E1** | **Plutchik 8 情緒卡(畫面右側 dock)** | 🟢 極高 | 🟢 極高 | 🟢 低(8 個 chip + state) | ✅ 全平台 | **必入 Wave 1**,pivot 核心 |
| **E2** | **肢體動作 → 情緒 mapping(MediaPipe Pose)** | 🟢 極高 | 🟢 極高 | 🟡 中(MediaPipe Pose + classifier) | ✅ 但 iPad 性能要 tune | **必入 Wave 1**,pivot 核心 |
| **E3** | **情緒畫筆 mode**(8 色綁 8 情緒)| 🟢 高 | 🟢 高 | 🟢 低(擴 brush state) | ✅ 全平台 | **必入 Wave 1**,pivot 核心 |
| **E4** | **「今日感覺」prompt**(每次開 app 問學生揀 1 個情緒)| 🟢 高 | 🟢 高 | 🟢 低(modal + persist) | ✅ 全平台 | **必入 Wave 1**,起步 ritual |
| **E5** | **情緒 vocabulary 教學模式**(鏡頭示範動作 → 學生跟做 → 配對情緒)| 🟢 高 | 🟡 中 | 🟡 中(MediaPipe Pose + matching) | ✅ | **必入 Wave 1** |
| **E6** | **多 student profile(改名為「每個學生嘅情緒日記」)** | 🟢 高(原 F12) | 🟡 中 | 🟡 中(localStorage 加密) | ✅ | **必入 Wave 1**,私隱考慮升級 |
| **E7** | **老師 / 家長 PIN 鎖 + 觀察者模式** | 🟡 中(原 F18) | 🟡 中 | 🟢 低 | ✅ | **必入 Wave 1**,智障學生保護 |
| **E8** | **作品情緒標籤**(儲存時 bind 1 個 Plutchik 情緒)| 🟢 高 | 🟢 中 | 🟢 低 | ✅ | **必入 Wave 1**,作品有 metadata |
| **E9** | **多 project / 日記(改名為「情緒日記時序」)** | 🟡 中(原 F2) | 🟡 中 | 🟡 中(IndexedDB) | ✅ | **必入 Wave 1**,時間軸 |
| **E10** | **Undo / Redo** | 🟡 中(原 F1) | 🟢 中 | 🟡 中(stroke stack) | ✅ | **Wave 1** |
| **E11** | **情緒顏色記憶遊戲**(展示情緒 → 學生用情緒色畫)| 🟢 高 | 🟡 中 | 🟡 中 | ✅ | **Wave 1** |
| E12 | **肢體動作品牌卡**(8 個動作印出嚟做 PECS flashcard) | 🟢 高 | 🟢 中 | 🟢 低(PDF/PNG export) | ✅ | **Wave 2**(export 鏈接) |
| E13 | **情緒時序圖**(全班學生情緒 trend,老師 dashboard) | 🟢 高 | 🟢 高 | 🟠 高(全班 data) | ✅ | **Wave 2** |
| E14 | **背景音樂 / 環境音**(calm / energetic switch) | 🟡 中(原 F5) | 🟢 中 | 🟢 低 | ✅ | **Wave 2** |
| E15 | **多手指 / 雙手一齊動作** | 🟡 中(原 F9) | 🟡 中 | 🟠 高 | ✅ 但性能 | **Wave 2** |
| E16 | **共同構圖 mode**(老師 + 學生輪流 add stroke,turn-taking) | 🟢 極高 | 🟢 極高 | 🟠 高(turn queue + presence) | ✅ 但需 UX work | **Wave 3**(超出 MVP) |
| E17 | **AI 情緒辨識 / 評分**(學生畫面 + 動作 → AI 評估情緒 vocabulary) | 🟢 高 | 🟡 中 | 🔴 非常高(onnx 訓練) | ✅ 但 model 落 device | **Wave 3 / 重新評估** |
| E18 | **語音 prompt(TTS 讀出情緒名)** | 🟢 高(non-verbal 學生未必讀到字) | 🟢 高 | 🟢 低(Web Speech API) | ✅ | **Wave 2** |
| E19 | **中文字 / 圖卡模板**(原 F4,改名表達卡) | 🟡 中 | 🟡 中 | 🟡 中 | ✅ | **Wave 2** |
| E20 | **印章 / 貼紙 = 情緒符號** | 🟢 高(原 F15) | 🟡 中 | 🟢 低 | ✅ | **Wave 1**(E11 子集) |
| E21 | **家長 / 老師 email 報告(本地 export)** | 🟡 中 | 🟢 中 | 🟢 低(PDF / email 觸發) | ✅ | **Wave 2** |
| E22 | **AAC 模式開關**(全 keyboard-based 互動,無鏡頭 fallback) | 🟢 高(智障學生未必用鏡頭) | 🟢 中 | 🟡 中 | ✅ | **Wave 1**(inclusivity) |

### 11.2 Wave 嘅定義(pivot 後)

- **Wave 1 (MVP+,必加,11 個)**:E1, E2, E3, E4, E5, E6, E7, E8, E9, E10, E11, E20, E22 + 3 個 Core(C1/C2/C3)+ 原 source 100% 行為 — Phase 1-4 期間收埋
- **Wave 2 (Post-MVP,7 個)**:E12, E13, E14, E15, E18, E19, E21 — Phase 5 之後 / v4.1
- **Wave 3 (重大 / 重新評估,2 個)**:E16 共同構圖, E17 AI 評分 — 需架構 / UX 大改,先要 user 重新 commit
- **Drop(已剔除 / 由其他取代)**:
  - F3 音效豐富 → 留 Wave 2 E14
  - F4 中文字描紅 → 變 E19 表達卡
  - F6 觸覺 → 唔做(智障學生可能觸覺敏感,**反而有害**)
  - F7 Web Share → 留 Wave 2 級別嘅 E21
  - F8 錄影 export → 變 E12 動作卡 export
  - F10 協作白板 → 變 Wave 3 E16(turn-taking 版本)
  - F11 形狀辨識 → 變 Wave 3 E17
  - F13 作品時光機 → 變 E9 日記時序
  - F14 離線 sync → 仍 out of scope(架構)
  - F16 範例畫廊 → 變 Wave 2 級別
  - F17 AirPlay → 唔做(私隱 + 智障學生未必需要)
  - F18 密碼鎖 → 升級做 E7(智障學生保護考量)

### 11.3 Wave 1 嘅 11 個 feature 估算

| 項 | 估 LoC | Phase 影響 |
|---|---|---|
| C1 Plutchik 8 constants + UI | +50 | Phase 3 |
| C2 MediaPipe Pose + classifier | +400 | Phase 2(加 Pose)+ Phase 3(加 emotion mapping) |
| C3 情緒畫筆 mode | +150 | Phase 3(brush state 擴) |
| E1 情緒卡 dock | +100 | Phase 3 |
| E3 情緒畫筆 implementation | (已包 C3) | Phase 3 |
| E4 今日感覺 prompt | +80 | Phase 2(modal) |
| E5 情緒 vocabulary 教學 mode | +200 | Phase 3 |
| E6 多 profile(改名 + 加密) | +250 | Phase 2-3 |
| E7 PIN 鎖 + 觀察者模式 | +150 | Phase 2(lock overlay)+ Phase 3(observer mode) |
| E8 作品情緒標籤 | +80 | Phase 3(metadata) |
| E9 多 project / 情緒日記 | +200 | Phase 2-3(IndexedDB) |
| E10 Undo / Redo | +300 | Phase 3(stroke stack) |
| E11 情緒顏色記憶遊戲 | +250 | Phase 3 |
| E20 印章 = 情緒符號 | +100 | Phase 3(sticker layer) |
| E22 AAC mode(無鏡頭) | +200 | Phase 2(UI 替代) |
| **Wave 1 合計** | **~2500 LoC** | Phase 1-4 |

### 11.4 點決定入 wave 1?

**揀選原則**(pivot 後):
1. **直接服務 non-verbal 表達** — 唔再為「好玩的 UX」
2. **情緒 vocabulary 覆蓋** — 8 個 Plutchik 都要有對應互動
3. **老師可見 / 可評估** — 作品 + profile + 情緒標籤全部要可見
4. **私隱優先** — 智障學生保護(PIN / 本地 / 加密)
5. **inclusivity** — 鏡頭 fallback(AAC mode)、觸覺敏感顧慮

**Mavis 推薦入 Wave 1**:11 個 feature 全部(理由如上)

**唔建議入 wave 1**:
- E13 情緒時序圖 — 全班 data 需架構(可後做)
- E16 共同構圖 — turn-taking UX 複雜(可後做)
- E17 AI 評分 — onnx 訓練成本(可後做)

### 11.5 用戶確認機制(沿用)

- Mavis 提議 → User 確認 / 改 / drop
- 加咗嘅先 phase-ize(每個加 acceptance + risk)
- 唔入 wave 1 嘅先留 backlog,**唔 block 開工**

---

## 12. Accessibility Levels(2026-07-21 v2.0 新增)

> **3 個難度模式 = 3 個 UI 變體,共享同一個 emotion data + profile system + storage**。
> 唔係 3 個獨立 app,係 1 個 app 內 3 個 mode entry point。

### 12.1 三模式對比

| 維度 | 🟢 弱(Low) | 🟡 中(Mid) | 🔴 強(High) |
|---|---|---|---|
| **對應學生** | 不懂 / 不能做肢體動作 | 能做簡單動作 | 能做複雜表達 |
| **輸入** | **cam trace 手指 click chip**(新 UX) | **cam trace 肢體動作 trigger 情緒** | cam / 觸控 / 滑鼠(原 v1.0)|
| **主畫面** | 8 個 Plutchik emoji chip(全屏)| 鏡頭 + 動作提示(overlay) | 鏡頭 + canvas + 工具列(v1.0) |
| **觸發機制** | 手指 click → chip 有 **animation + TTS 語音** | 做動作 → 動作 match → chip 高亮 + 語音 | 自由表達 |
| **TTS** | ✅ 必備(讀出情緒名)| ✅ 觸發時 | 選用 |
| **Animation** | chip hover/click 有 bounce / scale | 動作 match 時 chip 彈出 | 自由 |
| **畫畫能力** | 簡單(每 chip 點擊 = 印 1 個 emoji stamp)| 動作 match 完可畫 | 完整情緒畫筆 + Undo + Project |
| **Profile 設定** | 老師預設,學生只揀 | 老師預設,學生做動作 | 學生可自訂 |
| **Time on task** | 1-3 分鐘一輪 | 3-5 分鐘一輪 | 自由 |
| **評估指標** | 學生揀邊個 chip 多少次(per profile) | 動作 match 成功率 | 自由作品(儲存 + 標籤) |

### 12.2 「Cam trace 學生手指 click chip」嘅 Tech 拆解(🟢 弱模式)

呢個係 **全新嘅 UX**,plan 之前冇涵蓋。Tech 拆解:

| 步驟 | 描述 | Tech |
|---|---|---|
| 1. 鏡頭啟動 | `getUserMedia`,`facingMode: 'user'`(前置)| Phase 1 已包 |
| 2. Hand 偵測 | MediaPipe Hands 偵測 21 個 hand keypoint | Phase 2 已包 |
| 3. **指尖 hover 偵測** | 食指指尖(landmark 8)位置,convert 到 mon 座標,**每 frame 檢查**指尖係咪喺某個 DOM element 範圍內 | **新加** `useFingerHover.ts` |
| 4. **Click trigger** | 食指指尖**停留 > dwell_time** 喺 chip 範圍 = 視為 click(配合 hover scale 動畫)| **新加** dwell-click algorithm |
| 5. **Animation** | chip bounce / scale 1.0 → 1.2 → 1.0,TTS 讀「我覺得係快樂」| CSS transition + Web Speech API(`speechSynthesis`)|
| 6. **持久化** | 每次 click 寫入 profile 嘅 emotion log(IndexedDB)| Phase 2 E6 已包 |

**Dwell time 可調設定**(2026-07-21 user 確認):
- **預設**:0.5s
- **範圍**:0.3s - 1.0s(slider)
- **設定位置**:`<Settings>` 老師 mode(per profile 儲存)
- **UI 表示**:每次調整顯示「你將 dwell time 設為 X.X 秒,測試一下」,俾老師校準
- **預設建議**:
  - 智障 / ASD 學生 → 0.3s(快)
  - 一般學習遲緩 → 0.5s(平衡)
  - 肌肉控制較弱(怕誤觸)→ 0.8s(慢)
  - 0.3s 以下**唔建議**(誤觸率高)
  - 1.0s 以上**唔建議**(學生等不住)
- **Tech**:`useFingerHover` 接受 `dwellTimeMs` 參數,default `500`,用 Zustand 讀 profile 設定

**關鍵 UX 考量**:
- Dwell time 預設 0.5s — 用戶確認可調
- 食指 hover 時 chip 要有**視覺 affordance**(邊框 / scale),等學生知「click 緊」,**progress 動畫**(ring 由 0% 填到 100% 嘅 dwell 時間)更直觀
- 可關閉 dwell click(改返普通 mouse / touch click)— for iPad with finger(本身已是 click,唔需要 dwell)
- **鏡頭 miss 食指時**(離開畫面),fallback 返 mouse / touch click,**唔好 block 學生**
- **Dwell 完成** vs **dwell 中途手指飄走**:`pointerleave` / 飄出 chip 範圍 → cancel dwell + reset progress
- **Dwell 完成後短暫 cooldown**(0.3s)— 防止同一 click 重複 trigger

**Proloquo2Go / TouchChat 對標啟發**:
- chip 尺寸 ≥ 200×200pt(SEN 友善,iOS HIG + AAC 標準)— 我哋 250×250 啱
- 3×3 grid 排版(8 chip + 1 「跳過」/ 「其他」)
- 點擊反饋要**即時 + 強烈**(scale + color + TTS 三重 feedback)

### 12.3 「做動作 trigger 情緒」嘅 Tech 拆解(🟡 中模式)

| 步驟 | 描述 | Tech |
|---|---|---|
| 1. 鏡頭啟動 | 同上,`facingMode: 'user'` | Phase 1 |
| 2. Pose 偵測 | MediaPipe Pose,33 個 body keypoint | Phase 2 新加 |
| 3. 動作 classifier | **8 個 rule-based**(用戶確認)— 簡單 keypoint 角度 / 距離閾值 | Phase 2 新加 |
| 8 個動作 | Joy:雙手舉高(y4 < shoulder 且 wrist y < shoulder y) / Sadness:雙手垂下(wrist y > hip y) / Anger:握拳(指尖貼掌心) / Fear:雙手掩面(wrist 近 face) / Trust:擁抱姿勢(雙臂向前交叉) / Disgust:退後(身體 bbox 縮小) / Surprise:拍手(雙手快速接近) / Anticipation:來回踱步(多幀 x 變化) | `src/lib/poseClassifier.ts` |
| 4. **動作教學** | mon 顯示「請舉高雙手」+ 動作 preview(emoji + 簡圖)| **新加** `<PosePrompt>` overlay |
| 5. 動作 match | classifier 識別 + dwell 0.5s 才 confirm(防誤觸)| Phase 2 E5 已包 |
| 6. 觸發反饋 | chip 高亮 + TTS 語音 + 寫入 emotion log | 同上 |

**關鍵 UX 考量**:
- 動作要**坐姿 friendly**(智障學生未必企到)
- 動作要**有 fallback**(動作做唔到,click chip 仍 work)
- 動作要**可調較難度**(初始闊 threshold,後可收緊)— `classifierTolerance` setting

### 12.4 「高能力」v1.0 plan(🔴 強模式)

跟 v1.0 plan 唔變:
- 自由畫 / 情緒畫筆 / 表達 vocabulary
- Undo / Redo / 情緒日記 / 記憶遊戲
- iPad 直向 drawer / 鍵盤 hotkey
- 全部 feature ship

### 12.5 模式入口 UX 設計

```
┌──────────────────────────────────────────┐
│  🌟 你想用邊個模式?(學生揀)            │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │   🟢     │ │   🟡     │ │   🔴     │ │
│  │ 輕鬆模式 │ │ 中級模式 │ │ 進階模式 │ │
│  │          │ │          │ │          │ │
│  │ 揀 emoji │ │ 做動作   │ │ 自由畫   │ │
│  │ 手指 click│ │ trigger  │ │ 全部     │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                          │
│  📌 上次用:🟢 輕鬆模式(小明)            │
│                                          │
│  [👤 揀其他學生...]  [⚙️ 設定]            │
└──────────────────────────────────────────┘
```

**Detail 設計**:
- 大 chip(每個 ~250×250px tap target,符合 iPad 觸控 ≥44px + SEN 友善更大)— **參考 Proloquo2Go / TouchChat AAC 標準(≥200×200pt)**
- 模式選擇可被學生自己 click,或老師預設(per profile)
- 「上次用」自動 highlight,1 click 即入
- 「揾其他學生」→ profile switcher(E6)
- 「設定」→ 老師 mode,改 default 模式、PIN、classifier tolerance、dwell time 等
- 整個入口畫面**尊重 AAC 模式**:鏡頭 optional,只 mouse / touch click 都 work

**Plutchik 8 chip 排版**(對齊 Proloquo2Go 3×3 grid):
```
┌─────────┬─────────┬─────────┐
│   😊    │   😢    │   😠    │
│  開心   │  悲傷   │   嬲    │
├─────────┼─────────┼─────────┤
│   😨    │   🤝    │   🤢    │
│  驚    │   信    │  討厭   │
├─────────┼─────────┼─────────┤
│   😲    │   🤔    │   ⏭    │
│  驚喜   │  期待   │  跳過   │
└─────────┴─────────┴─────────┘
```
- **3×3 grid**(8 Plutchik + 1 「跳過」)
- 9 個 cell 各 200×200pt(Proloquo 標準)
- 顏色按 Plutchik wheel(joy=金 / trust=綠 / fear=黑 / surprise=淺黃 / sadness=深藍 / disgust=紫 / anger=紅 / anticipation=橙)— **提升 emotion 識別度**
- 每個 cell 顯示:emoji 大 + 中文 + 英文細字
- cell 內 emoji 至少 80px(視覺主導,文字輔助)

### 12.6 模式間共享 vs 差異化

**共享(單一 source of truth)**:
- Plutchik 8 emotion data(`constants/emotions.ts`)
- Profile system(`store/profileStore.ts`)
- IndexedDB 儲存(同 DB,唔同 table prefix)
- Tailwind theme(8 個情緒色)
- Web Audio engine
- MediaPipe Hands + Pose models
- PWA + install banner

**差異化(per mode UI)**:
- Layout(component 唔同)
- Input handler(weak: dwell-click / mid: pose classifier / high: standard)
- Feature set(weak: 8 chip + TTS / mid: 動作 trigger + TTS / high: 全功能)
- TTS 觸發時機(weak: 必 / mid: 觸發 / high: 選用)

### 12.7 Profile × Mode 雙軸儲存

| 維度 | 範例 |
|---|---|
| Profile | 小明(亂數 ID: `s_a8f3e2`)| |
| Mode | 🟢 弱 |
| 上次用 mode | 🟢 弱 |
| Default mode | 🟢 弱(老師設定)|
| Emotion log | [{ts, emotion: 'joy', source: 'click', duration_ms: 1200}] |
| 動作 log(mid 才有) | [{ts, pose: 'joy', confidence: 0.7, matched: true}] |
| 作品 log(high 才有) | [{id, ts, thumbnail, emotion, strokes: 45}] |

### 12.8 對 §11 Feature 嘅 retrofit

**升級做 Wave 1 core**(原本 Wave 2 升上黎):
- **E18 TTS 語音** → 升做 Wave 1(weak/mid mode 必備)
- **新加 F23 Finger dwell-click** → Wave 1(weak mode 必備)
- **新加 F24 Mode entry router** → Wave 1(3 mode 入口必備)
- **新加 F25 Pose-prompt overlay** → Wave 1(mid mode 必備)
- **新加 F26 Per-mode UI shells** → Wave 1(3 個 mode UI)

**降級 / 拆細**:
- E5 情緒 vocabulary 教學 mode → 拆做 weak / mid 兩個 sub-mode
- C2 肢體動作 classifier → 升做 F27,weak mode 唔用,mid mode 用

**最終 Wave 1 估算 LoC**:
- 原本 ~2500 → **~3800 LoC**(3 mode UI 殼 + finger dwell-click + TTS + pose-prompt)

### 12.9 對 Phase 1 嘅 retrofit

Phase 1 唔再係「Vite scaffold + 跨裝置 baseline」,而係:
- Vite scaffold + 跨裝置 baseline
- **+ Mode entry router(F24)**
- **+ 3 個 mode UI shell(F26,各 ~50 LoC)**
- **+ AAC default UI**
- **+ Finger dwell-click hook(弱模式要嘅 1 個核心,Phase 1 起碼 stub)**

Phase 1 LoC:由 ~300 → **~500 LoC**

### 12.10 對 Phase 2 嘅 retrofit

Phase 2 加:
- **完整 finger dwell-click algorithm(F23)**
- **完整 Plutchik 8 emotion vocabulary(weak mode 要即刻可用)**
- **完整 Profile × Mode state(E6 升級)**
- **完整 TTS service(E18)**
- **Mode 切換時保留 state**
- **完整 MediaPipe Hands weak mode(食指 hover 偵測)**

Phase 2 LoC:由 ~700 → **~1100 LoC**

### 12.11 對 §5 風險表嘅新風險

新增:
| # | 風險 | 緩解 |
|---|---|---|
| **R32** | **Finger dwell-click 誤觸**(學生手抖 / 手指飄走)| 視覺 affordance + 0.5s dwell + 可調整 dwell time |
| **R33** | **TTS 喺 iPad PWA 唔穩定**(speechSynthesis quirk)| Web Speech API fallback + 預載語音 + 用戶可關 TTS |
| **R34** | **3 mode UI shell 維護成本 × 3** | 共用 base component + 模式 prop 切換 |
| **R35** | **Mode entry 學生選錯 mode**(能力判斷由老師,學生未必識揀) | 老師 default + 「上次用」highlight + 可鎖 mode(per profile)|
| **R36** | **弱模式嘅 chip 太大遮住鏡頭 image** | chip overlay 喺鏡頭 image 之上,opacity 可調,weak mode 預設鏡頭 opacity 0(只 chip)|
| **R37** | **動作 classifier 對坐姿學生失敗**(原 plan assume 站姿) | classifier 設計要坐姿 friendly,多輪校準(per profile)|
| **R38** | **Profile × Mode 雙軸 storage 結構複雜** | 統一 IndexedDB schema:`profile` table + `mode_log` table + `work` table,用 mode field 篩選 |
| **R39** | **Dwell-click 同 mouse click 衝突**(iPad 用手指 click 已經係 click) | iPad 自動 disable dwell,純 click 觸發 |
| **R40** | **Dwell time 設太長 / 太短**(per profile 校準失敗) | 預設 0.5s + user 可調 0.3-1.0s slider + 校準 step 引導 + 過低 / 過高警告 |



---
