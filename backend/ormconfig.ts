import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { basename, join } from 'path';

// Load environment variables from .env file
config();

const projectRoot = basename(__dirname) === 'dist' ? join(__dirname, '..') : __dirname;

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  // Cover both ts-node and compiled runtime execution contexts.
  entities: [
    join(projectRoot, 'src', '**', '*.entity.{ts,js}'),
    join(projectRoot, 'dist', 'src', '**', '*.entity.js'),
  ],
  migrations: [
    join(projectRoot, 'migrations', '*.{ts,js}'),
    join(projectRoot, 'dist', 'migrations', '*.js'),
  ],
  synchronize: false, // Never true for migrations
  logging: process.env.NODE_ENV === 'development', // Log SQL only in development
  migrationsTableName: 'typeorm_migrations', // Default migration table name
  metadataTableName: 'typeorm_metadata', // Table to store metadata (optional)
};

// Revert to exporting the instantiated DataSource
const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
