import React from 'react';
import './ImportProgress.css';

export interface ImportProgressProps {
    isVisible: boolean;
    status: 'preparing' | 'classifying' | 'importing' | 'indexing' | 'complete' | 'error';
    fileName?: string;
    progress?: number; // 0-100
    message?: string;
}

const statusLabels: Record<ImportProgressProps['status'], { label: string; icon: string }> = {
    preparing: { label: 'Preparing...', icon: '📂' },
    classifying: { label: 'AI Classifying...', icon: '🤖' },
    importing: { label: 'Importing...', icon: '📥' },
    indexing: { label: 'Indexing...', icon: '🔍' },
    complete: { label: 'Complete!', icon: '✅' },
    error: { label: 'Error', icon: '❌' },
};

const ImportProgress: React.FC<ImportProgressProps> = ({
    isVisible,
    status,
    fileName,
    progress,
    message,
}) => {
    if (!isVisible) return null;

    const { label, icon } = statusLabels[status] || statusLabels.preparing;
    const isComplete = status === 'complete';
    const isError = status === 'error';

    return (
        <div className={`import-progress-overlay ${isComplete ? 'success' : ''} ${isError ? 'error' : ''}`}>
            <div className="import-progress-card">
                {/* Animated Icon */}
                <div className={`import-progress-icon ${status}`}>
                    <span className="icon-text">{icon}</span>
                    {!isComplete && !isError && (
                        <div className="icon-spinner"></div>
                    )}
                </div>

                {/* Status Text */}
                <div className="import-progress-content">
                    <h3 className="import-progress-title">{label}</h3>
                    {fileName && (
                        <p className="import-progress-filename">{fileName}</p>
                    )}
                    {message && (
                        <p className="import-progress-message">{message}</p>
                    )}
                </div>

                {/* Progress Bar */}
                {typeof progress === 'number' && !isComplete && !isError && (
                    <div className="import-progress-bar-container">
                        <div
                            className="import-progress-bar"
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        />
                    </div>
                )}

                {/* Indeterminate pulse for classifying */}
                {status === 'classifying' && typeof progress !== 'number' && (
                    <div className="import-progress-bar-container">
                        <div className="import-progress-bar indeterminate" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportProgress;
