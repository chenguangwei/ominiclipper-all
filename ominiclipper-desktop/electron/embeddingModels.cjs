/**
 * Embedding Model Definitions
 * 
 * Defines supported models for VectorService.
 */

const MODELS = {
    'all-MiniLM-L6-v2': {
        id: 'all-MiniLM-L6-v2',
        name: 'Xenova/all-MiniLM-L6-v2',
        dim: 384,
        tableName: 'documents', // Use 'documents' for backward compatibility
        description: 'Lightweight (80MB), Fast, 384d. Best for English.',
        quantized: true
    },
    'bge-m3': {
        id: 'bge-m3',
        name: 'Xenova/bge-m3',
        dim: 1024,
        tableName: 'documents_bge_m3',
        description: 'High Precision (500MB+), Multi-lingual, 1024d. Slower but better quality.',
        quantized: true
    }
};

const DEFAULT_MODEL_ID = 'bge-m3';

// Helper to get model config safely
function getModelConfig(modelId) {
    return MODELS[modelId] || MODELS[DEFAULT_MODEL_ID];
}

module.exports = {
    MODELS,
    DEFAULT_MODEL_ID,
    getModelConfig
};
