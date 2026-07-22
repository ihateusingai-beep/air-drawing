/**
 * SaveButton — 存檔下載(合併 template + drawing, 觸發瀏覽器下載)。
 * 對應 source §6 `saveArtwork` refactor。
 */

import { saveArtwork } from '../services/export'
import { playSuccessSound } from '../services/audio'

interface SaveButtonProps {
  templateCanvas: HTMLCanvasElement | null
  drawingCanvas: HTMLCanvasElement | null
  profileName?: string
  /**
   * v3.0.8.7.4 (Sprint 76 F1-B4b): save 完成 callback
   * 用嚟 log emotion 落 journal / trigger toast
   * 唔 pass → silent (backward compat)
   */
  onSave?: () => void
}

export function SaveButton({
  templateCanvas,
  drawingCanvas,
  profileName,
  onSave,
}: SaveButtonProps): React.JSX.Element {
  const handleClick = () => {
    if (!templateCanvas || !drawingCanvas) return
    playSuccessSound()
    const filename = saveArtwork(
      { templateCanvas, drawingCanvas },
      profileName,
    )
    // Phase 3 可加 toast 通知
    if (typeof console !== 'undefined') {
      console.log('Saved artwork:', filename)
    }
    // Sprint 76 F1: notify parent after save
    onSave?.()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-sm"
    >
      💾 儲存並下載我的作品
    </button>
  )
}
