import fs from 'node:fs';
import path from 'node:path';

const gradlePropsPath = path.resolve('android', 'gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  let props = fs.readFileSync(gradlePropsPath, 'utf8');
  if (/-Xmx\S+/.test(props)) {
    props = props.replace(/-Xmx\S+/g, '-Xmx4096m');
  } else {
    props += '\norg.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8\n';
  }
  fs.writeFileSync(gradlePropsPath, props, 'utf8');
}

const appBuildGradlePath = path.resolve('android', 'app', 'build.gradle');
if (fs.existsSync(appBuildGradlePath)) {
  let gradle = fs.readFileSync(appBuildGradlePath, 'utf8');
  if (!gradle.includes('androidResources') && gradle.includes('android {')) {
    gradle = gradle.replace(
      'android {\n',
      'android {\n    androidResources {\n        noCompress.addAll(["pdf"])\n    }\n',
    );
    fs.writeFileSync(appBuildGradlePath, gradle, 'utf8');
  } else if (gradle.includes('noCompress.addAll(["glb", "gltf", "bin", "pdf"])')) {
    gradle = gradle.replace(
      'noCompress.addAll(["glb", "gltf", "bin", "pdf"])',
      'noCompress.addAll(["pdf"])',
    );
    fs.writeFileSync(appBuildGradlePath, gradle, 'utf8');
  }
}

const androidManifestPath = path.resolve(
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml'
);
if (fs.existsSync(androidManifestPath)) {
  let manifest = fs.readFileSync(androidManifestPath, 'utf8');
  let changed = false;

  const ensureApplicationAttr = (attrName, attrValue) => {
    if (manifest.includes(`${attrName}=`)) return;
    if (manifest.includes('<application\n')) {
      manifest = manifest.replace(
        '<application\n',
        `<application\n        ${attrName}="${attrValue}"\n`
      );
    } else {
      manifest = manifest.replace(
        '<application ',
        `<application ${attrName}="${attrValue}" `
      );
    }
    changed = true;
  };

  ensureApplicationAttr('android:hardwareAccelerated', 'true');
  ensureApplicationAttr('android:largeHeap', 'true');
  ensureApplicationAttr('android:extractNativeLibs', 'false');

  if (changed) {
    fs.writeFileSync(androidManifestPath, manifest, 'utf8');
  }
}

const androidIconsDir = path.resolve('build', 'android-icons');
const androidResDir = path.resolve('android', 'app', 'src', 'main', 'res');
if (fs.existsSync(androidIconsDir) && fs.existsSync(androidResDir)) {
  for (const density of fs.readdirSync(androidIconsDir)) {
    const srcDensity = path.join(androidIconsDir, density);
    const dstDensity = path.join(androidResDir, density);
    if (!fs.statSync(srcDensity).isDirectory()) continue;
    fs.mkdirSync(dstDensity, { recursive: true });
    for (const file of fs.readdirSync(srcDensity)) {
      fs.copyFileSync(path.join(srcDensity, file), path.join(dstDensity, file));
    }
  }
}
