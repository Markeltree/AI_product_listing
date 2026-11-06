// File storage for large uploads. Uses object storage when S3_BUCKET is set, otherwise this server's disk.
import { config } from '../config/index.js';
import { localStorage } from './local.js';
import { s3Storage } from './s3.js';

export const storage = config.s3.bucket ? s3Storage(config.s3) : localStorage(config.uploadDir);
