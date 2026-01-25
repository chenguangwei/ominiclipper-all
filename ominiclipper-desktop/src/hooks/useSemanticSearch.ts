import { useState, useEffect, useRef } from 'react';
import { vectorStoreService } from '@/services/vectorStoreService';

export const useSemanticSearch = (searchTerm: string) => {
    const [isSemanticSearchEnabled, setIsSemanticSearchEnabled] = useState(true);
    const [semanticSearchResults, setSemanticSearchResults] = useState<string[]>([]);
    const [isSemanticSearching, setIsSemanticSearching] = useState(false);
    const semanticSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Clear previous timeout
        if (semanticSearchTimeoutRef.current) {
            clearTimeout(semanticSearchTimeoutRef.current);
        }

        // If search is empty or semantic search is disabled, clear results
        if (!searchTerm || !isSemanticSearchEnabled) {
            setSemanticSearchResults([]);
            setIsSemanticSearching(false);
            return;
        }

        // Debounce semantic search (300ms)
        setIsSemanticSearching(true);
        semanticSearchTimeoutRef.current = setTimeout(async () => {
            try {
                const results = await vectorStoreService.search(searchTerm, 20);
                setSemanticSearchResults(results.map(r => r.id));
            } catch (err) {
                console.error('[App] Semantic search error:', err);
                setSemanticSearchResults([]);
            } finally {
                setIsSemanticSearching(false);
            }
        }, 300);

        return () => {
            if (semanticSearchTimeoutRef.current) {
                clearTimeout(semanticSearchTimeoutRef.current);
            }
        };
    }, [searchTerm, isSemanticSearchEnabled]);

    return {
        isSemanticSearchEnabled,
        setIsSemanticSearchEnabled,
        semanticSearchResults,
        isSemanticSearching
    };
};
