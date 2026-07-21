/**
 * BrushSize — 3 檔粗細選擇。
 * 對應 source §4 抽出。
 */

interface BrushSizeProps {
  current: number
  onPick: (size: number) => void
}

const SIZES: Array<{ size: number; label: string }> = [
  { size: 4, label: '細線' },
  { size: 10, label: '中等' },
  { size: 20, label: '粗線' },
]

export function BrushSize({ current, onPick }: BrushSizeProps): React.JSX.Element {
  return (
    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md">
      <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
        <span>📏</span>
        <span>調整畫筆粗細</span>
      </h3>
      <div className="flex gap-2">
        {SIZES.map((s) => {
          const isActive = current === s.size
          return (
            <button
              key={s.size}
              type="button"
              onClick={() => onPick(s.size)}
              className={`
                flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all active:scale-95
                ${isActive
                  ? 'bg-slate-900 border-amber-400 text-amber-400 font-bold'
                  : 'bg-slate-800/50 border-transparent hover:bg-slate-700'
                }
              `}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
