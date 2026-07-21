# Air Drawing Fork — Roadmap (v2.0 — 3-tier accessibility)

> 對應 `PLAN.md` 嘅 7 階段 + 11+ 個 Wave 1 feature(3 個難度模式 + iPad / Notebook 跨裝置 + non-verbal 表達輔具 + Plutchik 8 emotion)。
> **Project v2.0 pivot(2026-07-21)**:3 個 accessibility tier(弱/中/強)+ Finger dwell-click + TTS。
> 每個 phase 對應一個 milestone,每個 acceptance 拆 `Weak:` / `Mid:` / `High:` 3 線 + `iPad:` / `Notebook:` 兩 device。

---

## ⚠️ v2.0 Pivot 摘要(2026-07-21)

**v1.0 定位**:Non-verbal 表達輔具(單一 UX)
**v2.0 定位**:**3 個 Accessibility Tiers + 共享 emotion data**

- 🟢 **弱模式(Low / Beginner)**:鏡頭見到 → mon 顯示 8 個 Plutchik emoji chip → **cam trace 學生手指 click chip** → chip 有 **animation + TTS 語音**。**唔需要做動作,只揀**
- 🟡 **中模式(Mid / Intermediate)**:cam trace 學生做**特定動作才 trigger 情緒**(8 個 rule-based 動作對應 8 種情緒)
- 🔴 **強模式(High / Advanced)**:v1.0 plan(自由畫 / 情緒畫筆 / 表達 vocabulary / 全功能)

**新 UX**:開 app 預設顯示「揀模式」畫面(3 個 mode chip + 上次用過嘅 mode highlight)
**新 Tech**:**Finger dwell-click algorithm**(0.5s 停留 trigger)+ **TTS service** + **3 個 mode UI shell**
**新 LoC**:Wave 1 ~2500 → **~3800**(+52%)
**新風險**:R32-R39(finger 誤觸 / TTS iOS quirk / 3 mode 維護 / mode 選錯 / chip 遮鏡頭 / 坐姿 classifier / 雙軸 storage / dwell-click 衝突)

詳細見 `PLAN.md §12`。

---

## Milestone 總覽(v2.0)

| Phase | 主題 | 預估 LoC | 狀態 | 觸發條件 |
|---|---|---|---|---|
| 0 | Plan 評估(本文件) | — | ✅ shipped | 用戶 confirm stack = React 19 |
| 0.5 | 跨裝置 plan 修訂 | — | ✅ shipped | iPad + notebook |
| 0.7 | PivOT v1.0: 表達輔具 + Plutchik 8 | — | ✅ shipped | 情緒 / 表達方向 |
| 0.8 | **PivOT v2.0: 3-tier accessibility + finger dwell-click** | — | ✅ shipped | 用戶描述 3 個 mode + cam trace 手指 |
| 1 | Vite scaffold + **Mode entry router** + 3 mode shell + 跨裝置 + AAC default | ~500 | ⏳ pending | Plan approved |
| 2 | **Weak mode 完整** + Mid stub + High stub + Plutchik 8 + 多 profile + PIN + TTS | ~1100 | ⏳ pending | Phase 1 通過 |
| 3 | **3 mode 全部完整 feature** + 鍵盤 hotkey + 情緒畫筆 + Undo/Redo + 教學 + 日記 + 記憶遊戲 | ~1500 | ⏳ pending | Phase 2 通過 |
| 4 | Tailwind v4 + 0 CDN | ~750 | ⏳ pending | Phase 3 通過 |
| 4b | Universal PWA + 智障學生私隱 + 3 mode install | ~950 | ⏳ pending | Phase 4 通過 |
| 5 | 模組化 + 測試 + 跨裝置 + **3 mode smoke** | ~1100 | ⏳ pending | Phase 4b 通過 |
| 6 | Wave 2 + 可選 Tauri | TBD | ⏸ parked | 用戶 ask |

---

## Phase 1 — Vite scaffold + Mode entry router + 3 mode shell stub

**Goal**: 證明 React 19 + Vite + 3 mode entry 行得通 + 跨裝置 baseline + AAC default

**Tasks**:
- [ ] `npm create vite@latest .` (選 React 19 + TS)
- [ ] 把 source `index.html` 嘅 `<body>` 整段 copy 入 `src/App.tsx`
- [ ] 把 source `<script>` 整段 copy 入 `App.tsx` 嘅 `useEffect`
- [ ] 4 個 CDN 照用(暫時)
- [ ] `window.let` 改 component `useRef`
- [ ] **跨裝置 viewport**:
  - [ ] `<meta name="viewport" ... viewport-fit=cover, user-scalable=no">`
  - [ ] canvas / video 加 `touch-action: none`
  - [ ] `height: 100dvh` 取代 `100vh`
  - [ ] `matchMedia('(pointer: coarse)')` 偵測
