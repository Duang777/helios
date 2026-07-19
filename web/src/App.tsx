import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleSlash2,
  FileClock,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { compileWorkflow, listRuntimeAdapters, runWorkflow } from './api/client';
import type { AdapterStatus, WorkflowNode, WorkflowRun, WorkflowTemplate } from './api/types';
import { DetailPanels } from './components/DetailPanels';
import { RunPanel } from './components/RunPanel';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { Badge, Button, DataTable, Panel, Textarea } from './components/ui/primitives';

const defaultGoal = '构建企业业务能力沉淀 Agent：业务人员用自然语言创建客户洞察、项目复盘、合同风险和经营指标任务流，系统按角色权限调度数据与工具，输出带来源、口径、版本和人工确认点的可复用能力模板。';

export function App() {
  const [goal, setGoal] = useState(defaultGoal);
  const [workflow, setWorkflow] = useState<WorkflowTemplate | null>(null);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [adapters, setAdapters] = useState<AdapterStatus[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshAdapters();
  }, []);

  const selectedNode = useMemo<WorkflowNode | null>(() => {
    return workflow?.nodes.find((node) => node.id === selectedNodeId) ?? workflow?.nodes[0] ?? null;
  }, [selectedNodeId, workflow]);

  const availableAdapters = adapters.filter((adapter) => adapter.available).length;
  const blockedAdapters = adapters.length - availableAdapters;

  async function refreshAdapters() {
    try {
      const nextAdapters = await listRuntimeAdapters();
      setAdapters(nextAdapters);
    } catch (err) {
      setError(messageFromError(err, 'Runtime adapter 状态读取失败'));
    }
  }

  async function handleCompile() {
    setIsCompiling(true);
    setError(null);
    try {
      const nextWorkflow = await compileWorkflow(goal);
      setWorkflow(nextWorkflow);
      setRun(null);
      setSelectedNodeId(nextWorkflow.nodes[0]?.id ?? null);
      await refreshAdapters();
    } catch (err) {
      setError(messageFromError(err, '工作流编译失败'));
    } finally {
      setIsCompiling(false);
    }
  }

  async function handleRun() {
    if (!workflow) {
      return;
    }
    setIsRunning(true);
    setError(null);
    try {
      const nextRun = await runWorkflow(workflow.id);
      setRun(nextRun);
      setAdapters(nextRun.adapters ?? adapters);
      const failedNode = nextRun.nodeRuns.find((nodeRun) => nodeRun.status === 'FAILED');
      setSelectedNodeId(failedNode?.nodeId ?? nextRun.nodeRuns.at(-1)?.nodeId ?? selectedNodeId);
    } catch (err) {
      setError(messageFromError(err, '工作流运行失败'));
    } finally {
      setIsRunning(false);
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
            <small>AI Workflow Compiler</small>
          </span>
        </a>
        <div className="topbar-actions" aria-label="运行摘要">
          <StatusChip label="Adapters" value={`${availableAdapters}/${adapters.length || 0}`} tone={blockedAdapters ? 'warn' : 'ok'} />
          <StatusChip label="Workflow" value={workflow ? workflow.scenario : 'draft'} tone={workflow ? 'ok' : 'idle'} />
          <Button type="button" variant="secondary" onClick={refreshAdapters}>
            <RefreshCw size={16} />
            刷新 Adapter
          </Button>
        </div>
      </header>

      <section className="console-hero" id="workspace">
        <div className="hero-kicker">
          <Sparkles size={16} />
          可审计 Runtime 编排工作台
        </div>
        <h1>把一句业务目标编译成可运行、可审批、可追溯的 Agent 工作流。</h1>
      </section>

      {error ? (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="workbench-grid" aria-label="Helios 工作台">
        <Panel className="builder-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Mission</p>
              <h2>工作目标</h2>
            </div>
            <Badge>{workflow ? '已编译' : '草稿'}</Badge>
          </div>
          <Textarea
            aria-label="工作目标"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          />
          <div className="builder-actions">
            <Button type="button" variant="primary" onClick={handleCompile} disabled={isCompiling || goal.trim().length === 0}>
              {isCompiling ? <Loader2 size={16} className="spin" /> : <GitBranch size={16} />}
              编译 Workflow
            </Button>
            <Button type="button" variant="secondary" onClick={handleRun} disabled={!workflow || isRunning}>
              {isRunning ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
              运行
            </Button>
          </div>
          <div className="mission-summary">
            <SummaryTile icon={<Boxes size={16} />} label="Nodes" value={workflow?.nodes.length ?? 0} />
            <SummaryTile icon={<ShieldCheck size={16} />} label="Roles" value={workflow?.agentRoles.length ?? 0} />
            <SummaryTile icon={<FileClock size={16} />} label="Evidence" value={run?.evidence.length ?? 0} />
          </div>
          <AdapterTable adapters={adapters} />
        </Panel>

        <div className="center-stack">
          <WorkflowCanvas
            workflow={workflow}
            selectedNodeId={selectedNode?.id ?? null}
            nodeRuns={run?.nodeRuns ?? []}
            onSelectNode={setSelectedNodeId}
          />
          <SelectedNodePanel node={selectedNode} />
        </div>

        <RunPanel workflow={workflow} run={run} isRunning={isRunning} onRun={handleRun} />
      </section>

      <DetailPanels workflow={workflow} run={run} selectedNode={selectedNode} />
    </main>
  );
}

function AdapterTable({ adapters }: { adapters: AdapterStatus[] }) {
  return (
    <div className="adapter-card" aria-label="Runtime adapter table">
      <div className="subhead">
        <ServerCog size={16} />
        <strong>Runtime Adapters</strong>
      </div>
      <DataTable>
        <thead>
          <tr>
            <th>Adapter</th>
            <th>Kind</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {adapters.map((adapter) => (
            <tr key={adapter.id}>
              <td>
                <strong>{adapter.label}</strong>
                <span>{adapter.reason}</span>
              </td>
              <td>{adapter.kind}</td>
              <td>
                <span className={`adapter-state ${adapter.available ? 'ok' : 'blocked'}`}>
                  {adapter.available ? <CheckCircle2 size={14} /> : <CircleSlash2 size={14} />}
                  {adapter.available ? 'ready' : 'blocked'}
                </span>
              </td>
            </tr>
          ))}
          {adapters.length === 0 ? (
            <tr>
              <td colSpan={3}>等待 Runtime API 返回 adapter 状态</td>
            </tr>
          ) : null}
        </tbody>
      </DataTable>
    </div>
  );
}

function SelectedNodePanel({ node }: { node: WorkflowNode | null }) {
  return (
    <Panel className="selected-node-panel">
      <div className="subhead">
        <ChevronRight size={16} />
        <strong>{node ? node.title : '未选择节点'}</strong>
      </div>
      {node ? (
        <div className="node-contract-grid">
          <ContractBlock label="Agent" value={node.agentRoleId} />
          <ContractBlock label="Adapter" value={node.config?.runtimeAdapter ?? 'deterministic_mvp'} />
          <ContractBlock label="Provider" value={node.config?.provider ?? 'template'} />
          <ContractBlock label="Outputs" value={node.outputs.join(', ')} />
        </div>
      ) : (
        <p className="empty-line">编译后会显示节点合同。</p>
      )}
    </Panel>
  );
}

function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="summary-tile">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusChip({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'idle' }) {
  return (
    <span className={`status-chip ${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function ContractBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="contract-block">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function messageFromError(err: unknown, fallback: string) {
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return 'Runtime API 未连接。静态预览页已加载，启动本地后端后即可编译和运行工作流。';
  }
  return err instanceof Error ? err.message : fallback;
}
