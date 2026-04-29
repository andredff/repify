import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';

// Scale to max 1280px wide, keep aspect ratio, height divisible by 2
const SCALE_FILTER = "scale='min(1280,iw)':-2";

export async function compressVideo(inputBuffer: Buffer): Promise<Buffer> {
  const id         = randomUUID();
  const inputPath  = join(tmpdir(), `${id}_in`);
  const outputPath = join(tmpdir(), `${id}_out.mp4`);

  await writeFile(inputPath, inputBuffer);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-crf 28',
        '-preset fast',
        `-vf ${SCALE_FILTER}`,
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });

  const result = await readFile(outputPath);
  void Promise.all([unlink(inputPath), unlink(outputPath)]).catch(() => {});
  return result;
}