- [ ] **F24 Mode entry router**:
  - [ ] `<ModeEntry>` 3 個大 chip(weak/mid/high)+ 上次用 highlight
  - [ ] 寫入 `modeStore`(Zustand)
  - [ ] 揾 mode → 跳到對應 mode shell
- [ ] **F26 Per-mode UI shell stub**(3 個,各 ~50 LoC):
  - [ ] `<WeakModeShell>` 8 個 chip 位置(暫時 mock chip)
  - [ ] `<MidModeShell>` 鏡頭 + 動作 prompt placeholder
  - [ ] `<HighModeShell>` 鏡頭 + canvas + 工具列(scaffold 後續 phase 填)
- [ ] **AAC mode default**:鏡頭 optional,只 mouse / touch click work
- [ ] **F23 Finger dwell-click hook stub**:先寫個 mock,Phase 2 實裝

**Acceptance**:
- [ ] **iPad Safari** 載入 → Mode entry → 3 chip 全部可見
- [ ] **iPad Safari** 揾 weak → 8 chip mock 顯示
- [ ] **iPad Safari** 揾 mid → 鏡頭 prompt 顯示
- [ ] **iPad Safari** 揾 high → 原 source 1:1 行為
- [ ] **iPad Safari** 鏡頭 optional,click chip 仍 work
- [ ] **Notebook Chrome / Edge** 同 iPad 行為
- [ ] **Notebook Chrome / Edge** 滑鼠 hover chip 有 affordance
- [ ] 兩 device 唔破 layout
- [ ] 鏡頭唔自動起(智障友善)

**Risks monitored**: R10, R11, R12, R13, R18, R20, R22, R27, R29, R32, R34, R35, R36, R39, **R40**

**Audit**: 10min mini-audit + 5-bug-family check

---

## Phase 2 — Weak mode 完整 + Plutchik 8 + Profile + PIN + TTS

**Goal**: **🟢 弱模式**完整可用,其他 2 個 mode stub

**Tasks**:
- [ ] **C1 Plutchik 8 emotion constants**:`src/constants/emotions.ts`
  - 8 個:{ emoji, zh-Hant, en, hex, ttsText, animationType }
- [ ] **E18 TTS service**:`src/services/tts.ts`
  - Web Speech API wrapper + iOS PWA fallback
  - 預載常用情緒詞
  - 可關 TTS(per profile)
- [ ] **F23 Finger dwell-click 完整**:`src/hooks/useFingerHover.ts`
  - MediaPipe Hands 食指追蹤(landmark 8)
  - 每 frame 檢查指尖 vs DOM element 範圍
  - **Dwell time 可調 0.3-1.0s**(per profile 儲存,預設 0.5s)
  - 設定 UI:settings slider + 校準 step
  - **iPad 自動 disable dwell**(touch click 已足)
  - 視覺 affordance(scale 1.0 → 1.1 + progress ring)
  - **Dwell 飄走 cancel + reset**
  - **Click 後 0.3s cooldown** 防重複 trigger
- [ ] **E6 多 student profile 升級 × Mode**:
  - 亂數 ID(8 字 alphanumeric)
  - localStorage 加密(SJCL)
  - Per-profile 記低 default mode + 上次 mode
  - Profile switcher UI(在 mode entry 內)
- [ ] **E7 PIN 鎖 + 觀察者模式**:
  - 老師設 PIN(4-6 digit)
  - 5 分鐘 idle 自動鎖
  - Master reset recovery code
- [ ] **E4 「今日感覺」prompt**:
  - 開 app 顯示 1 次,可 skip
  - 隨機化次序
  - 寫入 emotion log
- [ ] **Weak mode 完整 UI**:
  - 8 個 Plutchik chip 全屏
  - Hover / dwell 時有 bounce animation
  - Click → TTS 讀「我覺得係快樂」+ 寫入 log
  - 「退出」button 返 mode entry
- [ ] **Mid mode 完整**(對齊 user 要求):
  - 鏡頭 + Pose 偵測
  - 8 個 rule-based 動作
  - Pose-prompt overlay
  - 動作 match → chip 高亮 + TTS
- [ ] **High mode 1:1 source 行為**:
  - Phase 1 stub 完善化
  - 但暫時唔加 emotion 整合(Phase 3 做)
- [ ] 刪 dead code:source 嗰個 `clearTimeout(webcamTimeoutId)` 自我 clear

