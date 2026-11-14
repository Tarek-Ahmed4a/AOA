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
  if (!gradle.includes('noCompress') && gradle.includes('android {')) {
    gradle = gradle.replace(
      'android {\n',
      'android {\n    androidResources {\n        noCompress.addAll(["glb", "gltf", "bin", "pdf"])\n    }\n',
    );
    fs.writeFileSync(appBuildGradlePath, gradle, 'utf8');
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
