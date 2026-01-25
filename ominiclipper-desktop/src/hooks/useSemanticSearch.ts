import { useState, useEffect, useRef } from 'react';
import { vectorStoreService } from '@/services/vectorStoreService';

export const useSemanticSearch = (searchTerm: string) => {
    const [isSemanticSearchEnabled, setIsSemanticSearchEnabled] = useState(true);
    const [semanticSearchResults, setSemanticSearchResults] = useState<string[]>([]);
    const [isHybridSearchEnabled, setIsHybridSearchEnabled] = useState(true);
    const [isSemanticSearching, setIsSemanticSearching] = useState(false);
    const semanticSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (semanticSearchTimeoutRef.current) {
            clearTimeout(semanticSearchTimeoutRef.current);
        }

        if (!searchTerm || !isSemanticSearchEnabled) {
            setSemanticSearchResults([]);
            setIsSemanticSearching(false);
            return;
        }

        setIsSemanticSearching(true);
        semanticSearchTimeoutRef.current = setTimeout(async () => {
            try {
                let results;
                if (isHybridSearchEnabled) {
                    results = await vectorStoreService.hybridSearch(searchTerm, 20);
                } else {
                    results = await vectorStoreService.search(searchTerm, 20);
                }
                setSemanticSearchResults(results.map(r => r.id));
            } catch (err) {
                console.error('[App] Search error:', err);
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
    }, [searchTerm, isSemanticSearchEnabled, isHybridSearchEnabled]);

    return {
        isSemanticSearchEnabled,
        setIsSemanticSearchEnabled,
        isHybridSearchEnabled,
        setIsHybridSearchEnabled,
        semanticSearchResults,
        isSemanticSearching
    };
};
