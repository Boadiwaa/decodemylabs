/**
 * Expo Config Plugin — withModelAsset
 *
 * Adds model assets to native projects.
 *
 * iOS:  Adds the model to Xcode's "Copy Bundle Resources" build phase
 *       so it ships inside the .app bundle.
 *
 * Android: Creates a Gradle task that copies the model into the app's
 *          files directory via adb push after install, since Android APKs
 *          cannot embed 2.8 GB files.  Also creates a helper script.
 *
 * Usage in app.json:
 *   ["./plugins/withModelAsset", { "modelPath": "models/medgemma-1.5-4b-it-Q3_K_M.gguf" }]
 */

const { withXcodeProject, withDangerousMod } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

function withModelAsset(config, { modelPath, mmprojPath } = {}) {
  if (!modelPath) {
    throw new Error('[withModelAsset] "modelPath" is required (e.g. "models/medgemma-1.5-4b-it-Q3_K_M.gguf")');
  }

  // Apply iOS config for model
  config = withModelAssetIOS(config, modelPath);

  // Apply iOS config for mmproj (vision projector) if provided
  if (mmprojPath) {
    config = withModelAssetIOS(config, mmprojPath);
  }

  // Apply Android config
  config = withModelAssetAndroid(config, modelPath);

  return config;
}

// ======================== iOS ========================

function withModelAssetIOS(config, modelPath) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const projectRoot = mod.modRequest.projectRoot;
    const projectName = mod.modRequest.projectName;

    // Resolve the absolute path to the model file
    const absoluteModelPath = path.resolve(projectRoot, modelPath);
    const modelFileName = path.basename(modelPath);

    // Verify the model file exists at build time
    if (!fs.existsSync(absoluteModelPath)) {
      console.warn(
        `[withModelAsset] ⚠️  Model file not found at "${absoluteModelPath}". ` +
        `The build will proceed but the model won't be bundled. ` +
        `Place the model at "${modelPath}" relative to the project root.`
      );
      return mod;
    }

    const fileSizeMB = (fs.statSync(absoluteModelPath).size / (1024 * 1024)).toFixed(0);
    console.log(`[withModelAsset] 📦 Bundling ${modelFileName} (${fileSizeMB} MB) into iOS app...`);

    // Check if already added (idempotent)
    const existingRefs = project.pbxFileReferenceSection();
    const alreadyAdded = Object.values(existingRefs).some(
      (ref) => typeof ref === 'object' && ref.path && ref.path.includes(modelFileName)
    );

    if (alreadyAdded) {
      console.log(`[withModelAsset] ✅ ${modelFileName} already in Xcode project, skipping.`);
      return mod;
    }

    // The path Xcode will use — relative from the ios/ directory to the model
    const relativeFromIos = path.relative(
      path.join(projectRoot, 'ios'),
      absoluteModelPath
    );

    // Use the project name group (e.g. "LabLens"/"TalkingLabs") which has a valid path
    const targetGroup = project.pbxGroupByName(projectName);
    if (!targetGroup) {
      console.warn(`[withModelAsset] ⚠️  Could not find group "${projectName}" in pbxproj. Trying Resources group.`);
    }

    const groupKey = targetGroup
      ? Object.keys(project.hash.project.objects.PBXGroup).find(
          (k) => project.hash.project.objects.PBXGroup[k].name === `"${projectName}"` ||
                 project.hash.project.objects.PBXGroup[k].name === projectName
        )
      : undefined;

    // Generate unique UUIDs
    const fileRefUuid = project.generateUuid();
    const buildFileUuid = project.generateUuid();

    // 1. Add PBXFileReference
    project.hash.project.objects.PBXFileReference[fileRefUuid] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'file',
      name: `"${modelFileName}"`,
      path: `"${relativeFromIos}"`,
      sourceTree: '"<group>"',
    };
    project.hash.project.objects.PBXFileReference[`${fileRefUuid}_comment`] = modelFileName;

    // 2. Add PBXBuildFile (links file ref to build phase)
    project.hash.project.objects.PBXBuildFile[buildFileUuid] = {
      isa: 'PBXBuildFile',
      fileRef: fileRefUuid,
      fileRef_comment: modelFileName,
    };
    project.hash.project.objects.PBXBuildFile[`${buildFileUuid}_comment`] = `${modelFileName} in Resources`;

    // 3. Add the file reference to the target group's children
    if (groupKey && project.hash.project.objects.PBXGroup[groupKey].children) {
      project.hash.project.objects.PBXGroup[groupKey].children.push({
        value: fileRefUuid,
        comment: modelFileName,
      });
    }

    // 4. Add to "Copy Bundle Resources" build phase
    const resourcesBuildPhase = project.hash.project.objects.PBXResourcesBuildPhase;
    if (resourcesBuildPhase) {
      const phaseKeys = Object.keys(resourcesBuildPhase).filter((k) => !k.endsWith('_comment'));
      for (const phaseKey of phaseKeys) {
        const phase = resourcesBuildPhase[phaseKey];
        if (phase.files) {
          phase.files.push({
            value: buildFileUuid,
            comment: `${modelFileName} in Resources`,
          });
          break; // Only add to the first (main target) resources phase
        }
      }
    }

    console.log(`[withModelAsset] ✅ Added ${modelFileName} to Copy Bundle Resources`);

    return mod;
  });
}

