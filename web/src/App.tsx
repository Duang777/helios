import { AlertCircle, CheckCircle2, Loader2, Play, RefreshCw, Save, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  approveRun,
  compileIntent,
  getRun,
  getWorkflow,
  getWorkflowYAML,
  healthCheck,
  listCLIs,
  listWorkflows,
  publishWorkflow,
  resolveHumanHelp,
  runFileURL,
  saveWorkflow,
  startRun,
  validateWorkflowYAML,
} from './api/client';
import type { RegisteredCLI, StepRun, Workflow, WorkflowRun } from './api/types';
import { Badge, Button, Input, Panel, Textarea } from './components/ui/primitives';
import { DEMO_LEAD_SYNC_YAML } from './lib/demo-workflow';

export function App() {
  const [online, setOnline] = useState(false);
  const [intent, setIntent] = useState('');
  const [yaml, setYaml] = useState(DEMO_LEAD_SYNC_YAML);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [clis, setCLIs] = useState<RegisteredCLI[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const paramEntries = useMemo(() => Object.entries(workflow?.params ?? {}), [workflow]);

  const missingRequired = useMemo(() => {
    return paramEntries
      .filter(([, spec]) => spec.required)
      .some(([name]) => !String(paramValues[name] ?? '').trim());
  }, [paramEntries, paramValues]);

  const pendingApproval = useMemo(() => {
    return run?.stepRuns.find((step) => step.status === 'WAITING_APPROVAL') ?? null;
  }, [run]);

  const pendingHumanHelp = useMemo(() => {
    return run?.stepRuns.find((step) => step.status === 'WAITING_HUMAN') ?? null;
  }, [run]);

  const selectedStep = useMemo(() => {
    return run?.stepRuns.find((step) => step.stepId === selectedStepId) ?? run?.stepRuns[0] ?? null;
  }, [run, selectedStepId]);

  const selectedEvidence = useMemo(() => {
    if (!run || !selectedStep) {
      return [];
    }
    return run.evidence.filter((item) => item.stepId === selectedStep.stepId);
  }, [run, selectedStep]);

  const runInFlight = !!run && !isTerminal(run.status);

  useEffect(() => {
    void refreshMeta();
  }, []);

  useEffect(() => {
    if (!run || isTerminal(run.status)) {
      return;
    }
    const timer = window.setInterval(() => {
      void refreshRun(run.id);
    }, 800);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.status]);

  async function refreshMeta() {
    const ok = await healthCheck();
    setOnline(ok);
    if (!ok) {
      setError('后端未连接。先启动 ./scripts/dev-api.sh');
      return;
    }
    try {
      const [nextWorkflows, nextCLIs] = await Promise.all([listWorkflows(), listCLIs()]);
      setWorkflows(nextWorkflows);
      setCLIs(nextCLIs);
      setError(null);
    } catch (err) {
      setError(messageFromError(err, '读取工作流/CLI 失败'));
    }
  }

  async function refreshRun(runId: string) {
    try {
      const next = await getRun(runId);
      setRun(next);
      if (!selectedStepId && next.stepRuns[0]) {
        setSelectedStepId(next.stepRuns[0].stepId);
      }
      if (isTerminal(next.status)) {
        setNotice(
          next.status === 'COMPLETED'
            ? `完成 ${next.id} — 右侧可直接看步骤结果`
            : `${next.status} ${next.id}`,
        );
      }
    } catch (err) {
      setError(messageFromError(err, '读取 Run 失败'));
    }
  }

  async function handleCompile() {
    setBusy('compile');
    setError(null);
    setNotice(null);
    try {
      const result = await compileIntent(intent.trim());
      setYaml(result.yaml);
      if (result.workflow) {
        setWorkflow(result.workflow);
        setParamValues(seedParams(result.workflow));
      }
      if (result.validation.ok) {
        const warn = result.warnings?.length ? `；警告：${result.warnings.join('; ')}` : '';
        setNotice(`编译通过：${result.workflow?.id ?? 'draft'}${warn}`);
      } else {
        setError(`编译草稿未通过校验：${(result.validation.errors ?? []).join('; ') || 'unknown'}`);
      }
    } catch (err) {
      setError(compileErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleValidate() {
    setBusy('validate');
    setError(null);
    setNotice(null);
    try {
      const next = await validateWorkflowYAML(yaml);
      setWorkflow(next);
      setParamValues((prev) => ({ ...seedParams(next), ...prev }));
      setNotice(`校验通过：${next.id} v${next.version}`);
    } catch (err) {
      setError(messageFromError(err, '校验失败'));
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      const validated = await validateWorkflowYAML(yaml);
      const saved = await saveWorkflow(validated.id, yaml);
      setWorkflow(saved);
      setParamValues((prev) => ({ ...seedParams(saved), ...prev }));
      setNotice(`已保存 ${saved.id}`);
      await refreshMeta();
    } catch (err) {
      setError(messageFromError(err, '保存失败'));
    } finally {
      setBusy(null);
    }
  }

  async function handlePublish() {
    setBusy('publish');
    setError(null);
    setNotice(null);
    try {
      const validated = await validateWorkflowYAML(yaml);
      await saveWorkflow(validated.id, yaml);
      const m = await publishWorkflow(validated.id);
      setWorkflow(validated);
      setNotice(`已发布 Manifest ${m.id} v${m.version}（params: ${Object.keys(m.params).join(', ') || 'none'}）`);
      await refreshMeta();
    } catch (err) {
      setError(messageFromError(err, '发布失败'));
    } finally {
      setBusy(null);
    }
  }

  async function handleLoad(id: string) {
    setBusy('load');
    setError(null);
    try {
      const [loaded, text] = await Promise.all([getWorkflow(id), getWorkflowYAML(id)]);
      setWorkflow(loaded);
      setYaml(text);
      setIntent(loaded.description?.trim() || '');
      setParamValues(seedParams(loaded));
      setRun(null);
      setSelectedStepId(null);
      setNotice(`已加载 ${loaded.id} — 直接点「运行」即可（不必编译）`);
    } catch (err) {
      setError(messageFromError(err, '加载失败'));
    } finally {
      setBusy(null);
    }
  }

  async function handleRun() {
    setBusy('run');
    setError(null);
    setNotice(null);
    try {
      const validated = await validateWorkflowYAML(yaml);
      await saveWorkflow(validated.id, yaml);
      setWorkflow(validated);
      const params = buildRunParams(validated, paramValues);
      const nextRun = await startRun(validated.id, params);
      setRun(nextRun);
      setSelectedStepId(nextRun.stepRuns[0]?.stepId ?? null);
      setNotice(`执行中 ${nextRun.id}…（CLI 可能要几秒）`);
      await refreshMeta();
    } catch (err) {
      setError(messageFromError(err, '运行失败'));
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove(decision: 'approve' | 'reject') {
    if (!run || !pendingApproval) {
      return;
    }
    setBusy('approve');
    setError(null);
    try {
      await approveRun(run.id, pendingApproval.stepId, decision);
      await refreshRun(run.id);
      setNotice(decision === 'approve' ? '已批准，继续执行' : '已拒绝');
    } catch (err) {
      setError(messageFromError(err, '审批失败'));
    } finally {
      setBusy(null);
    }
  }

  async function handleHumanHelp(ok: boolean) {
    if (!run || !pendingHumanHelp) {
      return;
    }
    setBusy('human-help');
    setError(null);
    try {
      await resolveHumanHelp(run.id, pendingHumanHelp.stepId, ok, ok ? 'console resolved' : 'console rejected');
      await refreshRun(run.id);
      setNotice(ok ? '人工协助已完成，继续执行' : '人工协助已拒绝');
    } catch (err) {
      setError(messageFromError(err, '人工协助失败'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="console-shell">
      <header className="console-topbar">
        <a className="brand-lockup" href="#workspace" aria-label="Helios console">
          <span className="brand-mark">
            <img src="./helios-logo-square.png" alt="" aria-hidden="true" />
          </span>
          <span>
            <strong>Helios</strong>
            <small>Workflow Runtime</small>
          </span>
        </a>
        <div className="topbar-actions">
          <StatusChip label="API" value={online ? 'online' : 'offline'} tone={online ? 'ok' : 'warn'} />
          <StatusChip label="CLIs" value={String(clis.length)} tone={clis.length ? 'ok' : 'idle'} />
          <StatusChip label="Run" value={run?.status ?? 'idle'} tone={runTone(run?.status)} />
          <Button type="button" variant="secondary" onClick={() => void refreshMeta()}>
            <RefreshCw size={16} />
            刷新
          </Button>
        </div>
      </header>

      <section className="console-hero" id="workspace">
        <h1>左侧选剧本 → 运行 → 右侧看结果</h1>
        <p className="hero-hint">「编译」可选（需 Pi sidecar）。试玩请直接加载 opencli.* / feishu.* 再运行。</p>
      </section>

      {error ? (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div className="notice-banner" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      ) : null}

      <section className="ops-grid" aria-label="Helios 操作台">
        <Panel className="ops-side">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Catalog</p>
              <h2>工作流 / CLI</h2>
            </div>
          </div>
          <div className="side-block">
            <strong>Workflows</strong>
            <ul className="side-list">
              {workflows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`side-link ${workflow?.id === item.id ? 'active' : ''}`}
                    onClick={() => void handleLoad(item.id)}
                  >
                    {item.id}
                    <small>v{item.version}</small>
                  </button>
                </li>
              ))}
              {workflows.length === 0 ? <li className="empty-line">暂无已保存工作流</li> : null}
            </ul>
          </div>
          <div className="side-block">
            <strong>Registered CLIs</strong>
            <ul className="side-list">
              {clis.map((cli) => (
                <li key={cli.name}>
                  <span className="side-static">
                    {cli.name}
                    <small>{cli.version}</small>
                  </span>
                </li>
              ))}
              {clis.length === 0 ? <li className="empty-line">请先 register-lark / register-opencli</li> : null}
            </ul>
          </div>
        </Panel>

        <Panel className="ops-main">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Compile（可选）</p>
              <h2>Intent → YAML</h2>
            </div>
            <Badge>{workflow?.id ?? 'unsaved'}</Badge>
          </div>
          <Textarea
            aria-label="Compile intent"
            className="intent-editor"
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            placeholder="可选：用自然语言生成新 YAML（需 ./scripts/dev-pi-sidecar.sh）"
            rows={3}
          />
          <div className="builder-actions">
            <Button type="button" variant="secondary" onClick={() => void handleCompile()} disabled={!!busy || !intent.trim()}>
              {busy === 'compile' ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              编译
            </Button>
          </div>
          <div className="panel-header compact" style={{ marginTop: '1rem' }}>
            <div>
              <p className="eyebrow">Artifact</p>
              <h2>Workflow YAML</h2>
            </div>
          </div>
          {workflow?.description ? <p className="wf-desc">{workflow.description}</p> : null}
          <Textarea
            aria-label="Workflow YAML"
            className="yaml-editor"
            value={yaml}
            onChange={(event) => setYaml(event.target.value)}
            spellCheck={false}
          />
          <div className="builder-actions">
            <Button type="button" variant="secondary" onClick={() => void handleValidate()} disabled={!!busy}>
              {busy === 'validate' ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
              校验
            </Button>
            <Button type="button" variant="secondary" onClick={() => void handleSave()} disabled={!!busy}>
              {busy === 'save' ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
              保存
            </Button>
            <Button type="button" variant="secondary" onClick={() => void handlePublish()} disabled={!!busy}>
              {busy === 'publish' ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
              发布
            </Button>
            {paramEntries.map(([name, spec]) => (
              <label key={name} className="param-field">
                <span>
                  {name}
                  {spec.required ? ' *' : ''}
                </span>
                <Input
                  value={paramValues[name] ?? ''}
                  onChange={(event) => setParamValues((prev) => ({ ...prev, [name]: event.target.value }))}
                  aria-label={name}
                  placeholder={spec.description || name}
                />
              </label>
            ))}
            <Button type="button" variant="primary" onClick={() => void handleRun()} disabled={!!busy || missingRequired || runInFlight}>
              {busy === 'run' || runInFlight ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
              {runInFlight ? '执行中…' : '运行'}
            </Button>
          </div>
          {workflow ? (
            <ol className="step-outline">
              {workflow.steps.map((step) => (
                <li key={step.id}>
                  <strong>{step.id}</strong>
                  <span>
                    {step.uses}
                    {step.cli ? ` · ${step.cli}` : ''}
                    {step.argv?.length ? ` · ${step.argv.join(' ')}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </Panel>

        <Panel className="ops-run">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Run</p>
              <h2>{run?.id ?? '尚未运行'}</h2>
            </div>
            <Badge>{run?.status ?? 'idle'}</Badge>
          </div>

          {runInFlight ? (
            <div className="progress-card" role="status">
              <Loader2 size={16} className="spin" />
              <span>正在执行 CLI，请稍候… 完成后结果会直接显示在下方。</span>
            </div>
          ) : null}

          {pendingApproval ? (
            <div className="approval-card">
              <p>{pendingApproval.prompt || `步骤 ${pendingApproval.stepId} 等待审批`}</p>
              <div className="builder-actions">
                <Button type="button" variant="primary" onClick={() => void handleApprove('approve')} disabled={!!busy}>
                  批准
                </Button>
                <Button type="button" variant="secondary" onClick={() => void handleApprove('reject')} disabled={!!busy}>
                  拒绝
                </Button>
              </div>
            </div>
          ) : null}

          {pendingHumanHelp ? (
            <div className="approval-card">
              <p>{pendingHumanHelp.prompt || `步骤 ${pendingHumanHelp.stepId} 等待人工协助`}</p>
              {typeof pendingHumanHelp.output?.viewerUrl === 'string' && pendingHumanHelp.output.viewerUrl ? (
                <p>
                  <a href={pendingHumanHelp.output.viewerUrl as string} target="_blank" rel="noreferrer">
                    打开协助页面
                  </a>
                </p>
              ) : null}
              <div className="builder-actions">
                <Button type="button" variant="primary" onClick={() => void handleHumanHelp(true)} disabled={!!busy}>
                  已处理
                </Button>
                <Button type="button" variant="secondary" onClick={() => void handleHumanHelp(false)} disabled={!!busy}>
                  放弃
                </Button>
              </div>
            </div>
          ) : null}

          <ul className="run-timeline">
            {(run?.stepRuns ?? []).map((step) => (
              <li key={step.stepId}>
                <button
                  type="button"
                  className={`timeline-item ${selectedStep?.stepId === step.stepId ? 'active' : ''}`}
                  onClick={() => setSelectedStepId(step.stepId)}
                >
                  <span className={`tone ${stepTone(step.status)}`}>{step.status}</span>
                  <strong>{step.stepId}</strong>
                  <small>{step.uses}</small>
                </button>
              </li>
            ))}
            {!run ? <li className="empty-line">加载剧本后点「运行」</li> : null}
          </ul>

          {selectedStep ? (
            <div className="evidence-card">
              <div className="subhead">
                <strong>{selectedStep.stepId}</strong>
                <Badge>{selectedStep.status}</Badge>
              </div>
              {selectedStep.error ? <p className="error-line">{selectedStep.error}</p> : null}
              {typeof selectedStep.output?.viewerUrl === 'string' && selectedStep.output.viewerUrl ? (
                <p className="viewer-link">
                  <a href={selectedStep.output.viewerUrl as string} target="_blank" rel="noreferrer">
                    打开协助 / 查看页
                  </a>
                </p>
              ) : null}

              <StepResult step={selectedStep} />

              {selectedStep.status === 'PENDING' || selectedStep.status === 'RUNNING' ? (
                <p className="empty-line">等待执行…</p>
              ) : null}

              {selectedEvidence.length > 0 ? (
                selectedEvidence.map((item) => (
                  <div key={item.id} className="evidence-item">
                    <div className="evidence-meta">
                      exit {item.exitCode ?? '—'} · {item.type}
                    </div>
                    {run && item.screenshotRef ? (
                      <figure className="evidence-shot">
                        <img src={runFileURL(run.id, item.screenshotRef)} alt={`${item.stepId} screenshot`} />
                        <figcaption>{item.screenshotRef}</figcaption>
                      </figure>
                    ) : null}
                    {run && item.stdoutRef ? (
                      <p className="evidence-file">
                        <a href={runFileURL(run.id, item.stdoutRef)} target="_blank" rel="noreferrer">
                          原始 stdout
                        </a>
                      </p>
                    ) : null}
                    {run && item.stderrRef ? (
                      <p className="evidence-file">
                        <a href={runFileURL(run.id, item.stderrRef)} target="_blank" rel="noreferrer">
                          stderr
                        </a>
                      </p>
                    ) : null}
                  </div>
                ))
              ) : null}
            </div>
          ) : null}
        </Panel>
      </section>
    </main>
  );
}

function StepResult({ step }: { step: StepRun }) {
  const output = step.output;
  if (!output || step.status !== 'COMPLETED') {
    return null;
  }

  const data = output.data;
  const rows = summarizeRows(data);
  if (rows.length > 0) {
    return (
      <div className="result-panel">
        <p className="result-label">结果（{rows.length}）</p>
        <ol className="result-list">
          {rows.map((row) => (
            <li key={row.key}>
              {row.href ? (
                <a href={row.href} target="_blank" rel="noreferrer">
                  {row.title}
                </a>
              ) : (
                <span>{row.title}</span>
              )}
              {row.meta ? <small>{row.meta}</small> : null}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="result-panel">
      <p className="result-label">输出</p>
      <pre className="result-json">{JSON.stringify(preferData(output), null, 2)}</pre>
    </div>
  );
}

function preferData(output: Record<string, unknown>) {
  if ('data' in output) {
    return output.data;
  }
  return output;
}

function summarizeRows(data: unknown): Array<{ key: string; title: string; href?: string; meta?: string }> {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.slice(0, 20).map((item, index) => {
    if (!item || typeof item !== 'object') {
      return { key: String(index), title: String(item) };
    }
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? row.name ?? row.summary ?? row.text ?? row.id ?? `item ${index + 1}`);
    const href = typeof row.url === 'string' ? row.url : typeof row.link === 'string' ? row.link : undefined;
    const metaParts = [row.author, row.score != null ? `score ${row.score}` : null, row.rank != null ? `#${row.rank}` : null].filter(
      Boolean,
    );
    return {
      key: String(row.id ?? index),
      title,
      href,
      meta: metaParts.length ? metaParts.join(' · ') : undefined,
    };
  });
}

function seedParams(wf: Workflow): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, spec] of Object.entries(wf.params ?? {})) {
    if (name === 'lead_id') {
      out[name] = 'L-123';
    } else if (name === 'chat_id') {
      out[name] = '';
    } else {
      out[name] = '';
    }
    void spec;
  }
  return out;
}

function buildRunParams(wf: Workflow, values: Record<string, string>): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const name of Object.keys(wf.params ?? {})) {
    const raw = String(values[name] ?? '').trim();
    if (raw !== '') {
      params[name] = raw;
    }
  }
  return params;
}

function isTerminal(status: WorkflowRun['status']) {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'ABORTED';
}

function runTone(status?: WorkflowRun['status']): 'ok' | 'warn' | 'idle' {
  if (!status) {
    return 'idle';
  }
  if (status === 'COMPLETED') {
    return 'ok';
  }
  if (status === 'FAILED' || status === 'ABORTED') {
    return 'warn';
  }
  return 'ok';
}

function stepTone(status: string) {
  if (status === 'COMPLETED') {
    return 'ok';
  }
  if (status === 'FAILED' || status === 'ABORTED') {
    return 'bad';
  }
  if (status === 'WAITING_APPROVAL' || status === 'WAITING_HUMAN' || status === 'RUNNING') {
    return 'live';
  }
  return 'idle';
}

function StatusChip({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'idle' }) {
  return (
    <span className={`status-chip ${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function compileErrorMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/8091|pi sidecar|connection refused|ECONNREFUSED|unreachable/i.test(msg)) {
    return '编译需要 Pi sidecar。另开终端执行：HELIOS_PI_MODE=mock ./scripts/dev-pi-sidecar.sh — 或跳过编译，左侧直接选剧本运行。';
  }
  return messageFromError(err, '编译失败');
}

function messageFromError(err: unknown, fallback: string) {
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return 'Runtime API 未连接。先启动后端再刷新。';
  }
  return err instanceof Error ? err.message : fallback;
}
