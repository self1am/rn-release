#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import inquirer from "inquirer";
import semver from "semver";
import chalk from "chalk";
import { Command } from "commander";

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up the program
const program = new Command("rn-release")
  .version("1.0.0")
  .description("A CLI tool for React Native project release management");

// Constants
const PLATFORMS = {
  ANDROID: "android",
  IOS: "ios",
  BOTH: "both",
};

// Helper functions
function getPackageJson() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.error(
      chalk.red(
        "Error: package.json not found. Make sure you are in the root directory of a React Native project."
      )
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

function updatePackageJson(newVersion) {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = getPackageJson();
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(chalk.green(`✅ Updated package.json version to ${newVersion}`));
}

function updateAndroidVersion(versionName, versionCode) {
  try {
    const gradlePath = path.join(
      process.cwd(),
      "android",
      "app",
      "build.gradle"
    );
    if (!fs.existsSync(gradlePath)) {
      console.error(
        chalk.yellow(
          "⚠️ Android build.gradle file not found, skipping Android version update."
        )
      );
      return;
    }

    let gradleFile = fs.readFileSync(gradlePath, "utf8");

    // Update versionName
    gradleFile = gradleFile.replace(
      /versionName "(.*?)"/,
      `versionName "${versionName}"`
    );

    // Update versionCode
    if (versionCode) {
      gradleFile = gradleFile.replace(
        /versionCode (\d+)/,
        `versionCode ${versionCode}`
      );
    } else {
      // Extract current versionCode and increment it
      const versionCodeMatch = gradleFile.match(/versionCode (\d+)/);
      if (versionCodeMatch && versionCodeMatch[1]) {
        const newVersionCode = parseInt(versionCodeMatch[1], 10) + 1;
        gradleFile = gradleFile.replace(
          /versionCode (\d+)/,
          `versionCode ${newVersionCode}`
        );
        console.log(
          chalk.green(`✅ Incremented Android versionCode to ${newVersionCode}`)
        );
      }
    }

    fs.writeFileSync(gradlePath, gradleFile);
    console.log(
      chalk.green(`✅ Updated Android versionName to ${versionName}`)
    );
  } catch (error) {
    console.error(
      chalk.red(`Error updating Android version: ${error.message}`)
    );
  }
}

function updateIosVersion(version, buildNumber) {
  try {
    // Find the project directory
    const iosDir = path.join(process.cwd(), "ios");
    if (!fs.existsSync(iosDir)) {
      console.error(
        chalk.yellow("⚠️ iOS directory not found, skipping iOS version update.")
      );
      return;
    }

    // Find the project name by looking for the .xcodeproj directory
    const projectDirs = fs
      .readdirSync(iosDir)
      .filter((file) => file.endsWith(".xcodeproj"));
    if (projectDirs.length === 0) {
      console.error(
        chalk.yellow(
          "⚠️ No .xcodeproj directory found in iOS folder, skipping iOS version update."
        )
      );
      return;
    }

    const projectName = projectDirs[0].replace(".xcodeproj", "");
    const infoPlistPath = path.join(iosDir, projectName, "Info.plist");

    if (!fs.existsSync(infoPlistPath)) {
      console.error(
        chalk.yellow(
          `⚠️ Info.plist not found at ${infoPlistPath}, skipping iOS version update.`
        )
      );
      return;
    }

    // Use PlistBuddy to update the version
    const updateVersionCmd = `/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${version}" "${infoPlistPath}"`;
    execSync(updateVersionCmd, { stdio: "ignore" });
    console.log(
      chalk.green(`✅ Updated iOS CFBundleShortVersionString to ${version}`)
    );

    // Update build number if provided, otherwise increment
    if (buildNumber) {
      const updateBuildCmd = `/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${buildNumber}" "${infoPlistPath}"`;
      execSync(updateBuildCmd, { stdio: "ignore" });
      console.log(
        chalk.green(`✅ Updated iOS CFBundleVersion to ${buildNumber}`)
      );
    } else {
      // Get current build number
      const getBuildCmd = `/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${infoPlistPath}"`;
      const currentBuildNumber = execSync(getBuildCmd, {
        encoding: "utf8",
      }).trim();
      const newBuildNumber = parseInt(currentBuildNumber, 10) + 1;

      // Update build number
      const updateBuildCmd = `/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${newBuildNumber}" "${infoPlistPath}"`;
      execSync(updateBuildCmd, { stdio: "ignore" });
      console.log(
        chalk.green(`✅ Incremented iOS CFBundleVersion to ${newBuildNumber}`)
      );
    }
  } catch (error) {
    console.error(chalk.red(`Error updating iOS version: ${error.message}`));
  }
}

function gitCommitAndTag(version) {
  try {
    // Check if git is initialized
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });

    // Add and commit changes
    execSync("git add .", { stdio: "ignore" });
    execSync(`git commit -m "chore: bump version to ${version}"`, {
      stdio: "ignore",
    });

    // Create tag
    execSync(`git tag -a v${version} -m "Version ${version}"`, {
      stdio: "ignore",
    });

    console.log(chalk.green(`✅ Created git commit and tag for v${version}`));
  } catch (error) {
    console.error(chalk.yellow(`⚠️ Git operations failed: ${error.message}`));
  }
}

