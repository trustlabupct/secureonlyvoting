import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';

interface BackupConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  backupDir: string;
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

interface BackupResult {
  success: boolean;
  filename?: string;
  filePath?: string;
  size?: number;
  duration?: number;
  error?: string;
}

export class DatabaseBackupService {
  private readonly logger = new Logger('DatabaseBackupService');

  constructor(private readonly config: BackupConfig) {}

  async createBackup(
    type: 'manual' | 'daily' | 'weekly' | 'monthly' = 'manual',
  ): Promise<BackupResult> {
    const startTime = Date.now();
    this.logger.log(`🔄 Starting ${type} database backup...`);

    try {
      await this.ensureBackupDirectory();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.config.database}_${type}_${timestamp}.sql`;
      const filePath = join(this.config.backupDir, filename);

      await this.performBackup(filePath);

      const stats = await fs.stat(filePath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      const compressedPath = await this.compressBackup(filePath);
      await fs.unlink(filePath);

      const duration = Date.now() - startTime;
      const compressedStats = await fs.stat(compressedPath);

      this.logger.log(
        `✅ Backup completed: ${compressedPath} (${this.formatFileSize(compressedStats.size)}) in ${duration}ms`,
      );

      await this.cleanupOldBackups(type);

      return {
        success: true,
        filename: `${filename}.gz`,
        filePath: compressedPath,
        size: compressedStats.size,
        duration,
      };
    } catch (error) {
      this.logger.error(`❌ Backup failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.config.backupDir);
    } catch {
      await fs.mkdir(this.config.backupDir, { recursive: true });
      this.logger.log(`📁 Created backup directory: ${this.config.backupDir}`);
    }
  }

  private async performBackup(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pgDumpArgs = [
        '-h',
        this.config.host,
        '-p',
        this.config.port.toString(),
        '-U',
        this.config.username,
        '-d',
        this.config.database,
        '--verbose',
        '--clean',
        '--if-exists',
        '--create',
        '--inserts',
        '--column-inserts',
        '--disable-triggers',
        '-f',
        filePath,
      ];

      const env = {
        ...process.env,
        PGPASSWORD: this.config.password,
      };

      const pgDump = spawn('pg_dump', pgDumpArgs, { env });

      let stderr = '';

      pgDump.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump failed with code ${code}: ${stderr}`));
        }
      });

      pgDump.on('error', (error) => {
        reject(new Error(`Failed to start pg_dump: ${error.message}`));
      });
    });
  }

  private async compressBackup(filePath: string): Promise<string> {
    const compressedPath = `${filePath}.gz`;

    return new Promise((resolve, reject) => {
      const gzip = spawn('gzip', ['-9', filePath]);

      gzip.on('close', (code) => {
        if (code === 0) {
          resolve(compressedPath);
        } else {
          reject(new Error(`Compression failed with code ${code}`));
        }
      });

      gzip.on('error', (error) => {
        reject(new Error(`Failed to compress backup: ${error.message}`));
      });
    });
  }

  private async cleanupOldBackups(type: string): Promise<void> {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backupFiles = files
        .filter(
          (file) => file.includes(`_${type}_`) && file.endsWith('.sql.gz'),
        )
        .map(async (file) => {
          const filePath = join(this.config.backupDir, file);
          const stats = await fs.stat(filePath);
          return { file, filePath, mtime: stats.mtime };
        });

      const backupInfo = await Promise.all(backupFiles);
      backupInfo.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      let retentionCount: number;
      switch (type) {
        case 'daily':
          retentionCount = this.config.retention.daily;
          break;
        case 'weekly':
          retentionCount = this.config.retention.weekly;
          break;
        case 'monthly':
          retentionCount = this.config.retention.monthly;
          break;
        default:
          retentionCount = 5;
      }

      const filesToDelete = backupInfo.slice(retentionCount);

      for (const fileInfo of filesToDelete) {
        await fs.unlink(fileInfo.filePath);
        this.logger.log(`🗑️ Deleted old backup: ${fileInfo.file}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Failed to cleanup old backups: ${error.message}`);
    }
  }

  async restoreBackup(
    backupFilePath: string,
    targetDatabase?: string,
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const dbName = targetDatabase || this.config.database;

    this.logger.log(
      `🔄 Starting database restore from ${backupFilePath} to ${dbName}...`,
    );

    try {
      await fs.access(backupFilePath);

      let sqlFilePath = backupFilePath;
      if (backupFilePath.endsWith('.gz')) {
        sqlFilePath = await this.decompressBackup(backupFilePath);
      }

      if (dbName === this.config.database) {
        this.logger.warn(`⚠️ Dropping existing database: ${dbName}`);
        await this.dropDatabase(dbName);
      }

      await this.performRestore(sqlFilePath, dbName);

      if (sqlFilePath !== backupFilePath) {
        await fs.unlink(sqlFilePath);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Database restore completed in ${duration}ms`);

      return {
        success: true,
        duration,
      };
    } catch (error) {
      this.logger.error(`❌ Restore failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async decompressBackup(compressedPath: string): Promise<string> {
    const sqlPath = compressedPath.replace('.gz', '');

    return new Promise((resolve, reject) => {
      const gunzip = spawn('gunzip', ['-c', compressedPath]);
      const writeStream = require('fs').createWriteStream(sqlPath);

      gunzip.stdout.pipe(writeStream);

      gunzip.on('close', (code) => {
        if (code === 0) {
          resolve(sqlPath);
        } else {
          reject(new Error(`Decompression failed with code ${code}`));
        }
      });

      gunzip.on('error', (error) => {
        reject(new Error(`Failed to decompress backup: ${error.message}`));
      });
    });
  }

  private async dropDatabase(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const dropArgs = [
        '-h',
        this.config.host,
        '-p',
        this.config.port.toString(),
        '-U',
        this.config.username,
        '--if-exists',
        dbName,
      ];

      const env = {
        ...process.env,
        PGPASSWORD: this.config.password,
      };

      const dropDb = spawn('dropdb', dropArgs, { env });

      dropDb.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to drop database with code ${code}`));
        }
      });

      dropDb.on('error', (error) => {
        reject(new Error(`Failed to start dropdb: ${error.message}`));
      });
    });
  }

  private async performRestore(
    sqlFilePath: string,
    dbName: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const psqlArgs = [
        '-h',
        this.config.host,
        '-p',
        this.config.port.toString(),
        '-U',
        this.config.username,
        '-d',
        'postgres',
        '-f',
        sqlFilePath,
      ];

      const env = {
        ...process.env,
        PGPASSWORD: this.config.password,
      };

      const psql = spawn('psql', psqlArgs, { env });

      let stderr = '';

      psql.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      psql.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Restore failed with code ${code}: ${stderr}`));
        }
      });

      psql.on('error', (error) => {
        reject(new Error(`Failed to start psql: ${error.message}`));
      });
    });
  }

  async listBackups(): Promise<
    Array<{
      filename: string;
      type: string;
      date: Date;
      size: number;
      formattedSize: string;
    }>
  > {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backupFiles = files.filter((file) => file.endsWith('.sql.gz'));

      const backupInfo = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = join(this.config.backupDir, file);
          const stats = await fs.stat(filePath);

          const typeMatch = file.match(/_(\w+)_\d{4}-\d{2}-\d{2}/);
          const type = typeMatch ? typeMatch[1] : 'unknown';

          return {
            filename: file,
            type,
            date: stats.mtime,
            size: stats.size,
            formattedSize: this.formatFileSize(stats.size),
          };
        }),
      );

      return backupInfo.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      this.logger.error(`Failed to list backups: ${error.message}`);
      return [];
    }
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  async getBackupStatistics(): Promise<{
    totalBackups: number;
    totalSize: number;
    formattedTotalSize: string;
    oldestBackup?: Date;
    newestBackup?: Date;
    backupsByType: Record<string, number>;
  }> {
    const backups = await this.listBackups();

    const stats = {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
      formattedTotalSize: '',
      oldestBackup:
        backups.length > 0 ? backups[backups.length - 1].date : undefined,
      newestBackup: backups.length > 0 ? backups[0].date : undefined,
      backupsByType: {} as Record<string, number>,
    };

    stats.formattedTotalSize = this.formatFileSize(stats.totalSize);

    backups.forEach((backup) => {
      stats.backupsByType[backup.type] =
        (stats.backupsByType[backup.type] || 0) + 1;
    });

    return stats;
  }
}

async function runBackupScript() {
  const logger = new Logger('DatabaseBackupScript');

  try {
    const args = process.argv.slice(2);
    const command = args[0] || 'backup';
    const type = args[1] || 'manual';

    const config: BackupConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_DATABASE || 'voting_system',
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      backupDir: process.env.BACKUP_DIR || './backups',
      retention: {
        daily: parseInt(process.env.BACKUP_RETENTION_DAILY || '7'),
        weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY || '4'),
        monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY || '12'),
      },
    };

    const backupService = new DatabaseBackupService(config);

    switch (command) {
      case 'backup':
        const result = await backupService.createBackup(type as any);
        if (result.success) {
          logger.log(`✅ Backup created: ${result.filename}`);
        } else {
          logger.error(`❌ Backup failed: ${result.error}`);
          process.exit(1);
        }
        break;

      case 'restore':
        const backupPath = args[1];
        const targetDb = args[2];
        if (!backupPath) {
          logger.error('❌ Backup file path required for restore');
          process.exit(1);
        }

        const restoreResult = await backupService.restoreBackup(
          backupPath,
          targetDb,
        );
        if (restoreResult.success) {
          logger.log(`✅ Database restored from ${backupPath}`);
        } else {
          logger.error(`❌ Restore failed: ${restoreResult.error}`);
          process.exit(1);
        }
        break;

      case 'list':
        const backups = await backupService.listBackups();
        logger.log('📋 Available backups:');
        backups.forEach((backup) => {
          logger.log(
            `  ${backup.filename} (${backup.type}, ${backup.formattedSize})`,
          );
        });
        break;

      case 'stats':
        const stats = await backupService.getBackupStatistics();
        logger.log('📊 Backup statistics:');
        logger.log(
          `  Total: ${stats.totalBackups} backups (${stats.formattedTotalSize})`,
        );
        logger.log(`  Types: ${JSON.stringify(stats.backupsByType)}`);
        break;

      default:
        logger.log('Usage:');
        logger.log('  npm run backup -- backup [daily|weekly|monthly|manual]');
        logger.log(
          '  npm run backup -- restore <backup-file> [target-database]',
        );
        logger.log('  npm run backup -- list');
        logger.log('  npm run backup -- stats');
        break;
    }
  } catch (error) {
    logger.error(`❌ Script failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  runBackupScript();
}
