import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Phone photos are often 4000px and 5 to 8 MB. The AI only needs about 1600px (and rejects images over
// 5 MB), and smaller files upload much faster, so photos are scaled down and saved as JPEG first.
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.82;

export type UploadFile = { uri: string; name: string; type: string };
type PickedImage = { uri: string; width?: number; height?: number; fileName?: string | null; mimeType?: string | null };

// Returns a resized JPEG, or the original photo if resizing fails for any reason.
export async function preparePhoto(asset: PickedImage, fallbackName: string): Promise<UploadFile> {
  const name = asset.fileName ?? fallbackName;
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const { width = 0, height = 0 } = asset;
    if (Math.max(width, height) > MAX_SIDE) {
      context.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    // "IMG_2041.HEIC" -> "IMG_2041.jpg", so the name matches the converted file.
    return { uri: saved.uri, name: `${name.replace(/\.[^.]+$/, '')}.jpg`, type: 'image/jpeg' };
  } catch {
    return { uri: asset.uri, name, type: asset.mimeType ?? 'image/jpeg' };
  }
}
