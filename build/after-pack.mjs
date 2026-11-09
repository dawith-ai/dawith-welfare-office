import fs from 'node:fs';
import path from 'node:path';

/**
 * Keep the Windows installer small without removing files used by the
 * document, PDF, image, audio, or video workflows. The app does not use
 * WebGPU or Vulkan; Chromium can use its normal Direct3D/software paths.
 */
export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const optionalGraphicsFiles = [
    'dxcompiler.dll',
    'd3dcompiler_47.dll',
    'vk_swiftshader.dll',
    'vulkan-1.dll',
    'vk_swiftshader_icd.json',
    'electron_wer.dll',
    'chrome_200_percent.pak',
    'ffmpeg.dll',
  ];

  for (const file of optionalGraphicsFiles) {
    const target = path.join(context.appOutDir, file);
    if (fs.existsSync(target)) fs.rmSync(target);
  }
}