**Acceptance**:
- [ ] **Weak mode** 完整:8 chip + dwell-click + animation + TTS
- [ ] **Mid mode** 完整:8 動作 + pose classifier + TTS
- [ ] **High mode** 1:1 source 行為
- [ ] **TTS**:iOS Safari + Chrome 都 work
- [ ] **Profile**:4 個 profile 加密儲存,亂數 ID
- [ ] **PIN**:設 PIN + 鎖 + 解鎖
- [ ] **「今日感覺」**:每次開 app 顯示,1 次
- [ ] **Dwell-click**:
  - [ ] iPad disable,純 click
  - [ ] Notebook enable,0.5s 觸發
  - [ ] hover affordance 清楚
- [ ] 5-bug-family check:F1 / F4 / F5 通過
- [ ] 鏡頭唔自動起(AAC default)

**Risks monitored**: R2, R3, R4, R5, R10, R13, R22, R23, R24, R25, R27, R28, R29, R32, R33, R34, R35, R36, R37, R38, R39

**Audit**: 10min mini-audit + 5-bug-family check

---

## Phase 3 — 3 mode 全部完整 feature

**Goal**: 3 個 mode 全部 feature 完整

**Tasks**:

**🟢 Weak mode 擴展**:
- [ ] Emotion log 顯示(對老師 / 觀察者)
- [ ] 點 chip 完可加 emoji stamp 到背景(簡單作品)
- [ ] TTS 速度 / pitch 設定
- [ ] 對應 character / avatar(可選)

**🟡 Mid mode 擴展**:
- [ ] 動作 classifier 校準 step(per profile)
- [ ] 動作記憶遊戲
- [ ] 動作 log 顯示
- [ ] 動作成功率統計

**🔴 High mode 全功能**:
- [ ] 新 `src/store/drawingStore.ts`:brush color / size / mode / template / emotion
- [ ] `<TemplatePicker>` + `<ColorPalette>` + `<BrushSize>` + `<SaveButton>`
- [ ] **E1 情緒卡 dock**(右欄底部永遠可見)
- [ ] **E3 情緒畫筆 mode**(8 色綁 8 情緒)
- [ ] **E5 情緒 vocabulary 教學 mode**
- [ ] **E10 Undo / Redo**:stroke history stack + Ctrl+Z hotkey
- [ ] **E11 情緒顏色記憶遊戲**
- [ ] **E20 印章 = 情緒符號**
- [ ] **E9 情緒日記 multi-project**
- [ ] **E8 作品情緒標籤**

**🔑 Cross-mode**:
- [ ] 鍵盤 hotkey(scope: notebook only + high mode only)
  - [ ] `Delete` / `Backspace` 全部擦除
  - [ ] `S` 存檔
  - [ ] `1`-`8` 切 8 種情緒色
  - [ ] `0` 切橡皮擦
  - [ ] `R` 切 rainbow
  - [ ] `U` / `Ctrl+Z` undo
  - [ ] `Ctrl+Shift+Z` redo
  - [ ] `[` / `]` 調粗細
- [ ] **iPad 直向(834w)右欄變 bottom sheet / drawer**(high mode)
- [ ] **AAC mode UI**(全 keyboard / touch)
- [ ] **「今日感覺」prompt 隨機化**(R31)
- [ ] **`prefers-reduced-motion` respect**(R30)
- [ ] **情緒 vocabulary override**(R26)

**Acceptance**:
- [ ] **3 mode 全部 feature 完整**
- [ ] **iPad 直向**:high mode 右欄變 bottom sheet
- [ ] **Notebook**:每個 hotkey 有效,scope guard 過濾 iPad + 過濾 weak/mid mode
- [ ] **AAC mode**:鏡頭關閉後所有 hotkey + touch 仍 work
- [ ] 4 個 high mode component,每檔 < 80 行
- [ ] 5-bug-family check:全 5 family 過

**Risks monitored**: R4, R9, R18, R19, R20, R24, R25, R26, R30, R31, R33, R34, R35, R36, R37, R38, R39

**Audit**: 10min mini-audit + 5-bug-family check

---

## Phase 4 — Tailwind v4 + 0 CDN

**Goal**: 取代 Tailwind CDN,純本地產物

**Tasks**:
- [ ] 裝 `@tailwindcss/vite`
- [ ] `vite.config.ts` 加 plugin
- [ ] `src/index.css` 加 `@import "tailwindcss"`
- [ ] 移除 `https://cdn.tailwindcss.com` CDN
- [ ] `safelist` 包 5 + 8 個顏色 ring class
- [ ] 補 React 19 `useEffect` cleanup
- [ ] 共用情緒 / 顏色 / 尺寸常數入 `constants.ts` + `constants/emotions.ts`
- [ ] 私隱 footer 保留(智障學生保護聲明 +)

