'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';
import { DocumentCategory } from '@storyos/types';
import {
  DocumentTagFields,
  tagValueFromDocument,
  toTagPayload,
  type DocumentTagValue,
} from '@/components/project/document-tag-fields';
import { formatDocumentTagDisplay } from '@/lib/program-document-catalog';

interface DocumentRecord {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  category: string;
  notes?: string | null;
  programCode?: string | null;
  programDocumentCode?: string | null;
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string };
}

const EMPTY_TAG: DocumentTagValue = { programCode: '', programDocumentCode: '' };

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

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>(DocumentCategory.OTHER);
  const [notes, setNotes] = useState('');
  const [uploadTag, setUploadTag] = useState<DocumentTagValue>(EMPTY_TAG);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTag, setEditTag] = useState<DocumentTagValue>(EMPTY_TAG);
  const [isSavingTag, setIsSavingTag] = useState(false);

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

  function resetUploadForm() {
    setTitle('');
    setNotes('');
    setUploadTag(EMPTY_TAG);
    setSelectedFile(null);
    setCategory(DocumentCategory.OTHER);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !title) return;
    if (uploadTag.programCode && !uploadTag.programDocumentCode) {
      setError('Select a requirement when tagging to a program.');
      return;
    }
    setError(null);
    setIsUploading(true);
    setUploadProgress('Registering document…');

    try {
      const tagPayload = toTagPayload(uploadTag);
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
          ...('programCode' in tagPayload && tagPayload.programCode
            ? tagPayload
            : {}),
        },
      );

      const isStubUpload = uploadUrl.includes('presigned-stub=true');
      if (!isStubUpload) {
        setUploadProgress('Uploading file…');
        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
          body: selectedFile,
        });

        if (!putResponse.ok) {
          console.warn('PUT to presigned URL failed:', putResponse.status);
        }
      }

      setUploadProgress(null);
      resetUploadForm();
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
      if (editingDocId === id) setEditingDocId(null);
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

  function startEditTag(doc: DocumentRecord) {
    setEditingDocId(doc.id);
    setEditTag(tagValueFromDocument(doc));
    setError(null);
  }

  function cancelEditTag() {
    setEditingDocId(null);
    setEditTag(EMPTY_TAG);
  }

  async function handleSaveTag(docId: string) {
    if (editTag.programCode && !editTag.programDocumentCode) {
      setError('Select a requirement when a program is chosen.');
      return;
    }

    setError(null);
    setIsSavingTag(true);
    try {
      await apiClient.patch<DocumentRecord>(`/documents/${docId}`, toTagPayload(editTag));
      setEditingDocId(null);
      setEditTag(EMPTY_TAG);
      await fetchDocuments();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update document tag');
    } finally {
      setIsSavingTag(false);
    }
  }

  async function handleClearTag(docId: string) {
    setError(null);
    setIsSavingTag(true);
    try {
      await apiClient.patch<DocumentRecord>(`/documents/${docId}`, {
        programCode: null,
        programDocumentCode: null,
      });
      setEditingDocId(null);
      setEditTag(EMPTY_TAG);
      await fetchDocuments();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to clear document tag');
    } finally {
      setIsSavingTag(false);
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-gray-900">Documents ({documents.length})</h2>
        <Button onClick={() => setShowForm((value) => !value)}>
          {showForm ? 'Cancel' : 'Upload document'}
        </Button>
      </div>

      <p className="text-sm text-gray-600">
        Tag uploads to a program filing requirement (AMPG or CPTC) so the Application Documents
        checklist can match them precisely.
      </p>

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
              <DocumentTagFields
                value={uploadTag}
                onChange={setUploadTag}
                disabled={isUploading}
                idPrefix="upload"
              />
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
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tagged to</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Size</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Uploaded by</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((doc) => {
                const tagDisplay = formatDocumentTagDisplay(
                  doc.programCode,
                  doc.programDocumentCode,
                );
                const isEditing = editingDocId === doc.id;

                return (
                  <React.Fragment key={doc.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{doc.title}</div>
                        <div className="text-xs text-gray-500">{doc.fileName}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {tagDisplay ?? <span className="text-gray-400">—</span>}
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
                            onClick={() => (isEditing ? cancelEditTag() : startEditTag(doc))}
                          >
                            {isEditing ? 'Cancel' : 'Edit tag'}
                          </Button>
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
                    {isEditing && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="max-w-2xl space-y-3">
                            <p className="text-sm font-medium text-gray-900">
                              Program filing tag for {doc.title}
                            </p>
                            <DocumentTagFields
                              value={editTag}
                              onChange={setEditTag}
                              disabled={isSavingTag}
                              idPrefix={`edit-${doc.id}`}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={isSavingTag}
                                onClick={() => handleSaveTag(doc.id)}
                              >
                                {isSavingTag ? 'Saving…' : 'Save tag'}
                              </Button>
                              {tagDisplay && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isSavingTag}
                                  onClick={() => handleClearTag(doc.id)}
                                >
                                  Clear tag
                                </Button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
