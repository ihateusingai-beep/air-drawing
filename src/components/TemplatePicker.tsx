/**
 * TemplatePicker — 4 種描紅模板選擇。
 * 對應 source §5 抽出。
 */

import { TEMPLATES, type TemplateId } from '../services/templates'

interface TemplatePickerProps {
  current: TemplateId
  onPick: (id: TemplateId) => void
}

export function TemplatePicker({ current, onPick }: TemplatePickerProps): React.JSX.Element {
  return (
    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-md">
      <h3 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2">
        <span>✏️</span>
        <span>學習描紅模板</span>
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {TEMPLATES.map((t) => {
          const isActive = t.id === current
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className={`
                p-3 rounded-xl text-xs font-bold transition-all active:scale-95
                ${isActive
                  ? 'bg-slate-900 border-2 border-amber-400 text-amber-400'
                  : 'bg-slate-800/50 border-2 border-transparent hover:bg-slate-700'
                }
              `}
            >
              <div className="text-lg mb-1" aria-hidden="true">{t.emoji}</div>
              <div>{t.labelZh}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