**Acceptance**:
- [ ] 0 個外部 script 載入
- [ ] `npm run build` 純本地產物
- [ ] Tailwind 動態 class 全部生效
- [ ] 5-bug-family check:全 5 family 過

**Risks monitored**: R1, R7, R8

**Audit**: 10min mini-audit + 5-bug-family check + cleanup audit

---

## Phase 4b — Universal PWA + 智障私隱

**Goal**: 兩 device 都做到「免安裝」+ **智障學生私隱保護驗證** + **3 mode install**

**Tasks**:
- [ ] 裝 `vite-plugin-pwa`
- [ ] `public/manifest.webmanifest` + icons
- [ ] Service worker:precache + runtime cache MediaPipe wasm/model
- [ ] **雙 install prompt UX**:
  - [ ] **iPad**:custom banner「分享 → 加到主畫面」
  - [ ] **Chrome/Edge notebook**:`beforeinstallprompt`
  - [ ] **Firefox / Safari desktop**:hidden
- [ ] **R27 智障私隱保護驗證**:
  - [ ] profile 亂數 ID
  - [ ] localStorage 加密
  - [ ] 任何上傳 disable + CSP `connect-src 'none'`
  - [ ] 私隱聲明擴(智障學生保護)
- [ ] **3 mode install banner 各自 adapt**:
  - [ ] iPad 進入 high mode → banner
  - [ ] weak mode → 唔需要 banner(?)
  - [ ] mid mode → 看 user 決定
- [ ] page visibility API:iPad background → 鏡頭 suspend → resume re-init

**Acceptance**:
- [ ] **iPad**:Add to Home Screen 成功,PWA 全螢幕,離線 work
- [ ] **iPad**:3 mode 切換 background 30 秒,resume 自動 re-init
- [ ] **Notebook Chrome / Edge**:install banner + standalone window
- [ ] 兩 device 都:0 外連 CDN,**0 上傳任何 data**
- [ ] Lighthouse PWA score ≥ 90
- [ ] **R27 驗證**:profile 唔可用真名,任何 network request = 0

**Risks monitored**: R1, R12, R14, R15, R16, R21, R27

**Audit**: 10min mini-audit + 5-bug-family check + Lighthouse + **私隱 audit**

---

## Phase 5 — 模組化 + 測試 + 3 mode smoke

**Goal**: 純函數化 + 跨裝置 + 3 mode smoke + **finger dwell-click + 情緒 classifier 完整 test**

**Tasks**:
- [ ] §1 Web Audio 抽 `src/lib/audio.ts`
- [ ] §6 Export 抽 `src/lib/export.ts`(加情緒 metadata + mode metadata)
- [ ] `AudioContext` 放 module-level singleton
- [ ] 裝 Vitest + `@testing-library/react` + `jest-axe` + `fake-indexeddb`
- [ ] **Test 1-6**(同 v1.0)
- [ ] **Test 7:Plutchik 8 emotion constants completeness**
- [ ] **Test 8:emotion classifier 8 個動作 mapping**
- [ ] **Test 9:profile 加密 / 亂數 ID**
- [ ] **Test 10:PIN 鎖定 / 解鎖 flow**
- [ ] **Test 11:finger dwell-click algorithm**:
  - [ ] 預設 0.5s dwell trigger
  - [ ] user 可調 0.3-1.0s slider,設定持久化 per profile
  - [ ] 過低(<0.3s) / 過高(>1.0s) 警告
  - [ ] iPad disable dwell
  - [ ] hover affordance + progress ring
  - [ ] 鏡頭 miss 食指 fallback
  - [ ] 飄走 cancel + reset
  - [ ] 0.3s cooldown 防重複
- [ ] **Test 12:TTS service mock**:
  - [ ] speechSynthesis 模擬
  - [ ] iOS PWA fallback
- [ ] **Test 13:3 mode switch state preservation**
- [ ] **Test 14:per-profile default mode persistence**
- [ ] a11y:`jest-axe` filter serious+critical(3 mode 各做)
- [ ] coverage > 70%(先測 actual 再設 threshold = actual - 3pp)
- [ ] **跨裝置 + 3 mode smoke matrix**:
  - [ ] iPad Safari × 3 mode × 10 個 core flow
  - [ ] Notebook Chrome × 3 mode × 10 個 core flow
  - [ ] **AAC mode smoke**(鏡頭關閉全部 flow × 3 mode)
  - [ ] 截圖存 `docs/smoke/`