// function buildAndroid() {
//   try {
//     console.log(chalk.blue("Building Android release..."));
//     execSync("cd android && ./gradlew assembleRelease", { stdio: "inherit" });
//     console.log(chalk.green("✅ Android build completed successfully!"));

//     const apkPath = path.join(
//       process.cwd(),
//       "android",
//       "app",
//       "build",
//       "outputs",
//       "apk",
//       "release"
//     );
//     console.log(chalk.green(`📦 APK file location: ${apkPath}`));
//   } catch (error) {
//     console.error(chalk.red(`❌ Android build failed: ${error.message}`));
//   }
// }

function buildAndroid() {
  try {
    console.log(chalk.blue("Building Android release..."));

    // Use the correct gradle command based on the OS
    const gradleCmd =
      process.platform === "win32" ? "gradlew.bat" : "./gradlew";

    execSync(`cd android && ${gradleCmd} assembleRelease`, {
      stdio: "inherit",
    });

    console.log(chalk.green("✅ Android build completed successfully!"));

    const apkPath = path.join(
      process.cwd(),
      "android",
      "app",
      "build",
      "outputs",
      "apk",
      "release"
    );
    console.log(chalk.green(`📦 APK file location: ${apkPath}`));
  } catch (error) {
    console.error(chalk.red(`❌ Android build failed: ${error.message}`));
  }
}

function buildIos() {
  try {
    console.log(chalk.blue("Building iOS release..."));
    // Find workspace name
    const iosDir = path.join(process.cwd(), "ios");
    const workspaces = fs
      .readdirSync(iosDir)
      .filter((file) => file.endsWith(".xcworkspace"));

    if (workspaces.length === 0) {
      console.error(chalk.red("❌ No .xcworkspace found in iOS directory."));
      return;
    }

    const workspaceName = workspaces[0];
    const scheme = workspaceName.replace(".xcworkspace", "");

    // Build iOS archive
    console.log(
      chalk.blue(
        `Building archive for workspace ${workspaceName} and scheme ${scheme}...`
      )
    );
    execSync(
      `xcodebuild -workspace ios/${workspaceName} -scheme ${scheme} -configuration Release -archivePath ios/build/${scheme}.xcarchive archive`,
      { stdio: "inherit" }
    );

    console.log(chalk.green("✅ iOS archive build completed successfully!"));
    console.log(
      chalk.green(`📦 Archive location: ios/build/${scheme}.xcarchive`)
    );

    // For actual IPA generation, you would usually use gym from fastlane or export the IPA from Xcode
    console.log(
      chalk.yellow(
        "ℹ️ To generate an IPA file, open the archive in Xcode or use fastlane."
      )
    );
  } catch (error) {
    console.error(chalk.red(`❌ iOS build failed: ${error.message}`));
  }
}

// Release command function
async function release(options) {
  console.log(chalk.blue("🚀 React Native Release Tool"));
  console.log(chalk.blue("================================"));
  console.log(chalk.blue("@hanafe/rn-release v1.0.1"));

  const packageJson = getPackageJson();
  const currentVersion = packageJson.version || "0.1.0";

  console.log(chalk.blue(`Current version: ${currentVersion}`));

  // Pre-defined options or prompt for input
  let newVersion, platform, createGitTag;

  if (options.version) {
    // Use version from command line
    if (
      options.version === "major" ||
      options.version === "minor" ||
      options.version === "patch"
    ) {
      newVersion = semver.inc(currentVersion, options.version);
    } else if (semver.valid(options.version)) {
      newVersion = options.version;
    } else {
      console.error(
        chalk.red(
          'Invalid version specified. Use "major", "minor", "patch", or a valid semver version.'
        )
      );
      process.exit(1);
    }
    platform = options.platform || PLATFORMS.BOTH;
    createGitTag = options.tag;
  } else {
    // Ask questions interactively
    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "versionType",
        message: "What type of version update?",
        choices: [
          {
            name: `Major (${semver.inc(currentVersion, "major")})`,
            value: "major",
          },
          {
            name: `Minor (${semver.inc(currentVersion, "minor")})`,
            value: "minor",
          },
          {
            name: `Patch (${semver.inc(currentVersion, "patch")})`,
            value: "patch",
          },
          { name: "Custom", value: "custom" },
        ],
      },
      {
        type: "input",
        name: "customVersion",
        message: "Enter custom version:",
        when: (answers) => answers.versionType === "custom",
        validate: (input) => {
          if (semver.valid(input)) {
            return true;
          }
          return "Please enter a valid semver version (e.g., 1.2.3)";
        },
      },
      {
        type: "list",
        name: "platform",
        message: "Build for which platform?",
        choices: [
          { name: "Android", value: PLATFORMS.ANDROID },
          { name: "iOS", value: PLATFORMS.IOS },
          { name: "Both", value: PLATFORMS.BOTH },
        ],
      },
      {
        type: "confirm",
        name: "createGitTag",
        message: "Create git commit and tag?",
        default: true,
      },
    ]);

    // Determine new version
    if (answers.versionType === "custom") {
      newVersion = answers.customVersion;
    } else {
      newVersion = semver.inc(currentVersion, answers.versionType);
    }

    platform = answers.platform;
    createGitTag = answers.createGitTag;
  }

  console.log(chalk.blue(`\nPreparing release for version ${newVersion}...`));

  // Update versions
  updatePackageJson(newVersion);

  if (platform === PLATFORMS.ANDROID || platform === PLATFORMS.BOTH) {
    updateAndroidVersion(newVersion);
  }

  if (platform === PLATFORMS.IOS || platform === PLATFORMS.BOTH) {
    updateIosVersion(newVersion);
  }

  // Git operations
  if (createGitTag) {
    gitCommitAndTag(newVersion);
  }

  // Build
  if (platform === PLATFORMS.ANDROID || platform === PLATFORMS.BOTH) {
    buildAndroid();
  }

  if (platform === PLATFORMS.IOS || platform === PLATFORMS.BOTH) {
    buildIos();
  }

  console.log(chalk.green("\n✅ Release preparation completed!"));
}

