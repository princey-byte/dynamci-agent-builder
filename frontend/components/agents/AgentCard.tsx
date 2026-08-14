import Link from 'next/link';
import type { ComponentProps } from 'react';
import { Agent } from '../../lib/types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Bot, FileCode, Wrench, Trash2, Edit3, Cpu } from 'lucide-react';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

interface AgentCardProps {
  agent: Agent;
  onDelete?: (id: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  return (
    <Card className="flex h-full flex-col justify-between transition-colors hover:ring-foreground/20">
      <div>
        {/* Header */}
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-muted text-primary transition-colors group-hover/card:border-ring">
                <Bot className="size-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{agent.name}</CardTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={agent.role_type}>{agent.role_type}</Badge>
                  <Badge variant={agent.model_provider as BadgeVariant}>{agent.model_provider}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Persona preview */}
        <CardContent className="flex flex-col gap-4">
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{agent.persona}</p>

          {/* Specs */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-2.5 font-mono text-xs">
            <div className="flex min-w-0 items-center gap-1.5 text-foreground">
              <Cpu className="size-3.5 text-muted-foreground" />
              <span className="truncate">{agent.model_name}</span>
            </div>
            <div className="text-right text-muted-foreground">
              Temp: <span className="text-foreground">{agent.temperature}</span>
            </div>
          </div>

          {/* Attached Skills & MCP Tools badges */}
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {agent.skills && agent.skills.length > 0 && (
              <div className="flex items-center gap-1.5">
                <FileCode className="size-3.5 text-primary" />
                <span>{agent.skills.length} Attached Skills</span>
              </div>
            )}
            {agent.mcp_tools && agent.mcp_tools.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Wrench className="size-3.5 text-agent-tool" />
                <span>{agent.mcp_tools.length} Attached MCP Tools</span>
              </div>
            )}
          </div>
        </CardContent>
      </div>

      {/* Footer Actions */}
      <CardFooter className="justify-end gap-2">
        <Button nativeButton={false} variant="ghost" size="icon" render={<Link href={`/agents/${agent.id}/edit`} aria-label="Edit agent" />}>
          <Edit3 />
        </Button>
        {onDelete && (
          <Button variant="ghost" size="icon" onClick={() => onDelete(agent.id)} aria-label="Delete agent">
            <Trash2 />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