**Acceptance**:
- [ ] `lib/` 全 unit test 綠
- [ ] 8 個 Plutchik 情緒全有 test 覆蓋
- [ ] 8 個肢體動作 classifier 全有 test
- [ ] **finger dwell-click** 完整 test
- [ ] **TTS service** mock test
- [ ] **3 mode state preservation** test
- [ ] coverage > 70%
- [ ] a11y axe 無 serious+critical(3 mode)
- [ ] 跨裝置 + 3 mode smoke matrix 截圖存檔
- [ ] 5-bug-family check:全 5 family 過

**Risks monitored**: R2, R8, R24, R32, R33, R38

**Audit**: Full senior review(>500 LoC)

---

## Phase 6 — Wave 2 + 可選 Tauri

> 等用戶主動 ask 至做。

**Wave 2 候選 feature**(7 個,從 PLAN §11):
- E12 肢體動作品牌卡(PECS flashcard export)
- E13 情緒時序圖(全班老師 dashboard)
- E14 背景音樂
- E15 多手指 / 雙手
- E18 已升做 Wave 1 — 由呢度 drop
- E19 中文字 / 圖卡模板
- E21 家長 / 老師 email 報告

剩 6 個 Wave 2 feature。

**Tauri 2 路線**(PLAN §6 still off by default):等用戶主動 ask

---

## 觸發 / Pause 條件

**Pause if**:
- 用戶 stop 30 日
- 連續 2 個 phase ship 後冇 user feedback → 等 review
- 發現 source 有隱藏 feature 我哋漏咗
- **R24 動作 classifier 訓練數據不足**
- **R32 finger dwell-click 學生 user testing 失敗**
- **R33 TTS 喺 iPad 唔 work**
- 跨裝置 smoke 失敗但 root cause 未明

**Stop if**:
- 用戶 cancel
- Pivot 失敗
- 3 mode 模式根本行唔通(學生 user testing 唔 work)
- Stack 大改

---

## 通訊節奏

| 事件 | 動作 |
|---|---|
| Phase 完成 | 1 行 ack + 重要決策(mirror rule)|
| Phase 失敗 | 完整 root cause + fix 提案,等 user 確認 |
| 發現 source 有 dead code / 改善 | inline 報告,累積下一個 phase |
| 範圍改變 | STOP,返 PLAN.md §11 改 scope |
| R24 / R32 / R33 出事 | 立即 surface,等 user 決定 fix / drop feature |
| **學生 / 老師 user testing 反饋** | 立即納入下一個 phase 調整,**唔等下一個 sprint** |

---

## 記憶 cross-ref

- PLAN.md §1.5 差異表 ←→ Phase 1-4b 跨裝置
- PLAN.md §5 風險表 R23-R39 ←→ Pivot v2.0 新增
- PLAN.md §6 scope guard ←→ Feature 走 §11 流程
- PLAN.md §10 Reference sites ←→ 對標
- **PLAN.md §11 Feature Backlog** ←→ Wave 1/2/3
- **PLAN.md §12 Accessibility Levels(v2.0 新增)** ←→ 本文件核心
- 5-bug-family check(memory rule 13)→ 每 Phase 跑
- Senior-engineer audit(memory rule 5)→ >100 LoC Phase 跑
- CI gates:coverage + a11y(memory rule 14)→ Phase 5
- **R27 智障私隱 audit** → Phase 4b / 5 必跑
- **3 mode a11y audit** → Phase 5(weak / mid / high 各 1 audit)

---

## Reference index(同 PLAN §10 對齊)

| Reference | URL | 觀察日期 | 對 plan 影響 |
|---|---|---|---|
| Active Arcade | https://www.activearcade.ai | 2026-07-21 | 2C motion-based 市場驗證 + 私隱差異化 |
| **Proloquo2Go / TouchChat** | (iOS App Store) | 2026-07-21 | **AAC app 對標** — chip 尺寸 ≥200×200pt、3×3 grid、TTS 速度可調、Visual scene |
| **(待加)** PECS 官方 | (待 user 提供) | — | 圖卡交換溝通,weak mode design ref |
| **(待加)** DIR/Floortime | (待 user 提供) | — | mid mode 動作觸發設計 ref |

---

**Status**: Plan v2.0(3-tier accessibility + Proloquo2Go ref + dwell time 可調 0.3-1.0s + R40 新增),**用戶已確認 plan 啱**。**等 user 明示「開 Phase 1」先啟 pre-flight recon + implementation**(plan only 模式仍然守住,冇 auto-start)。
