import type { GameResult } from '../../../../shared/types/api';
import { ConfettiIcon } from '../../../../shared/ui';

/**
 * 뽑기 결과 콘텐츠 (룰렛·제비·풍선 공용) — ResultModal 안에 렌더된다.
 * result.type으로 1개 당첨 / N개 당첨을 구분해 렌더.
 * 사다리(matching)·투표(tally)·순서 정하기(order)는 별도 결과 컴포넌트가 담당한다.
 */
export function DrawResult({ result }: { result: GameResult }) {
  // winner/winners 는 Item 객체(백엔드 계약). 화면엔 label 을 쓴다.
  const winnerLabels =
    result.type === 'roulette'
      ? [result.winner.label]
      : result.type === 'draw' || result.type === 'balloon'
        ? result.winners.map((w) => w.label)
        : [];

  return (
    <div className="result-card">
      <p className="section-label" style={{ color: 'var(--accent)' }}>
        당첨!
      </p>
      {winnerLabels.map((w) => (
        <p key={w} className="result-winner">
          {w}
        </p>
      ))}
      {/* VoteResult 와 같은 이유로 block 레벨 flex — inline-flex 는 baseline 에 얹혀 아래 여백이 더 생긴다. */}
      <p className="muted" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        오늘은 {winnerLabels.join(', ')}! <ConfettiIcon size={20} />
      </p>
    </div>
  );
}