/**
 * Execute a shell command and return its output as a string.
 */
function runCommand(command) {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch (error) {
    console.error("❌ Error executing command:", error.message);
    return null;
  }
}

/**
 * Get a list of connected devices using ADB.
 */
function getConnectedDevices() {
  const output = runCommand("adb devices");
  if (!output) return [];

  const lines = output.split("\n").slice(1);
  return lines
    .map((line) => line.split("\t")[0])
    .filter((device) => device.length > 0);
}

/**
 * Stream-install an APK on multiple devices.
 */
async function streamInstallApk() {
  const devices = getConnectedDevices();
  if (devices.length === 0) {
    console.log(
      chalk.redBright("⚠️ No devices found! Please connect an Android device.")
    );
    return;
  }

  const { confirmInstall } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmInstall",
      message: "Do you want to stream-install the release APK?",
      default: true,
    },
  ]);

  if (!confirmInstall) {
    console.log(chalk.green("🚫 Installation cancelled."));
    return;
  }

  const { selectedDevices } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selectedDevices",
      message: "Select devices for installation:",
      choices: devices.map((device) => ({ name: device, value: device })),
    },
  ]);

  if (selectedDevices.length === 0) {
    console.log("⚠️ No devices selected. Exiting.");
    return;
  }

  // Find available APKs in the release directory
  const releaseDir = path.join(process.cwd(), 'android/app/build/outputs/apk/release');
  const apkFiles = fs.readdirSync(releaseDir)
    .filter(file => file.endsWith('.apk'))
    .map(file => ({
      name: file,
      path: path.join(releaseDir, file)
    }));

  if (apkFiles.length === 0) {
    console.error(chalk.red('No APK files found in the release directory'));
    return;
  }

  // If there's only one APK, use it directly
  let selectedApk;
  if (apkFiles.length === 1) {
    selectedApk = apkFiles[0];
  } else {
    // Let user select which APK to install
    const { apkChoice } = await inquirer.prompt([{
      type: 'list',
      name: 'apkChoice',
      message: 'Multiple APKs found. Select which one to install:',
      choices: apkFiles.map(apk => ({
        name: apk.name,
        value: apk
      }))
    }]);
    selectedApk = apkChoice;
  }

  const apkPath = selectedApk.path;

  console.log("🚀 Installing APK on selected devices...");
  selectedDevices.forEach((device) => {
    console.log(`📲 Installing on ${device}...`);
    const command = `adb -s ${device} install -r -t ${apkPath}`;
    runCommand(command);
    console.log(`✅ Successfully installed on ${device}`);
  });

  console.log("🎉 Installation complete!");
}

// Register commands
program
  .command("release")
  .description("Prepare and build a new release")
  .option(
    "-v, --version <version>",
    "Version type (major, minor, patch) or specific version"
  )
  .option(
    "-p, --platform <platform>",
    "Platform to build for (android, ios, both)"
  )
  .option("-t, --tag", "Create git commit and tag", true)
  .action(release);

// Add more commands as needed
program
  .command("init")
  .description("Initialize your project settings")
  .action(() => {
    console.log(chalk.green("Initialization functionality to be implemented"));
  });

// Registering command for rn-hanafe CLI
program
  .command("stream-install")
  .description("Stream-install an APK to multiple connected devices via ADB.")
  .action(streamInstallApk);

// Parse command line arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
