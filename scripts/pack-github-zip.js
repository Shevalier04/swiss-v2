import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const zip = new JSZip();

const excludePatterns = [
  'node_modules',
  'dist',
  '.git',
  '.aistudio',
  'course-schedule-github.zip',
  '.DS_Store'
];

function shouldExclude(relPath) {
  return excludePatterns.some(pat => relPath === pat || relPath.startsWith(pat + path.sep) || relPath.endsWith('course-schedule-github.zip'));
}

function addDirectoryToZip(dirPath, zipFolder, baseDir) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(baseDir, fullPath);
    if (shouldExclude(relPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      const subFolder = zipFolder.folder(entry.name);
      addDirectoryToZip(fullPath, subFolder, baseDir);
    } else if (entry.isFile()) {
      const fileData = fs.readFileSync(fullPath);
      zipFolder.file(entry.name, fileData);
    }
  }
}

async function main() {
  const rootDir = process.cwd();
  console.log('Packaging GitHub repository archive from:', rootDir);

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    const relPath = entry.name;
    if (shouldExclude(relPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      const folder = zip.folder(entry.name);
      addDirectoryToZip(fullPath, folder, rootDir);
    } else if (entry.isFile()) {
      const fileData = fs.readFileSync(fullPath);
      zip.file(entry.name, fileData);
    }
  }

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const out1 = path.join(rootDir, 'course-schedule-github.zip');
  const out2 = path.join(rootDir, 'public', 'course-schedule-github.zip');
  fs.writeFileSync(out1, content);
  fs.writeFileSync(out2, content);

  console.log(`Successfully generated updated GitHub zip packages:\n- ${out1} (${(content.length / 1024).toFixed(1)} KB)\n- ${out2}`);
}

main().catch(err => {
  console.error('Failed to generate zip:', err);
  process.exit(1);
});
