'use client';

import { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { Agent } from '../../../../lib/types';
import { WorkflowBuilder } from '../../../../components/workflows/WorkflowBuilder';

export default function CreateWorkflowPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAgents()
      .then((data) => setAgents(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-slate-400 font-mono text-xs">Loading agents topology...</div>;
  }

  return <WorkflowBuilder availableAgents={agents} />;
}
