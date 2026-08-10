'use client';

import { useEffect, useState } from 'react';
import type { LocalModel } from '@/types';

export default function Dashboard() {
  const [models, setModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');

  async function fetchModels() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error('Failed to load models');
      const data = await res.json();
      setModels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchModels();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !provider.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, provider, config: {} }),
      });
      if (!res.ok) throw new Error('Failed to create model');

      setName('');
      setProvider('');
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Your Local AI Models
        </h1>

        {/* Add model form */}
        <form
          onSubmit={handleSubmit}
          className="mb-8 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Llama 3 8B"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Provider
            </label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. ollama"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Model'}
          </button>
        </form>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Models list */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading models...</p>
        ) : models.length === 0 ? (
          <p className="text-sm text-gray-500">
            No models yet — add one above to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {models.map((model) => (
              <li
                key={model.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{model.name}</p>
                  <p className="text-sm text-gray-500">{model.provider}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(model.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}