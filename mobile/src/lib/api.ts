import { Directory, File, Paths } from 'expo-file-system';
import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { API_URL } from './config';
import { loadToken } from './session';

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Called when the server says the session is no longer valid, so the app can sign out.
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

// Limits for a request that never finishes. Uploads get longer because videos are large.
const REQUEST_TIMEOUT_MS = 120_000;
const UPLOAD_TIMEOUT_MS = 300_000;

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
};

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = await loadToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form; // fetch sets the multipart boundary itself
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.form ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${API_URL}${path}`, { method: opts.method ?? 'GET', headers, body, signal: controller.signal });
    text = await res.text();
  } catch (e) {
    if (controller.signal.aborted) throw new ApiError('This is taking too long. Check your connection and try again.', 0);
    // Keep the underlying reason: "Network request failed" means the server is unreachable,
    // anything else is a problem building the request on the phone.
    const reason = e instanceof Error && e.message ? ` (${e.message})` : '';
    throw new ApiError(`Cannot reach Velista at ${API_URL}${reason}. Check your connection and the server address.`, 0);
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status, data);
  }
  return data as T;
}

export type UploadTarget = { method: 'PUT'; url: string; headers: Record<string, string> };

// Sends a large file to the address the server gave. Phones stream it from disk, so a long video is
// never held in memory; the web preview has no such option and sends a Blob.
export async function uploadFile(target: UploadTarget, uri: string): Promise<void> {
  let status: number;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    status = (await fetch(target.url, { method: target.method, headers: target.headers, body: blob })).status;
  } else {
    status = (await uploadAsync(target.url, uri, {
      httpMethod: target.method, headers: target.headers, uploadType: FileSystemUploadType.BINARY_CONTENT,
    })).status;
  }
  if (status >= 300) throw new ApiError(`The video could not be uploaded (${status}). Please try again.`, status);
}

export type LocalFile = { uri: string; name: string; type: string };

// Adds a local file (photo, video, voice note) to a multipart form.
// The global fetch is Expo's fetch, which does not accept React Native's old { uri, name, type }
// form parts. Phones send an expo-file-system File (a Blob read from disk); the web preview sends
// a Blob fetched from the blob: URL. The file's extension tells the server what kind of file it is.
export async function appendFile(form: FormData, field: string, file: LocalFile): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name);
    return;
  }
  form.append(field, (await namedFile(file)) as unknown as Blob);
}

// Expo's fetch sends the file's name on disk (a random cache name for picked photos) and it cannot be
// overridden, but the server uses the name (bulk upload turns "blue_pouch.jpg" into "Blue pouch").
// So the file is copied into a temporary cache folder under the name the seller sees.
async function namedFile(file: LocalFile): Promise<File> {
  const source = new File(file.uri);
  const name = file.name.replace(/[\\/]/g, '_');
  if (source.name === name) return source;
  const dir = new Directory(Paths.cache, 'velista-uploads', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, name);
  await source.copy(target);
  return target;
}

export async function appendFiles(form: FormData, field: string, files: LocalFile[]): Promise<void> {
  for (const file of files) await appendFile(form, field, file);
}

export const mediaUrl = (listingId: string, mediaId: string) =>
  `${API_URL}/api/listings/${listingId}/media/${mediaId}`;
