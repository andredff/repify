import sharp from 'sharp';

export interface ProcessedImage {
  buffer: Buffer;
  contentType: 'image/webp';
  ext: 'webp';
}

export interface ProcessedSizes {
  thumb: ProcessedImage;   // 300px
  medium: ProcessedImage;  // 600px
  full: ProcessedImage;    // 1080px
}

const QUALITY = 80;

async function resizeToWebP(input: Buffer, width: number): Promise<ProcessedImage> {
  const buffer = await sharp(input)
    .rotate()                        // fix EXIF orientation
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  return { buffer, contentType: 'image/webp', ext: 'webp' };
}

export async function processImage(input: Buffer): Promise<ProcessedSizes> {
  const [thumb, medium, full] = await Promise.all([
    resizeToWebP(input, 300),
    resizeToWebP(input, 600),
    resizeToWebP(input, 1080),
  ]);
  return { thumb, medium, full };
}
