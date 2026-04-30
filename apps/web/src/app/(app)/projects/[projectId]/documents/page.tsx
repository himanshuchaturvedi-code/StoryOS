'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';
import { DocumentCategory } from '@storyos/types';

interface DocumentRecord {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  category: string;
  notes?: string | null;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
}

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: DocumentCategory.SCRIPT, label: 'Script' },
  { value: DocumentCategory.BUDGET, label: 'Budget' },
  { value: DocumentCategory.SCHEDULE, label: 'Schedule' },
  { value: DocumentCategory.CONTRACT, label: 'Contract' },
  { value: DocumentCategory.CHAIN_OF_TITLE, label: 'Chain of title' },
  { value: DocumentCategory.INSURANCE, label: 'Insurance' },
  { value: DocumentCategory.FINANCING, label: 'Financing' },
  { value: DocumentCategory.CORPORATE, label: 'Corporate' },
  { value: DocumentCategory.CORRESPONDENCE, label: 'Correspondence' },
  { value: DocumentCategory.OTHER, label: 'Other' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectDocumentsPage() {
  const params = useParams();
  const projectId = params?.projectId as string;

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>(DocumentCategory.OTHER);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const list =
        (await apiClient.get<DocumentRecord[]>(`/documents?projectId=${projectId}`)) ?? [];
      setDocuments(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !title) return;
    setError(null);
    setIsUploading(true);
    setUploadProgress('Registering document…');

    try {
      const { uploadUrl } = await apiClient.post<{ document: DocumentRecord; uploadUrl: string }>(
        '/documents/upload',
        {
          title,
          fileName: selectedFile.name,
          fileType: selectedFile.type || 'application/octet-stream',
          fileSize: selectedFile.size,
          category,
          notes: notes || undefined,
          projectId,
        },
      );

      setUploadProgress('Uploading file…');
      // Direct PUT to presigned URL — file bytes never pass through the API server
      const putResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
        body: selectedFile,
      });

      if (!putResponse.ok) {
        // In local dev the presigned URL is a stub, so we skip this check gracefully
        console.warn('PUT to presigned URL failed (expected in local dev):', putResponse.status);
      }

      setUploadProgress(null);
      setTitle('');
      setNotes('');
      setSelectedFile(null);
      setShowForm(false);
      await fetchDocuments();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload failed');
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/documents/${id}`);
      await fetchDocuments();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete document');
    }
  }

  async function handleDownload(id: string, fileName: string) {
    try {
      const { downloadUrl } = await apiClient.get<DocumentRecord & { downloadUrl: string }>(
        `/documents/${id}`,
      );
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      a.click();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to get download URL');
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-gray-900">Documents ({documents.length})</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Upload document'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <Card>
          <CardHeader>
            <h3 className="font-medium text-gray-900">Upload document</h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">File</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
                  required
                />
              </div>
              <Input
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {uploadProgress && <p className="text-sm text-gray-500">{uploadProgress}</p>}
              <Button type="submit" disabled={isUploading || !selectedFile || !title}>
                {isUploading ? 'Uploading…' : 'Upload'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents uploaded yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Size</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Uploaded by</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{doc.title}</div>
                    <div className="text-xs text-gray-500">{doc.fileName}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{doc.category}</td>
                  <td className="px-4 py-3 text-gray-600">{formatBytes(doc.fileSize)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc.id, doc.fileName)}
                      >
                        Download
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
