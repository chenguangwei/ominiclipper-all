import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { FileStorageMode, ResourceType } from '../types';
import { formatFileSize } from '../services/fileManager';
import { aiClassifier } from '../services/aiClassifier';
import ruleEngine from '../services/ruleEngine';
import { ClassificationResult, ResourceItem as ClassificationResourceItem } from '../types/classification';

interface ScannedFile {
  name: string;
  path: string;
  extension: string;
  size: number;
  mimeType: string;
  modifiedAt: string;
}

// Classification result for a scanned file
interface FileClassification {
  file: ScannedFile;
  category?: string;
  subfolder?: string;
  suggestedTags?: string[];
  confidence?: number;
  reasoning?: string;
  error?: string;
}

interface FolderDropDialogProps {
  isOpen: boolean;
  folderPath: string | null;
  onClose: () => void;
  onConfirm: (files: ScannedFile[], mode: FileStorageMode, classifications?: FileClassification[]) => void;
}

type ClassifyMode = 'none' | 'rule' | 'ai';

const FolderDropDialog: React.FC<FolderDropDialogProps> = ({
  isOpen,
  folderPath,
  onClose,
  onConfirm,
}) => {
  const [selectedMode, setSelectedMode] = useState<FileStorageMode>('reference');
  const [classifyMode, setClassifyMode] = useState<ClassifyMode>('none');
  const [isScanning, setIsScanning] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [classifications, setClassifications] = useState<Map<string, FileClassification>>(new Map());
  const [classifyProgress, setClassifyProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Check if AI is configured
  const isAIConfigured = aiClassifier.isConfigured();

  // Scan folder when dialog opens
  useEffect(() => {
    if (isOpen && folderPath) {
      scanFolder();
    } else {
      // Reset state when closed
      setScannedFiles([]);
      setSelectedFiles(new Set());
      setClassifications(new Map());
      setClassifyMode('none');
      setError(null);
    }
  }, [isOpen, folderPath]);

  const scanFolder = async () => {
    if (!folderPath || !(window as any).electronAPI?.scanDirectory) {
      setError('Cannot scan directory: Electron API not available');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const result = await (window as any).electronAPI.scanDirectory(folderPath, {
        recursive: true,
        maxDepth: 5
      });

      if (result.success) {
        setScannedFiles(result.files);
        // Select all files by default
        setSelectedFiles(new Set(result.files.map((f: ScannedFile) => f.path)));
      } else {
        setError(result.error || 'Failed to scan directory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsScanning(false);
    }
  };

  // Convert scanned file to ResourceItem for classification
  const scannedFileToResourceItem = (file: ScannedFile): ClassificationResourceItem => {
    const getType = (ext: string): string => {
      switch (ext.toLowerCase()) {
        case '.pdf': return 'PDF';
        case '.doc': case '.docx': return 'WORD';
        case '.epub': return 'EPUB';
        case '.jpg': case '.jpeg': case '.png': case '.gif': case '.webp': return 'IMAGE';
        default: return 'UNKNOWN';
      }
    };

    return {
      id: file.path,
      title: file.name.replace(/\.[^/.]+$/, ''),
      type: getType(file.extension),
      tags: [],
      createdAt: file.modifiedAt,
      updatedAt: file.modifiedAt,
      path: file.path,
      localPath: file.path,
      fileSize: file.size,
      mimeType: file.mimeType,
      isCloud: false,
      isStarred: false,
      contentSnippet: `File: ${file.name}`
    };
  };

  // Run classification
  const runClassification = async () => {
    if (classifyMode === 'none') return;

    const selectedFilesList = scannedFiles.filter(f => selectedFiles.has(f.path));
    if (selectedFilesList.length === 0) return;

    setIsClassifying(true);
    setClassifyProgress({ current: 0, total: selectedFilesList.length });

    const newClassifications = new Map<string, FileClassification>();

    try {
      if (classifyMode === 'rule') {
        // Rule-based classification
        const resourceItems = selectedFilesList.map(scannedFileToResourceItem);
        const results = ruleEngine.classify(resourceItems);

        results.forEach((result, index) => {
          const file = selectedFilesList[index];
          newClassifications.set(file.path, {
            file,
            category: result.rule?.name || '未分类',
            subfolder: result.rule?.action.targetFolder,
            suggestedTags: result.rule?.action.tags,
            confidence: result.rule ? 1 : 0
          });
        });

        setClassifyProgress({ current: selectedFilesList.length, total: selectedFilesList.length });
      } else if (classifyMode === 'ai') {
        // AI-based classification
        const resourceItems = selectedFilesList.map(scannedFileToResourceItem);

        const results = await aiClassifier.classifyBatch(
          resourceItems,
          (processed, total) => setClassifyProgress({ current: processed, total })
        );

        results.forEach((result, index) => {
          const file = selectedFilesList[index];
          newClassifications.set(file.path, {
            file,
            category: result.category,
            subfolder: result.subfolder,
            suggestedTags: result.suggestedTags,
            confidence: result.confidence,
            reasoning: result.reasoning,
            error: result.error
          });
        });
      }

      setClassifications(newClassifications);
    } catch (err) {
      console.error('Classification error:', err);
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setIsClassifying(false);
    }
  };

  const toggleFileSelection = (filePath: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(filePath)) {
      newSelected.delete(filePath);
    } else {
      newSelected.add(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === scannedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(scannedFiles.map(f => f.path)));
    }
  };

  const handleConfirm = () => {
    const filesToImport = scannedFiles.filter(f => selectedFiles.has(f.path));
    const fileClassifications = filesToImport.map(f => classifications.get(f.path)).filter(Boolean) as FileClassification[];
    onConfirm(filesToImport, selectedMode, fileClassifications.length > 0 ? fileClassifications : undefined);
    setSelectedMode('reference');
    setClassifyMode('none');
  };

  const handleClose = () => {
    setSelectedMode('reference');
    setClassifyMode('none');
    onClose();
  };

  // Get file type icon
  const getFileIcon = (ext: string) => {
    switch (ext) {
      case '.pdf':
        return 'picture_as_pdf';
      case '.doc':
      case '.docx':
        return 'description';
      case '.epub':
        return 'auto_stories';
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.webp':
        return 'image';
      default:
        return 'article';
    }
  };

  // Get file type color
  const getFileColor = (ext: string) => {
    switch (ext) {
      case '.pdf':
        return 'text-red-400';
      case '.doc':
      case '.docx':
        return 'text-blue-400';
      case '.epub':
        return 'text-purple-400';
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.webp':
        return 'text-green-400';
      default:
        return 'text-slate-400';
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence?: number) => {
    if (confidence === undefined) return 'text-slate-400';
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const totalSize = scannedFiles
    .filter(f => selectedFiles.has(f.path))
    .reduce((sum, f) => sum + f.size, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl bg-[#252525] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/20">
              <Icon name="folder" className="text-xl text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Import Folder</h2>
              <p className="text-xs text-slate-400 truncate max-w-[300px]">{folderPath}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isScanning ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Icon name="sync" className="text-[48px] text-primary animate-spin mb-4" />
                <p className="text-white">Scanning folder...</p>
                <p className="text-xs text-slate-400 mt-1">Looking for documents</p>
              </div>
            </div>
          ) : isClassifying ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Icon name="auto_awesome" className="text-[48px] text-primary animate-pulse mb-4" />
                <p className="text-white">Classifying files...</p>
                <p className="text-xs text-slate-400 mt-1">
                  {classifyProgress.current} / {classifyProgress.total}
                </p>
                <div className="w-48 h-1.5 bg-white/10 rounded-full mt-3 mx-auto overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(classifyProgress.current / classifyProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Icon name="error" className="text-[48px] text-red-400 mb-4" />
                <p className="text-white">Failed to scan folder</p>
                <p className="text-xs text-red-400 mt-1">{error}</p>
              </div>
            </div>
          ) : scannedFiles.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <Icon name="folder_off" className="text-[48px] text-slate-500 mb-4" />
                <p className="text-white">No supported files found</p>
                <p className="text-xs text-slate-400 mt-1">Supported: PDF, Word, EPUB, Images</p>
              </div>
            </div>
          ) : (
            <>
              {/* File list header */}
              <div className="flex items-center justify-between px-5 py-2 bg-black/20 border-b border-white/5 shrink-0">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === scannedFiles.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-white/20 bg-black/30 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-300">
                    Select All ({scannedFiles.length} files)
                  </span>
                </label>
                <span className="text-xs text-slate-400">
                  {selectedFiles.size} selected ({formatFileSize(totalSize)})
                </span>
              </div>

              {/* File list */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {scannedFiles.map((file) => {
                  const classification = classifications.get(file.path);
                  return (
                    <label
                      key={file.path}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedFiles.has(file.path)
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.path)}
                        onChange={() => toggleFileSelection(file.path)}
                        className="w-4 h-4 rounded border-white/20 bg-black/30 text-primary focus:ring-primary shrink-0"
                      />
                      <Icon
                        name={getFileIcon(file.extension)}
                        className={`text-[24px] ${getFileColor(file.extension)} shrink-0`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{file.name}</p>
                        {classification ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs ${getConfidenceColor(classification.confidence)}`}>
                              {classification.category || '未分类'}
                            </span>
                            {classification.subfolder && (
                              <span className="text-xs text-slate-500">
                                → {classification.subfolder}
                              </span>
                            )}
                            {classification.suggestedTags && classification.suggestedTags.length > 0 && (
                              <span className="text-xs text-primary">
                                #{classification.suggestedTags[0]}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 truncate">{file.path}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {formatFileSize(file.size)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Classification Mode Selection */}
        {scannedFiles.length > 0 && !isScanning && !isClassifying && (
          <div className="px-5 py-4 border-t border-white/10 bg-black/20 shrink-0">
            <h3 className="text-sm font-medium text-white mb-3">Smart Classification</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {/* No Classification */}
              <button
                onClick={() => {
                  setClassifyMode('none');
                  setClassifications(new Map());
                }}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                  classifyMode === 'none'
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 bg-black/20 hover:bg-black/30'
                }`}
              >
                <Icon name="block" className="text-[18px] text-slate-400" />
                <span className="text-xs text-white">None</span>
              </button>

              {/* Rule-based */}
              <button
                onClick={() => setClassifyMode('rule')}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                  classifyMode === 'rule'
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 bg-black/20 hover:bg-black/30'
                }`}
              >
                <Icon name="rule" className="text-[18px] text-amber-400" />
                <span className="text-xs text-white">Rules</span>
              </button>

              {/* AI-based */}
              <button
                onClick={() => setClassifyMode('ai')}
                disabled={!isAIConfigured}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                  classifyMode === 'ai'
                    ? 'border-primary bg-primary/10'
                    : !isAIConfigured
                    ? 'border-white/5 bg-black/10 opacity-50 cursor-not-allowed'
                    : 'border-white/10 bg-black/20 hover:bg-black/30'
                }`}
                title={!isAIConfigured ? 'Configure AI in Settings' : undefined}
              >
                <Icon name="auto_awesome" className="text-[18px] text-purple-400" />
                <span className="text-xs text-white">AI</span>
                {!isAIConfigured && (
                  <Icon name="lock" className="text-[12px] text-slate-500 ml-auto" />
                )}
              </button>
            </div>

            {classifyMode !== 'none' && classifications.size === 0 && (
              <button
                onClick={runClassification}
                disabled={selectedFiles.size === 0}
                className="w-full py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Icon name="auto_awesome" className="text-[16px]" />
                Run Classification
              </button>
            )}

            {classifications.size > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Icon name="check_circle" className="text-green-400" />
                <span>{classifications.size} files classified</span>
                <button
                  onClick={() => setClassifications(new Map())}
                  className="ml-auto text-slate-500 hover:text-white"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* Storage Mode Selection */}
        {scannedFiles.length > 0 && !isScanning && !isClassifying && (
          <div className="px-5 py-4 border-t border-white/10 bg-black/20 shrink-0">
            <h3 className="text-sm font-medium text-white mb-3">Storage Mode</h3>
            <div className="grid grid-cols-2 gap-2">
              {/* Reference Mode */}
              <button
                onClick={() => setSelectedMode('reference')}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                  selectedMode === 'reference'
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 bg-black/20 hover:bg-black/30'
                }`}
              >
                <Icon name="link" className="text-[20px] text-primary mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Store Path Only</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Reference original files
                  </p>
                </div>
                {selectedMode === 'reference' && (
                  <Icon name="check_circle" className="text-primary shrink-0" />
                )}
              </button>

              {/* Embed Mode */}
              <button
                onClick={() => setSelectedMode('embed')}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                  selectedMode === 'embed'
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 bg-black/20 hover:bg-black/30'
                }`}
              >
                <Icon name="file_copy" className="text-[20px] text-primary mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Embed Files</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Copy files to app storage
                  </p>
                </div>
                {selectedMode === 'embed' && (
                  <Icon name="check_circle" className="text-primary shrink-0" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-black/20 shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedFiles.size === 0 || isScanning || isClassifying}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg bg-primary hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import {selectedFiles.size > 0 ? `(${selectedFiles.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderDropDialog;
