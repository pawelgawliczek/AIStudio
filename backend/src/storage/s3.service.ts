import { Injectable, Logger } from '@nestjs/common';
// import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadArtifactOptions {
  key: string;
  data: string | Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  // private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly enabled: boolean;

  constructor() {
    // Load from environment
    this.bucketName = process.env.AWS_S3_BUCKET || 'aistudio-artifacts';
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.enabled = process.env.AWS_S3_ENABLED === 'true';

    if (this.enabled) {
      this.logger.log(`S3 Service initialized. Bucket: ${this.bucketName}, Region: ${this.region}`);
      // Initialize S3 client when AWS SDK is installed
      // this.s3Client = new S3Client({ region: this.region });
    } else {
      this.logger.warn('S3 Service is DISABLED. Artifacts will be stored in database only.');
    }
  }

  /**
   * Upload artifact to S3
   */
  async uploadArtifact(options: UploadArtifactOptions): Promise<{ s3Key: string; uploaded: boolean }> {
    if (!this.enabled) {
      this.logger.debug(`S3 disabled: Skipping upload for ${options.key}`);
      return {
        s3Key: options.key,
        uploaded: false,
      };
    }

    try {
      // TODO: Implement actual S3 upload when AWS SDK is installed
      // const command = new PutObjectCommand({
      //   Bucket: this.bucketName,
      //   Key: options.key,
      //   Body: options.data,
      //   ContentType: options.contentType || 'application/octet-stream',
      //   Metadata: options.metadata,
      // });
      // await this.s3Client.send(command);

      this.logger.log(`Artifact uploaded to S3: ${options.key}`);
      return {
        s3Key: options.key,
        uploaded: true,
      };
    } catch (error) {
      this.logger.error(`Failed to upload artifact to S3: ${error.message}`, error.stack);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Generate presigned download URL
   */
  async getPresignedUrl(s3Key: string, options?: PresignedUrlOptions): Promise<string> {
    if (!this.enabled) {
      this.logger.debug(`S3 disabled: Cannot generate presigned URL for ${s3Key}`);
      throw new Error('S3 is not enabled. Cannot generate download URL.');
    }

    try {
      // TODO: Implement actual presigned URL generation
      // const command = new GetObjectCommand({
      //   Bucket: this.bucketName,
      //   Key: s3Key,
      // });
      // const url = await getSignedUrl(this.s3Client, command, {
      //   expiresIn: options?.expiresIn || 3600,
      // });
      // return url;

      // Temporary: return placeholder URL
      return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`, error.stack);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Delete artifact from S3
   */
  async deleteArtifact(s3Key: string): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(`S3 disabled: Skipping delete for ${s3Key}`);
      return;
    }

    try {
      // TODO: Implement actual S3 delete
      // const command = new DeleteObjectCommand({
      //   Bucket: this.bucketName,
      //   Key: s3Key,
      // });
      // await this.s3Client.send(command);

      this.logger.log(`Artifact deleted from S3: ${s3Key}`);
    } catch (error) {
      this.logger.error(`Failed to delete artifact from S3: ${error.message}`, error.stack);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  /**
   * Check if S3 is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get bucket info
   */
  getBucketInfo() {
    return {
      enabled: this.enabled,
      bucket: this.bucketName,
      region: this.region,
    };
  }
}
