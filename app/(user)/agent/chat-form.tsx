'use client';

import { useActionState, useState } from 'react';
import AlertRow from '@/components/ui/alert-row';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import Panel from '@/components/ui/panel';
import { askAgent } from './actions';
import { answerDisplayState, initialAgentState } from './state';

const examples = [
  '602K02693의 최근 출고 추이를 알려줘.',
  '602K02693의 수요 유형을 분석해줘.',
  'MDL121의 Sales OL과 SCM OL 정확도를 비교해줘.',
  'MDL121 1대 판매 시 필요한 CAP 및 BOM을 알려줘.',
];

export default function ChatForm({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState(askAgent, initialAgentState);
  const [question, setQuestion] = useState('');
  const answer = state.answer;

  return <div className="grid">
    {!enabled && <AlertRow><strong>AI Agent 설정이 필요합니다.</strong><p>서버의 OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL을 설정한 뒤 사용할 수 있습니다.</p></AlertRow>}
    <Panel title="질문하기" description="조회 가능한 SCM 데이터에 근거해 답변합니다.">
      <form action={formAction} className="form-stack">
        <label>질문
          <textarea className="form-input" name="question" rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!enabled || pending} placeholder="품목 코드나 기종 코드를 포함해 질문해 주세요." />
        </label>
        <div className="button-row">
          <Button type="submit" variant="primary" disabled={!enabled || pending}>{pending ? '조회 중…' : '질문 전송'}</Button>
        </div>
      </form>
      <div className="section">
        <div className="section-heading"><h3>예시 질문</h3><span>선택하면 입력란에 채워집니다.</span></div>
        <div className="button-row">
          {examples.map((example) => <Button key={example} type="button" disabled={!enabled || pending} onClick={() => setQuestion(example)}>{example}</Button>)}
        </div>
      </div>
    </Panel>

    {state.error && <AlertRow><strong>요청을 처리하지 못했습니다.</strong><p>{state.error}</p></AlertRow>}

    {answer && <Panel title="Structured Answer" description="수치는 실행된 Tool 결과와 대조한 뒤 표시됩니다.">
      <div className="grid">
        <div className="card">
          <div className="card-title"><h3>답변</h3>{answer.risk && <Badge status={answer.risk} />}</div>
          <p>{answer.answer}</p>
          {answer.verdict && <p className="muted">판정: {answer.verdict}</p>}
          <p className="muted">데이터 기준시각: {answer.data_as_of ?? '—'}</p>
        </div>

        {answerDisplayState(answer) === 'unavailable'
          ? <AlertRow><strong>계산 불가</strong><p>{answer.cannot_answer_reason ?? 'CALCULATION_UNAVAILABLE'}</p></AlertRow>
          : <>
            {answer.recommended_action && <div className="callout blue"><div><strong>권고</strong>{answer.recommended_action}</div></div>}
            <div className="grid grid-3">
              {answer.evidence.map((evidence, index) => <div className="card" key={`${evidence.source}-${index}`}>
                <div className="card-title"><h3>{evidence.source}</h3></div>
                <p>{evidence.summary}</p>
                <strong>{evidence.value === null ? '—' : String(evidence.value)}</strong>
                {evidence.reason_code && <p className="muted">{evidence.reason_code}</p>}
                <p className="muted">기준: {evidence.data_as_of ?? '—'}</p>
              </div>)}
            </div>
          </>}

        <details className="card">
          <summary>Tool trace ({state.trace.length})</summary>
          <div className="section">
            {state.trace.length === 0 ? <p className="muted">실행된 Tool이 없습니다.</p> : state.trace.map((trace, index) => <div className="check-row" key={`${trace.name}-${index}`}>
              <span>{trace.name}</span><span className="muted">{trace.ok ? '성공' : '실패'} · {trace.ms}ms · {trace.reason ?? '—'} · {JSON.stringify(trace.args)}</span>
            </div>)}
          </div>
        </details>
      </div>
    </Panel>}
  </div>;
}
