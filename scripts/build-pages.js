import fs from 'fs';
import path from 'path';

const root = process.cwd();
const srcDir = path.join(root, 'public', 'academy');
const dataFile = path.join(root, 'data', 'db.json');
const distDir = path.join(root, 'dist');

const copyRecursive = (src, dest) => {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

copyRecursive(srcDir, distDir);

const dataDestDir = path.join(distDir, 'data');
if (!fs.existsSync(dataDestDir)) fs.mkdirSync(dataDestDir, { recursive: true });
fs.copyFileSync(dataFile, path.join(dataDestDir, 'db.json'));

fs.copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'));

console.log('Static bundle ready at', distDir);
