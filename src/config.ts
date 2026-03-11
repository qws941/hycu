import 'dotenv/config';
import { buildConfig } from './config-core.js';

export const config = buildConfig(process.env, new Date());
