// Local QA only: permit the shared dependency directory used by worktrees.
import { defineConfig, mergeConfig } from 'vite';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import base from './vite.config';
export default mergeConfig(base, defineConfig({cacheDir:'node_modules/.vite-analyzer-qa',server:{fs:{allow:[process.cwd(),realpathSync(resolve('node_modules'))]}}}));
