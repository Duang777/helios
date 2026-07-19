import { CheckCircle2, Clock3, FileArchive, Play, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { WorkflowRun, WorkflowTemplate } from '../api/types';
import { IconButton, Panel } from './ui/primitives';

interface RunPanelProps {
  workflow: WorkflowTemplate | null;
  run: WorkflowRun | null;
  isRunning: boolean;
  onRun: () => void;
}

export function RunPanel({ workflow, run, isRunning, onRun }: RunPanelProps) {
  return (
    <Panel className="run-panel" aria-label="Run panel">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">Runtime</p>
          <h2>{run?.status ?? 'Ready'}</h2>
        </div>
        <IconButton className="primary" type="button" onClick={onRun} disabled={!workflow || isRunning} label="Run workflow">
          {isRunning ? <RotateCw size={18} className="spin" /> : <Play size={18} />}
        </IconButton>
      </div>
      <div className="run-summary-grid" aria-label="Run summary">
        <RunStat icon={<CheckCircle2 size={15} />} label="Completed" value={run?.nodeRuns.length ?? 0} />
        <RunStat icon={<FileArchive size={15} />} label="Artifacts" value={run?.artifacts.length ?? 0} />
        <RunStat icon={<Clock3 size={15} />} label="Approvals" value={run?.approvals.length ?? 0} />
      </div>
      <div className="run-list">
        {(run?.nodeRuns ?? []).map((nodeRun) => (
          <div className="run-row" key={nodeRun.id}>
            <span className="run-dot" />
            <div>
              <strong>{nodeRun.title}</strong>
              <p>{nodeRun.output.summary}</p>
            </div>
            <span className="status-text">{nodeRun.status}</span>
          </div>
        ))}
        {!run ? <div className="empty-line">Waiting for a workflow run</div> : null}
      </div>
    </Panel>
  );
}

function RunStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="run-stat">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
