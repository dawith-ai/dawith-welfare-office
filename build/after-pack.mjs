import fs from 'node:fs';
import path from 'node:path';

/**
 * Keep the Windows installer small without removing files used by the
 * document, PDF, image, audio, or video workflows. The app does not use
 * WebGPU or Vulkan; Chromium can use its normal Direct3D/software paths.
 */
export default async function afterPack(context) {
  if (context.electronPlatformName === 'darwin') {
    // Keep the RHWP engine in the Mac bundle. The desktop app is local-only
    // and its CSP blocks remote runtime downloads, so HWPX must work on the
    // first launch without an internet connection.
    const appBundle = context.appOutDir.endsWith('.app')
      ? context.appOutDir
      : fs.readdirSync(context.appOutDir)
        .filter((entry) => entry.endsWith('.app'))
        .map((entry) => path.join(context.appOutDir, entry))
        .find((entry) => fs.statSync(entry).isDirectory());
    const appAsar = appBundle ? path.join(appBundle, 'Contents', 'Resources', 'app.asar') : null;
    // Hardware acceleration is disabled by the desktop entrypoint. The
    // bundled SwiftShader runtime is therefore unused by this document app.
    const optionalGraphicsFiles = [
      path.join('Contents', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Libraries', 'libvk_swiftshader.dylib'),
      path.join('Contents', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Libraries', 'vk_swiftshader_icd.json'),
    ];
    for (const file of optionalGraphicsFiles) {
      const target = appBundle ? path.join(appBundle, file) : null;
      if (target && fs.existsSync(target)) fs.rmSync(target);
    }
    return;
  }

  if (context.electronPlatformName !== 'win32') return;

  const optionalGraphicsFiles = [
    'dxcompiler.dll',
    'd3dcompiler_47.dll',
    'vk_swiftshader.dll',
    'vulkan-1.dll',
    'vk_swiftshader_icd.json',
    'electron_wer.dll',
    'chrome_200_percent.pak',
  ];

  for (const file of optionalGraphicsFiles) {
    const target = path.join(context.appOutDir, file);
    if (fs.existsSync(target)) fs.rmSync(target);
  }
}
