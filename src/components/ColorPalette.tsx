/**
 * ColorPalette — 5 顏色 + Rainbow + Eraser。
 * 對應 source §4 抽出。
 *
 * Phase 2 簡化版:F2/F3/F4/F5 button click handler + UI feedback。
 * Phase 3 可加 Plutchik 8 情緒色綁定(E3 情緒畫筆, 中模式 v1.0 plan)。
 */

interface ColorPaletteProps {
  current: string
  isRainbow: boolean
  isEraser: boolean
  onColor: (color: string) => void
  onRainbow: () => void
  onEraser: () => void
}

const COLORS: Array<{ hex: string; title: string; ring: string }> = [
  { hex: '#EF4444', title: '紅色', ring: 'ring-red-500/30' },
  { hex: '#3B82F6', title: '藍色', ring: 'ring-blue-500/30' },
  { hex: '#10B981', title: '綠色', ring: 'ring-emerald-500/30' },
  { hex: '#F59E0B', title: '黃色', ring: 'ring-amber-500/30' },
  { hex: '#8B5CF6', title: '紫色', ring: 'ring-purple-500/30' },
]

export function ColorPalette({
  current,
  isRainbow,
  isEraser,
  onColor,
  onRainbow,
  onEraser,
}: ColorPaletteProps): React.JSX.Element {
  return (
    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md">
      <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
        <span>🎨</span>
        <span>選擇彩虹畫筆</span>
      </h3>
      <div className="grid grid-cols-5 gap-2">
        {COLORS.map((c) => {
          const isActive = !isRainbow && !isEraser && current === c.hex
          return (
            <button
              key={c.hex}
              type="button"
              onClick={() => onColor(c.hex)}
              title={c.title}
              className={`
                h-10 w-10 rounded-xl border-2 transition-all active:scale-90
                ${isActive
                  ? `border-white ring-4 ${c.ring}`
                  : 'border-transparent hover:scale-110'
                }
              `}
              style={{ backgroundColor: c.hex }}
              aria-label={c.title}
            />
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          onClick={onRainbow}
          aria-pressed={isRainbow}
          className={`
            py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95
            ${isRainbow
              ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 ring-4 ring-amber-400 text-white'
              : 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 text-white'
            }
          `}
        >
          🌈 七彩霓虹筆
        </button>
        <button
          type="button"
          onClick={onEraser}
          aria-pressed={isEraser}
          className={`
            py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-1
            ${isEraser
              ? 'bg-amber-500 text-slate-900'
              : 'bg-slate-700 text-white hover:bg-slate-600'
            }
          `}
        >
          🧹 橡皮擦
        </button>
      </div>
    </div>
  )
}
