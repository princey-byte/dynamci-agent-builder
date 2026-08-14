'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { FileType } from '../../../../lib/types';
import { ArrowLeft, Upload, FileCode } from 'lucide-react';

export default function UploadSkillPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [fileType, setFileType] = useState<'markdown' | 'text'>('markdown');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name);
      }
      const ext = selected.name.toLowerCase();
      if (ext.endsWith('.md') || ext.endsWith('.markdown')) {
        setFileType('markdown');
      } else {
        setFileType('text');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setError(null);

    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title || file.name);
        await api.uploadSkillFile(formData);
      } else {
        if (!content) {
          throw new Error('Please enter skill document content or upload a file.');
        }
        await api.createSkill({
          title,
          content,
          file_type: fileType,
        });
      }
      router.push('/skills');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload skill');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Skills</span>
        </button>
        <h2 className="text-xl font-bold text-foreground">Upload Domain Skill Document</h2>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-5">
        {/* File Drag Drop Input */}
        <div>
          <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
            Upload .md or .txt File
          </label>
          <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer bg-background transition-colors relative">
            <input
              type="file"
              accept=".md,.txt,.markdown"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <FileCode className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">
              {file ? file.name : 'Click to upload or drag & drop .md / .txt file'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">SOP manuals, guides, guidelines, API specs</p>
          </div>
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink mx-4 text-xs font-mono text-muted-foreground uppercase">OR Paste Raw Text</span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
            Skill Title
          </label>
          <input
            type="text"
            required
            placeholder="e.g. OWASP Security Audit SOP Guide"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-ring"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
            Document Type
          </label>
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value as FileType)}
            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-ring"
          >
            <option value="markdown">Markdown (.md)</option>
            <option value="text">Raw Text (.txt)</option>
          </select>
        </div>

        {!file && (
          <div>
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
              Skill Content
            </label>
            <textarea
              rows={8}
              placeholder="Paste raw Markdown or SOP instructions here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-ring"
            />
          </div>
        )}

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={uploading}
            className="flex items-center space-x-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-medium text-sm rounded-lg shadow-lg shadow-primary/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Ingesting Skill...' : 'Ingest Skill File'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
