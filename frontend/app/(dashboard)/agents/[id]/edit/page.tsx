'use client';

import React, { useState, useEffect, use } from 'react';
import { api } from '../../../../../lib/api';
import { Agent } from '../../../../../lib/types';
import { AgentForm } from '../../../../../components/agents/AgentForm';

export default function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAgent(resolvedParams.id)
      .then(setAgent)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) {
    return <div className="p-8 text-slate-400 font-mono text-xs">Loading agent details...</div>;
  }

  if (!agent) {
    return <div className="p-8 text-red-400 font-mono text-xs">Agent not found.</div>;
  }

  return <AgentForm initialData={agent} isEdit={true} />;
}
