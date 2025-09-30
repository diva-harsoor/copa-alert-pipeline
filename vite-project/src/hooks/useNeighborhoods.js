import { useState, useEffect } from 'react';

export function useNeighborhoods() {
    const [neighborhoods, setNeighborhoods] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchNeighborhoods() {
            try {
                const response = await fetch('https://data.sfgov.org/resource/gfpk-269f.json?$limit=2000');
                const data = await response.json();
                setNeighborhoods(data);
                setLoading(false)
            } catch (error) {
                console.error('Error fetching neighborhoods:', error)
                setLoading(false)
            }
        }
        fetchNeighborhoods();
    }, []);

    return { neighborhoods, loading, error };
}

