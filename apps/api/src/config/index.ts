import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load apps/api/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  productName: process.env.PRODUCT_NAME || 'FactoryPulse',
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.NODE_ENV === 'test'
      ? (process.env.MYSQL_DATABASE_TEST || 'factorypulse_test')
      : (process.env.MYSQL_DATABASE || 'factorypulse'),
    uri: process.env.MYSQL_URI || process.env.DATABASE_URL
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'factorypulse_super_secret_access_jwt_key_999!',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'factorypulse_super_secret_refresh_jwt_key_888!',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },
  simulator: {
    enabled: process.env.SIMULATOR_ENABLED === 'true',
    tickIntervalMs: parseInt(process.env.SIMULATOR_TICK_INTERVAL_MS || '3000', 10)
  }
};
