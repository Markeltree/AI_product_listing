// Stores files in S3-compatible object storage such as Cloudflare R2. The phone uploads straight to the
// bucket with a signed URL, so large videos never pass through the API server.
import { AwsClient } from 'aws4fetch';
import { HttpError } from '../utils/errors.js';

const UPLOAD_URL_SECONDS = 3600;

export function s3Storage({ endpoint, bucket, accessKeyId, secretAccessKey, region = 'auto' }) {
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region, retries: 2 });
  const objectUrl = (key) => `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;

  return {
    driver: 's3',

    async createUpload({ key, mime }) {
      const url = new URL(objectUrl(key));
      url.searchParams.set('X-Amz-Expires', String(UPLOAD_URL_SECONDS));
      const signed = await client.sign(new Request(url, { method: 'PUT' }), { aws: { signQuery: true } });
      return { method: 'PUT', url: signed.url, headers: { 'content-type': mime } };
    },

    async stat(key) {
      const res = await client.fetch(objectUrl(key), { method: 'HEAD' });
      if (res.status === 404) return null;
      if (!res.ok) throw new HttpError(502, `File storage returned ${res.status}.`);
      return { size: Number(res.headers.get('content-length') || 0) };
    },

    async remove(key) {
      const res = await client.fetch(objectUrl(key), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new HttpError(502, `File storage returned ${res.status}.`);
    },
  };
}
