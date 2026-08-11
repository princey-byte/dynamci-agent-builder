'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Skill } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FileCode, Plus, Trash2, Upload, FileText } from 'lucide-react';

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
    loadSkills();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this skill file?')) {
      await api.deleteSkill(id);
      loadSkills();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Skills Library</h1>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic SOP ingestion. Attach Markdown (.md) or text (.txt) files directly to agents.
          </p>
        </div>
        <Link
          href="/skills/upload"
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-md shadow-indigo-600/20 transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Skill Document</span>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-[#111726] border border-[#1e293b] rounded-xl animate-pulse" />
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
            <div
              key={skill.id}
              className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100 truncate max-w-[180px]">
                        {skill.title}
                      </h3>
                      <span className="text-[10px] uppercase font-mono text-slate-400">
                        {skill.file_type} document
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#090d16] p-3 rounded-lg border border-[#1e293b] text-xs font-mono text-slate-400 line-clamp-3 leading-relaxed">
                  {skill.content}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1e293b] text-xs text-slate-500 font-mono">
                <span>{new Date(skill.created_at).toLocaleDateString()}</span>
                <button
                  onClick={() => handleDelete(skill.id)}
                  className="text-slate-400 hover:text-red-400 p-1 rounded"
                  title="Delete Skill"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
