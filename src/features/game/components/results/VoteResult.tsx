import type { VoteResult as VoteResultData } from '../../../../shared/types/api';
import { ConfettiIcon } from '../../../../shared/ui';

/**
 * 투표 결과 콘텐츠 — 득표순 정렬 막대 + 최다 득표(당첨). ResultModal 안에 렌더된다.
 */
export function VoteResult({ result }: { result: VoteResultData }) {
  const total = result.tally.reduce((s, t) => s + t.count, 0);
  const ranked = [...result.tally].sort((a, b) => b.count - a.count);
  const max = ranked[0]?.count ?? 0;

  // 공동 1위 — winners 가 여럿이면 모두 당첨으로 표시(하위호환: winners 없으면 winner 하나).
  const winners = result.winners ?? [result.winner];
  const winnerIds = new Set(winners.map((w) => w.id));
  const tie = winners.length > 1;

  return (
    <>
      <p className="muted center">총 {total}표</p>

      <div className="stack-sm" style={{ marginTop: 16 }}>
        {ranked.map((t, i) => {
          const pct = max > 0 ? Math.round((t.count / max) * 100) : 0;
          const isWinner = winnerIds.has(t.item.id);
          // 공동 1위면 동점자 모두 '1위'로 표기. 그 외에는 정렬 순위.
          const rankLabel = isWinner ? '1위' : `${i + 1}위`;
          return (
            <div key={t.item.id} className={`vote-result-row${isWinner ? ' winner' : ''}`}>
              <span className="vote-rank">{rankLabel}</span>
              <span className="vote-label">{t.item.label}</span>
              <span className="vote-count">{t.count}표</span>
              <span className="vote-bar">
                <span className="vote-bar-fill" style={{ width: `${pct}%` }} />
              </span>
            </div>
          );
        })}
      </div>

      <div className="result-card" style={{ marginTop: 20, padding: 20 }}>
        <p className="section-label" style={{ color: 'var(--accent)' }}>
          {tie ? `공동 1위 (${winners.length})` : '당첨!'}
        </p>
        {/* inline-flex 로 두면 부모의 텍스트 baseline 에 얹혀 아래쪽에만 여백이 더 생긴다
            (카드 안에서 내용이 위로 쏠려 보이던 원인). block 레벨 flex 로 바꿔 균형을 맞춘다. */}
        <p className="result-winner" style={{ fontSize: tie ? 24 : 30, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {winners.map((w) => w.label).join(', ')} <ConfettiIcon size={26} />
        </p>
      </div>
    </>
  );
}
