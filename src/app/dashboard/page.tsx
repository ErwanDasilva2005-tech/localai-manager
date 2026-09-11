'use client';

import { useEffect, useState,useRef } from 'react';
import type { LocalModel } from '@/types';
import { testOllamaModel, checkOllamaHealth } from '@/lib/ollama';
import { testViaGateway } from '@/lib/gateway';

export default function Dashboard() {
  const [models, setModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');

  const outputRef = useRef<HTMLParagraphElement | null>(null);



  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editProvider, setEditProvider] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState('Write a 1-sentence motivation letter.');
  const [testOutput, setTestOutput] = useState('');
  const [testError, setTestError] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null); // null = checking

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

  useEffect(() => {
  async function poll() {
    const online = await checkOllamaHealth();
    setOllamaOnline(online);
  }
  poll(); // check immediately on mount
  const interval = setInterval(poll, 10000); // then every 10s
  return () => clearInterval(interval);
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

  useEffect(() => {
  if (outputRef.current) {
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }
}, [testOutput]);

  function startEdit(model: LocalModel) {
    setEditingId(model.id);
    setEditName(model.name);
    setEditProvider(model.provider);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditProvider('');
  }

  async function handleUpdate(id: string) {
    if (!editName.trim() || !editProvider.trim()) return;

    setError(null);
    try {
      const res = await fetch(`/api/models/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, provider: editProvider, config: {} }),
      });
      if (!res.ok) throw new Error('Failed to update model');

      cancelEdit();
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/models/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete model');
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDeletingId(null);
    }
  }

  function openTest(id: string) {
  setTestingId(id);
  setTestOutput('');
  setTestError(null);
}

function closeTest() {
  abortRef.current?.abort();
  setTestingId(null);
  setTestOutput('');
  setTestError(null);
  setTestRunning(false);
}

async function runTest(modelName: string) {
  setTestRunning(true);
  setTestOutput('');
  setTestError(null);

  const controller = new AbortController();
  abortRef.current = controller;

  const result = await testViaGateway(
    modelName,
    testPrompt,
    (partial) => setTestOutput(partial),
    controller.signal
  );

  if (!result.success && result.error !== 'Request cancelled') {
    setTestError(result.error ?? 'Something went wrong');
  }
  setTestRunning(false);
}

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          Your Local AI Models
        </h1>
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              ollamaOnline === null
                ? 'bg-gray-300'
                : ollamaOnline
                ? 'bg-green-500'
                : 'bg-red-500'
            }`}
          />
          <span className="text-gray-600">
            {ollamaOnline === null
              ? 'Checking Ollama...'
              : ollamaOnline
              ? 'Ollama online'
              : 'Ollama offline'}
          </span>
        </div>
      </div>

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
                className="rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                {editingId === model.id ? (
                  // Edit mode
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editProvider}
                      onChange={(e) => setEditProvider(e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(model.id)}
                        className="rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-800"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{model.name}</p>
                      <p className="text-sm text-gray-500">{model.provider}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {new Date(model.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => startEdit(model)}
                        className="text-sm font-medium text-gray-600 hover:text-gray-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(model.id)}
                        disabled={deletingId === model.id}
                        className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {deletingId === model.id ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                       onClick={() => openTest(model.id)}
                       className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                         Test
                        </button>
                    </div>
                  </div>
                  
                )}
                {testingId === model.id && (
                  <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                    <textarea
                      value={testPrompt}
                      onChange={(e) => setTestPrompt(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
                      placeholder="Enter a prompt..."
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => runTest(model.name)}
                        disabled={testRunning}
                        className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {testRunning ? 'Generating...' : 'Send Prompt'}
                      </button>

                      {testRunning && (
                        <button
                          onClick={() => abortRef.current?.abort()}
                          className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                        >
                          Stop
                        </button>
                      )}

                      <button
                        onClick={closeTest}
                        className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-white"
                      >
                        Close
                      </button>
                    </div>

                    {testError && (
                      <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-sm text-red-700">
                        {testError}
                      </p>
                    )}

                     {testOutput && (
                      <p
                        ref={outputRef}
                        className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-white p-2 text-sm text-gray-800"
                      >
                        {testOutput}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}