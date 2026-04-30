import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * StorageService generates presigned S3-compatible URLs.
 *
 * Storage key format (enforced here — not in controllers or services):
 *   documents/{organizationId}/{projectId}/{documentId}/{fileName}
 *
 * In Phase 1, if no S3 SDK is configured, methods return stub URLs so the
 * rest of the platform remains functional during local development.
 * Wire a real AWS SDK / Supabase Storage client in Phase 3.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('storage.bucket') ?? 'storyos-documents';
    this.region = this.config.get<string>('storage.region') ?? 'ca-central-1';
    this.endpoint = this.config.get<string | undefined>('storage.endpoint');
  }

  /**
   * Builds the canonical storage key for a document.
   * Rule: documents/{organizationId}/{projectId|"org"}/{documentId}/{fileName}
   */
  buildKey(params: {
    organizationId: string;
    projectId: string | null;
    documentId: string;
    fileName: string;
  }): string {
    const projectSegment = params.projectId ?? 'org';
    return `documents/${params.organizationId}/${projectSegment}/${params.documentId}/${params.fileName}`;
  }

  /**
   * Returns a presigned PUT URL for client-side direct upload.
   * Phase 1 stub — returns a placeholder URL in development.
   * Replace with real AWS S3 SDK call in Phase 3.
   */
  async getUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    if (this.endpoint) {
      this.logger.warn('Real S3 presigned URL generation is not yet implemented (Phase 3).');
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}?presigned-stub=true&expires=${expiresInSeconds}&contentType=${encodeURIComponent(contentType)}`;
  }

  /**
   * Returns a presigned GET URL for temporary read access.
   * Phase 1 stub — replace in Phase 3.
   */
  async getDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}?presigned-stub=true&expires=${expiresInSeconds}`;
  }
}
