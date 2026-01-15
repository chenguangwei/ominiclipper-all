/**
 * OmniClipper - File Organizer Service
 * 文件整理服务 - 根据分类结果自动整理文件
 */

import {
  ClassificationResult,
  ResourceItem,
  FileOrganizerConfig,
  OrganizeReport,
  Folder
} from '../types/classification';
import * as storageService from './storageService';
import * as fileManager from './fileManager';

// 默认配置
const DEFAULT_CONFIG: FileOrganizerConfig = {
  baseFolder: 'Documents/OmniClipper',
  createSubfolders: true,
  handleDuplicates: 'rename',
  preserveOriginalPath: false,
  confidenceThreshold: 0.6
};

class FileOrganizer {
  private config: FileOrganizerConfig = DEFAULT_CONFIG;

  /**
   * 配置整理服务
   */
  configure(config: Partial<FileOrganizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): FileOrganizerConfig {
    return { ...this.config };
  }

  /**
   * 整理文件
   */
  async organize(
    results: ClassificationResult[],
    config?: Partial<FileOrganizerConfig>
  ): Promise<OrganizeReport> {
    const report: OrganizeReport = {
      success: 0,
      failed: 0,
      skipped: 0,
      createdFolders: [],
      details: []
    };

    const effectiveConfig = { ...this.config, ...config };

    for (const result of results) {
      // 跳过没有分类结果的文件
      if (!result.category && !result.rule) {
        report.skipped++;
        report.details.push({ item: result.item, error: 'No classification result' });
        continue;
      }

      // 根据置信度决定是否跳过
      if (result.confidence && result.confidence < (effectiveConfig.confidenceThreshold || 0.6)) {
        report.skipped++;
        report.details.push({
          item: result.item,
          error: `Low confidence: ${result.confidence}`
        });
        continue;
      }

      try {
        // 确定目标文件夹
        const targetFolder = this.getTargetFolder(result, effectiveConfig);

        // 确保文件夹存在
        await this.ensureFolder(targetFolder, effectiveConfig);

        // 执行整理操作
        await this.moveOrCopyFile(result.item, targetFolder, effectiveConfig);

        // 更新数据库
        await this.updateItemRecord(result.item, targetFolder, result);

        report.success++;
        if (!report.createdFolders.includes(targetFolder)) {
          report.createdFolders.push(targetFolder);
        }
      } catch (error) {
        report.failed++;
        report.details.push({
          item: result.item,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return report;
  }

  /**
   * 获取目标文件夹路径
   */
  private getTargetFolder(
    result: ClassificationResult,
    config: FileOrganizerConfig
  ): string {
    // 优先级：AI subfolder > 规则 action.targetFolder > 默认文件夹
    if (result.subfolder) {
      return `${config.baseFolder}/${result.subfolder}`;
    }

    if (result.rule?.action.targetFolder) {
      const ruleFolder = result.rule.action.targetFolder;
      if (ruleFolder.startsWith('/') || ruleFolder.startsWith('.')) {
        return ruleFolder;
      }
      return `${config.baseFolder}/${ruleFolder}`;
    }

    return config.baseFolder;
  }

  /**
   * 确保文件夹存在
   */
  private async ensureFolder(
    folderPath: string,
    config: FileOrganizerConfig
  ): Promise<void> {
    if (!config.createSubfolders) return;

    // 规范化路径
    const normalizedPath = this.normalizePath(folderPath);

    // 检查文件夹是否已存在
    const existingFolders = storageService.getFolders();
    const existingFolder = existingFolders.find(
      f => f.name === normalizedPath || f.id === normalizedPath
    );

    if (existingFolder) {
      return;
    }

    // 创建文件夹
    const parentPath = normalizedPath.split('/').slice(0, -1).join('/') || config.baseFolder;

    // 先创建父文件夹
    if (parentPath && parentPath !== config.baseFolder) {
      await this.ensureFolder(parentPath, config);
    }

    // 创建当前文件夹
    const newFolder: Omit<Folder, 'id'> = {
      name: normalizedPath.split('/').pop() || normalizedPath,
      parentId: parentPath === config.baseFolder ? undefined : parentPath,
      icon: 'folder'
    };

    storageService.addFolder(newFolder);
  }

  /**
   * 规范化路径
   */
  private normalizePath(path: string): string {
    return path
      .replace(/^\.?\//, '')           // 移除开头的 ./ 或 /
      .replace(/\/+/g, '/')             // 合并多个 /
      .trim();
  }

  /**
   * 移动或复制文件
   */
  private async moveOrCopyFile(
    item: ResourceItem,
    targetFolder: string,
    config: FileOrganizerConfig
  ): Promise<void> {
    // 确定操作类型（移动或复制）
    const actionType = item.folderId ? 'move' : 'copy';

    if (actionType === 'move') {
      // 移动文件
      if (item.localPath) {
        const newPath = await this.moveLocalFile(item.localPath, targetFolder);
        // 更新本地路径
        // 注意：这里需要通过 IPC 调用主进程
        if (window.electronAPI?.openPath) {
          // 文件已移动，无需额外操作
        }
      }
    }

    // 如果是复制模式，复制文件内容
    if (actionType === 'copy' && item.embeddedData) {
      // 已嵌入的数据无需复制
    }
  }

  /**
   * 移动本地文件
   */
  private async moveLocalFile(
    sourcePath: string,
    targetFolder: string
  ): Promise<string> {
    const fs = require('fs');
    const path = require('path');

    const fileName = path.basename(sourcePath);
    const newPath = path.join(targetFolder, fileName);

    // 确保目标目录存在
    const targetDir = path.dirname(newPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 处理重复文件名
    let finalPath = newPath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      finalPath = path.join(targetDir, `${baseName}_${counter}${ext}`);
      counter++;
    }

    // 移动文件
    fs.renameSync(sourcePath, finalPath);

    return finalPath;
  }

  /**
   * 更新数据库记录
   */
  private async updateItemRecord(
    item: ResourceItem,
    targetFolder: string,
    result: ClassificationResult
  ): Promise<void> {
    // 获取文件夹 ID
    const folders = storageService.getFolders();
    const folder = folders.find(f =>
      f.name === targetFolder.split('/').pop() ||
      f.id === targetFolder
    );

    // 合并标签
    const newTags = result.suggestedTags
      ? [...new Set([...item.tags, ...result.suggestedTags])]
      : item.tags;

    // 更新记录
    storageService.updateItem(item.id, {
      folderId: folder?.id,
      tags: newTags,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * 批量整理入口
   */
  async organizeFiles(
    items: ResourceItem[],
    results: ClassificationResult[],
    config?: Partial<FileOrganizerConfig>
  ): Promise<OrganizeReport> {
    // 更新 items 引用
    const updatedResults = results.map((result, index) => ({
      ...result,
      item: items[index] || result.item
    }));

    return this.organize(updatedResults, config);
  }

  /**
   * 预览整理结果（不实际执行）
   */
  previewOrganization(
    results: ClassificationResult[],
    config?: Partial<FileOrganizerConfig>
  ): Array<{
    item: ResourceItem;
    targetFolder: string;
    action: string;
    confidence: number | undefined;
  }> {
    const effectiveConfig = { ...this.config, ...config };

    return results
      .filter(r => r.confidence === undefined || (r.confidence ?? 0) >= (effectiveConfig.confidenceThreshold ?? 0.6))
      .map(result => ({
        item: result.item,
        targetFolder: this.getTargetFolder(result, effectiveConfig),
        action: result.rule?.action.type || 'tag',
        confidence: result.confidence
      }));
  }

  /**
   * 创建文件夹结构
   */
  async createFolderStructure(
    basePath: string,
    structure: Record<string, Record<string, any>>
  ): Promise<void> {
    for (const [folderName, subItems] of Object.entries(structure)) {
      const folderPath = `${basePath}/${folderName}`;

      // 创建文件夹
      await this.ensureFolder(folderPath, this.config);

      // 递归创建子文件夹
      if (subItems.folders) {
        await this.createFolderStructure(folderPath, subItems.folders);
      }
    }
  }

  /**
   * 撤销整理操作
   */
  async undo(
    report: OrganizeReport,
    originalItems: ResourceItem[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const detail of report.details) {
      if (detail.error) continue;

      try {
        const originalItem = originalItems.find(i => i.id === detail.item.id);
        if (originalItem) {
          // 恢复原始记录
          storageService.updateItem(detail.item.id, {
            folderId: originalItem.folderId,
            tags: originalItem.tags
          });
          success++;
        }
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 获取整理统计
   */
  getStats(): {
    totalOrganized: number;
    totalFoldersCreated: number;
    averageConfidence: number;
  } {
    // 从 storageService 获取统计数据
    const stats = storageService.getStats();
    return {
      totalOrganized: stats.total,
      totalFoldersCreated: storageService.getFolders().length,
      averageConfidence: 0.75 // 模拟值
    };
  }
}

// 导出单例
export const fileOrganizer = new FileOrganizer();
export default fileOrganizer;
