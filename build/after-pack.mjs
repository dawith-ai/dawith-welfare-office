import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPackage, extractAll } from '@electron/asar';

/**
 * Keep the Windows installer small without removing files used by the
 * document, PDF, image, audio, or video workflows. The app does not use
 * WebGPU or Vulkan; Chromium can use its normal Direct3D/software paths.
 */
export default async function afterPack(context) {
  if (context.electronPlatformName === 'darwin') {
    // The RHWP engine is optional and toolbox.js downloads it from the
    // release source on first HWP use, then caches it locally. Keeping it
    // outside the Mac bundle keeps the installer below common file-share
    // limits without changing the document workflow.
    const appBundle = context.appOutDir.endsWith('.app')
      ? context.appOutDir
      : fs.readdirSync(context.appOutDir)
        .filter((entry) => entry.endsWith('.app'))
        .map((entry) => path.join(context.appOutDir, entry))
        .find((entry) => fs.statSync(entry).isDirectory());
    const appAsar = appBundle ? path.join(appBundle, 'Contents', 'Resources', 'app.asar') : null;
    if (appAsar && fs.existsSync(appAsar)) {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dawith-welfare-asar-'));
      const unpackedDir = path.join(tempDir, 'app');
      const rebuiltAsar = path.join(tempDir, 'app.asar');
      try {
        await extractAll(appAsar, unpackedDir);
        const optionalWasm = path.join(unpackedDir, 'public', 'vendor', 'rhwp', 'rhwp_bg.wasm');
        if (fs.existsSync(optionalWasm)) fs.rmSync(optionalWasm);
        await createPackage(unpackedDir, rebuiltAsar);
        fs.copyFileSync(rebuiltAsar, appAsar);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }

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
