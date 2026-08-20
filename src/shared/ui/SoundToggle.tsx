import { useState } from 'react';
import { isMuted, toggleMuted } from '../lib/sound';
import { SoundOnIcon, SoundOffIcon } from './icons';

/**
 * 효과음 켜기/끄기 버튼. 설정은 localStorage 에 저장된다.
 * 스타일은 index.css 를 건드리지 않도록 인라인으로 둔다.
 *
 *  - floating(기본): 화면 우상단에 절대위치로 떠 있다(대부분의 화면).
 *  - floating=false: 절대위치 없이 흐름에 배치된다 — 홈의 브랜드 줄에 "Pick Me Now"와
 *    같은 선상으로 넣을 때 쓴다.
 */
export function SoundToggle({ floating = true }: { floating?: boolean } = {}) {
  const [muted, setMuted] = useState(isMuted());

  return (
    <button
      type="button"
      onClick={() => setMuted(toggleMuted())}
      aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
      aria-pressed={muted}
      title={muted ? '효과음 켜기' : '효과음 끄기'}
      style={{
        ...(floating
          ? {
              position: 'absolute',
              // TopBar 제목과 같은 줄에 오도록 맞춘다.
              // 화면 상단 패딩(--sp-5=20) + .topbar margin-top(--sp-1=4) = 24 에서 시작하는
              // 32px 높이 줄의 한가운데(40) 에 33px 버튼의 중심을 둔다 → 40 - 16.5 ≈ 24.
              top: '24px',
              // 본문과 같은 좌우 여백(--inset)에 맞춰 제목의 반대편 끝에 선다.
              right: 'var(--inset)',
              zIndex: 50,
            }
          : null),
        width: 33,
        height: 33,
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: muted ? 'var(--muted)' : 'var(--ink)',
        lineHeight: 1,
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        opacity: 0.9,
      }}
    >
      {muted ? <SoundOffIcon size={17} /> : <SoundOnIcon size={17} />}
    </button>
  );
}