// ======================== Android ========================

function withModelAssetAndroid(config, modelPath) {
  return withDangerousMod(config, ['android', (mod) => {
    const projectRoot = mod.modRequest.projectRoot;
    const absoluteModelPath = path.resolve(projectRoot, modelPath);
    const modelFileName = path.basename(modelPath);

    if (!fs.existsSync(absoluteModelPath)) {
      console.warn(
        `[withModelAsset] ⚠️  Model file not found at "${absoluteModelPath}". ` +
        `The Android build will proceed but you must push the model manually.`
      );
    } else {
      const fileSizeMB = (fs.statSync(absoluteModelPath).size / (1024 * 1024)).toFixed(0);
      console.log(`[withModelAsset] 📱 Android: Model "${modelFileName}" (${fileSizeMB} MB) detected.`);
      console.log(`[withModelAsset] 📱 Android: Model is pushed to /data/local/tmp/ on device.`);
      console.log(`[withModelAsset] 📱 Android: The app auto-discovers it there on launch.`);
    }

    // ---- Gradle: auto-push model after installDebug (dev convenience only) ----
    // This is NOT required for the app to work — models are loaded from
    // documentDirectory. This just helps during development by auto-pushing
    // to /data/local/tmp/ where the app's migration code picks them up.
    const appBuildGradle = path.join(projectRoot, 'android', 'app', 'build.gradle');
    if (fs.existsSync(appBuildGradle)) {
      let gradleContent = fs.readFileSync(appBuildGradle, 'utf-8');

      const marker = '// [withModelAsset] auto-push task';
      if (!gradleContent.includes(marker)) {
        const gradleTask = `
${marker}
    // (Optional) Push local model assets to /data/local/tmp/ after installDebug.
// Wrapped in try-catch so build never fails if adb/device isn't available.
afterEvaluate {
    try {
        def adbExe = android.adbExecutable?.absolutePath
        if (adbExe == null) {
            logger.warn("[withModelAsset] adb not found, skipping auto-push")
            return
        }
        def modelDir = file("\${rootProject.projectDir}/../models")
        if (!modelDir.exists()) return

        tasks.matching { it.name =~ /^install.*Debug\$/ }.configureEach { installTask ->
            installTask.doLast {
                try {
                  modelDir.listFiles()?.findAll { f ->
                    f.name.endsWith('.gguf') || f.name.endsWith('.litertlm')
                  }?.each { modelFile ->
                    def dest = "/data/local/tmp/\${modelFile.name}"
                        def checkOut = new ByteArrayOutputStream()
                        def checkResult = exec {
                            commandLine adbExe, 'shell', 'stat', '-c', '%s', dest
                            standardOutput = checkOut
                            errorOutput = new ByteArrayOutputStream()
                            ignoreExitValue = true
                        }
                        def deviceSize = checkOut.toString().trim()
                        if (checkResult.exitValue == 0 && deviceSize == modelFile.length().toString()) {
                          logger.lifecycle("[withModelAsset] \${modelFile.name} already on device, skipping")
                            return
                        }
                        logger.lifecycle("[withModelAsset] Pushing \${modelFile.name} (\${(modelFile.length() / 1048576).intValue()} MB)…")
                        exec {
                          commandLine adbExe, 'push', modelFile.absolutePath, dest
                            ignoreExitValue = true
                        }
                    }
                } catch (Exception e) {
                    logger.warn("[withModelAsset] Auto-push failed (non-fatal): " + e.message)
                }
            }
        }
    } catch (Exception e) {
        logger.warn("[withModelAsset] Could not configure auto-push (non-fatal): " + e.message)
    }
}
`;
        gradleContent += gradleTask;
        fs.writeFileSync(appBuildGradle, gradleContent);
        console.log(`[withModelAsset] ✅ Added Gradle auto-push task to app/build.gradle`);
      } else {
        console.log(`[withModelAsset] ✅ Gradle auto-push task already present`);
      }
    }

    return mod;
  }]);
}

module.exports = withModelAsset;
