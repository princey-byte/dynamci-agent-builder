'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
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
    } catch (err: any) {
      setError(err.message || 'Failed to upload skill');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Skills</span>
        </button>
        <h2 className="text-xl font-bold text-slate-100">Upload Domain Skill Document</h2>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-5">
        {/* File Drag Drop Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Upload .md or .txt File
          </label>
          <div className="border-2 border-dashed border-[#1e293b] hover:border-indigo-500/50 rounded-xl p-6 text-center cursor-pointer bg-[#090d16] transition-colors relative">
            <input
              type="file"
              accept=".md,.txt,.markdown"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <FileCode className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-200">
              {file ? file.name : 'Click to upload or drag & drop .md / .txt file'}
            </p>
            <p className="text-xs text-slate-500 mt-1">SOP manuals, guides, guidelines, API specs</p>
          </div>
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-[#1e293b]"></div>
          <span className="flex-shrink mx-4 text-xs font-mono text-slate-500 uppercase">OR Paste Raw Text</span>
          <div className="flex-grow border-t border-[#1e293b]"></div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Skill Title
          </label>
          <input
            type="text"
            required
            placeholder="e.g. OWASP Security Audit SOP Guide"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Document Type
          </label>
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value as any)}
            className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            <option value="markdown">Markdown (.md)</option>
            <option value="text">Raw Text (.txt)</option>
          </select>
        </div>

        {!file && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Skill Content
            </label>
            <textarea
              rows={8}
              placeholder="Paste raw Markdown or SOP instructions here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={uploading}
            className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Ingesting Skill...' : 'Ingest Skill File'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
