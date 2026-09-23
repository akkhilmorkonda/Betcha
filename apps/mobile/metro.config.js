const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, "..", "..");
const core = path.resolve(workspaceRoot, "packages", "core");

/**
 * WHY THIS FILE EXISTS. See the "Metro will not follow a Windows junction" trap
 * in CLAUDE.md — measured during the Gate 0 spike, before any of this was built.
 *
 * npm links packages/core into node_modules. On Windows a real symlink needs
 * admin or Developer Mode, so npm falls back to a JUNCTION, and Metro's
 * resolver does not traverse junctions: the bundle dies with
 * "Unable to resolve module @betcha/core", even with --clear, while the
 * junction reads perfectly well from the shell.
 *
 * All three settings below are needed. Without the third, code inside core
 * cannot find hoisted dependencies (zod) and fails one step later, which reads
 * like an entirely different bug.
 *
 * This is harmless on macOS and Linux, where the link is a real symlink Metro
 * follows anyway — including on EAS Build's workers. Keep it: it costs nothing
 * there and it is the difference between working and not on the dev machine.
 */
config.watchFolders = [...(config.watchFolders ?? []), core];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@betcha/core": core,
};

config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths ?? []),
  path.resolve(__dirname, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
