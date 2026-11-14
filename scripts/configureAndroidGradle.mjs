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
      'android {\n    androidResources {\n        noCompress "glb", "gltf", "bin"\n    }\n',
    );
    fs.writeFileSync(appBuildGradlePath, gradle, 'utf8');
  }
}
