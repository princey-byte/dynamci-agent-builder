'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Skill } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { FileCode, Trash2, Upload, FileText } from 'lucide-react';

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const data = await api.getSkills();
      setSkills(data || []);
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    api.getSkills()
      .then((data) => {
        if (!ignore) setSkills(data || []);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this skill file?')) {
      await api.deleteSkill(id);
      loadSkills();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Skills Library</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Dynamic SOP ingestion. Attach Markdown (.md) or text (.txt) files directly to agents.
          </p>
        </div>
        <Button render={<Link href="/skills/upload" />}>
          <Upload />
          <span>Upload Skill Document</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <EmptyState
          icon={FileCode}
          title="No Skills Ingested Yet"
          description="Upload Markdown or text SOP files to train your AI agents on domain knowledge."
          actionHref="/skills/upload"
          actionLabel="Upload Skill Document"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {skills.map((skill) => (
            <Card
              key={skill.id}
              className="flex h-full flex-col justify-between transition-colors hover:ring-foreground/20"
            >
              <div>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg border bg-muted text-primary">
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="max-w-[180px] truncate text-sm">{skill.title}</CardTitle>
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">
                          {skill.file_type} document
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="line-clamp-3 rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                    {skill.content}
                  </div>
                </CardContent>
              </div>

              <CardFooter className="justify-between gap-3 font-mono text-xs text-muted-foreground">
                <span>{new Date(skill.created_at).toLocaleDateString()}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(skill.id)}
                  aria-label="Delete skill"
                >
                  <Trash2 />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
