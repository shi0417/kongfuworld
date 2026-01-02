const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const NODE_ENV = process.env.NODE_ENV || 'development';

let envFile = '.env.local';

if (NODE_ENV === 'production') {
  envFile = '.env.production';
}

const envFilePath = path.resolve(process.cwd(), envFile);

if (fs.existsSync(envFilePath)) {
  dotenv.config({
    path: envFilePath,
  });
  console.log(`[env] Loaded ${envFile}`);
} else {
  console.error(`[env] ERROR: Environment file not found: ${envFilePath}`);
  console.error(`[env] Current working directory: ${process.cwd()}`);
  console.error(`[env] NODE_ENV: ${NODE_ENV}`);
  process.exit(1);
}
