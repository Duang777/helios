import { BadgeCheck, ClipboardCheck, FileText, ShieldCheck } from 'lucide-react';
import type { AgentRole, AppPage, Evidence, WorkflowNode, WorkflowRun, WorkflowTemplate } from '../api/types';
import { Input } from './ui/primitives';

interface DetailPanelsProps {
  workflow: WorkflowTemplate | null;
  run: WorkflowRun | null;
  selectedNode: WorkflowNode | null;
}

export function DetailPanels({ workflow, run, selectedNode }: DetailPanelsProps) {
  const role = workflow?.agentRoles.find((agent) => agent.id === selectedNode?.agentRoleId) ?? null;
  const appPage = workflow?.appPages.find((page) => page.nodeId === selectedNode?.id) ?? null;
  const evidence = run?.evidence.filter((item) => item.nodeId === selectedNode?.id) ?? [];

  return (
    <div className="details-grid">
      <AgentCard role={role} selectedNode={selectedNode} />
      <MiniAppCard appPage={appPage} />
      <EvidenceCard evidence={evidence} />
      <ReportCard workflow={workflow} run={run} />
    </div>
  );
}

function AgentCard({ role, selectedNode }: { role: AgentRole | null; selectedNode: WorkflowNode | null }) {
  return (
    <section className="panel detail-panel">
      <div className="detail-title">
        <ShieldCheck size={18} />
        <h3>Scoped Agent</h3>
      </div>
      {role && selectedNode ? (
        <>
          <p className="strong-line">{role.name}</p>
          <p className="muted-line">{role.scope}</p>
          <div className="tag-row">
            {role.permissions.map((permission) => (
              <span className="tag" key={permission}>{permission}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-line">Select a node</div>
      )}
    </section>
  );
}

function MiniAppCard({ appPage }: { appPage: AppPage | null }) {
  return (
    <section className="panel detail-panel mini-app-panel">
      <div className="detail-title">
        <ClipboardCheck size={18} />
        <h3>Mini App</h3>
      </div>
      {appPage ? (
        <>
          <p className="strong-line">{appPage.title}</p>
          {appPage.fields?.map((field) => (
            <label className="field-preview" key={field.id}>
              <span>{field.label}</span>
              <Input disabled placeholder={field.type} />
            </label>
          ))}
          {appPage.sections?.map((section) => (
            <div className="section-preview" key={section.title}>
              <p>{section.title}</p>
              {section.items.map((item) => <span key={item}>{item}</span>)}
            </div>
          ))}
        </>
      ) : (
        <div className="empty-line">No generated surface for this node</div>
      )}
    </section>
  );
}

function EvidenceCard({ evidence }: { evidence: Evidence[] }) {
  return (
    <section className="panel detail-panel evidence-panel">
      <div className="detail-title">
        <BadgeCheck size={18} />
        <h3>Evidence Ledger</h3>
      </div>
      {evidence.length > 0 ? evidence.map((item) => (
        <article className="evidence-item" key={item.id}>
          <div className="confidence-ring">{Math.round(item.confidence * 100)}</div>
          <p>{item.claim}</p>
          <div className="source-row">
            {item.sources.map((source) => <span key={source}>{source}</span>)}
          </div>
        </article>
      )) : <div className="empty-line">Run the workflow to capture evidence</div>}
    </section>
  );
}

function ReportCard({ workflow, run }: { workflow: WorkflowTemplate | null; run: WorkflowRun | null }) {
  return (
    <section className="panel detail-panel report-panel">
      <div className="detail-title">
        <FileText size={18} />
        <h3>Scenario Report</h3>
      </div>
      {workflow ? (
        <div className="report-copy">
          <p><strong>Kernel:</strong> Helios compiles goals into executable, auditable workflows.</p>
          <p><strong>Shell:</strong> {workflow.scenario === 'skuflow' ? 'SKUFlow for high-volume new product decisions.' : 'Generic business operation workflow.'}</p>
          <p><strong>Audit:</strong> {run ? `${run.nodeRuns.length} nodes, ${run.evidence.length} evidence records, ${run.artifacts.length} artifacts.` : 'Pending first run.'}</p>
        </div>
      ) : (
        <div className="empty-line">Compile a goal</div>
      )}
    </section>
  );
}
