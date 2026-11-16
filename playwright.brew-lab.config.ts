import {defineConfig} from '@playwright/test';
import base from './playwright.analyzer.config';
export default defineConfig({...base,testMatch:/brewLab(?:Discovery)?\.spec\.ts/});
