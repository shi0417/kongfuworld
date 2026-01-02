const dotenv = require('dotenv');
const path = require('path');

const NODE_ENV = process.env.NODE_ENV || 'development';

let envFile = '.env.local';

if (NODE_ENV === 'production') {
  envFile = '.env.production';
}

dotenv.config({
  path: path.resolve(process.cwd(), envFile),
});

console.log(`[env] Loaded ${envFile}`);
