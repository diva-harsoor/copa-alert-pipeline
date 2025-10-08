import { useState, useEffect, useRef } from 'react';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import './MapView.css';

const calculateDaysRemaining = (timeSentTz) => {
  if (!timeSentTz) return null;
  
  const sentDate = new Date(timeSentTz);
  const expiryDate = new Date(sentDate);
  expiryDate.setDate(expiryDate.getDate() + 5); // Add 5 days to sent date
  
  const now = new Date();
  const diffTime = expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays); // Return 0 if expired
};

// Helper function to get days remaining color
const getDaysCounter = (time_sent_tz) => {

  let days = calculateDaysRemaining(time_sent_tz)
  let text = 'days left';

  let color = 'text-amber-700 bg-amber-100';
  if (days <= 3) {
    color = 'text-orange-600 bg-orange-100';
  }
  if (days <= 1) {
    color = 'text-red-600 bg-red-100';
    text = 'day left';
  }

  if (days <= 0) {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100`}> 
        Past COPA 
      </span>
    );
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}> 
      {days} {text}
    </span>
  );
};

function NeighborhoodOverlay({ neighborhoods, handleNeighborhoodClick, selectedNeighborhoods }) {
  const map = useMap();
  const mapsLibrary = useMapsLibrary('maps');
  const polygonsRef = useRef([]);

  useEffect(() => {
    if (!map || !neighborhoods || !mapsLibrary) return;

    // Clear existing polygons
    polygonsRef.current.forEach(polygon => polygon.setMap(null));
    polygonsRef.current = [];

    // Create new polygons
    neighborhoods.forEach(neighborhood => {
      try {
        const coords = neighborhood.the_geom.coordinates;
        
        // Handle different GeoJSON geometry types
        let coordinates;
        if (neighborhood.the_geom.type === 'MultiPolygon') {
          // MultiPolygon: coordinates[0][0] gives first polygon's outer ring
          coordinates = coords[0][0].map(([lng, lat]) => ({ lat, lng }));
        } else {
          // Polygon: coordinates[0] gives outer ring
          coordinates = coords[0].map(([lng, lat]) => ({ lat, lng }));
        }

        const isSelected = selectedNeighborhoods.includes(neighborhood.name);

        const polygon = new mapsLibrary.Polygon({
          paths: coordinates,
          strokeColor: isSelected ? "#3B82F6" : "#9CA3AF",
          strokeWeight: isSelected ? 2 : 1,
          fillColor: isSelected ? "#3B82F6" : "#E5E7EB",
          fillOpacity: isSelected ? 0.3 : 0.1,
          clickable: true,
          map: map
        });

        polygon.addListener('click', () => {
          handleNeighborhoodClick(neighborhood.name);
        });

        polygonsRef.current.push(polygon);
      } catch (error) {
        console.error(`Error creating polygon for ${neighborhood.name}:`, error);
      }
    });

    // Cleanup
    return () => {
      polygonsRef.current.forEach(polygon => polygon.setMap(null));
    };
  }, [map, neighborhoods, mapsLibrary, handleNeighborhoodClick, selectedNeighborhoods]);

  return null;
}

function MapControls({ sfCenter, defaultZoom }) {
  const map = useMap();

  const handleZoomIn = () => {
    if (!map) return;
    const currentZoom = map.getZoom();
    map.setZoom(currentZoom + 1);
  };

  const handleZoomOut = () => {
    if (!map) return;
    const currentZoom = map.getZoom();
    map.setZoom(currentZoom - 1);
  };

  const handleResetView = () => {
    if (!map) return;
    map.panTo(sfCenter);
    map.setZoom(defaultZoom);
  };

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-lg p-2 z-10">
      <button
        onClick={handleZoomIn}
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        title="Zoom in"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
      <button
        onClick={handleZoomOut}
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        title="Zoom out"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <div className="border-t border-gray-200 my-1" />
      <button
        onClick={handleResetView}
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        title="Reset view"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}


function MapView( {propertyData, setSelectedListing, filter, setFilter, openModal} ) {
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const { neighborhoods, loading, error } = useNeighborhoods();

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const SF_CENTER = { lat: 37.75, lng: -122.44 };
  const DEFAULT_ZOOM = 12.5;

  // Helper function to extract lat/lng from GeoJSON
  const getLatLng = (location) => {
    if (!location || !location.coordinates) return null;
    
    // GeoJSON format is [longitude, latitude]
    const [lng, lat] = location.coordinates;
    return { lat, lng };
  };

  const handleNeighborhoodClick = (neighborhood) => {
    const updated = filter.neighborhoods.includes(neighborhood)
      ? filter.neighborhoods.filter(n => n !== neighborhood)
      : [...filter.neighborhoods, neighborhood];
    setFilter({...filter, neighborhoods: updated});
    console.log('Updated neighborhoods:', updated);
  }  

  // Get position for hovered marker info window
  const hoveredPosition = hoveredMarker ? getLatLng(hoveredMarker.location) : null;

  return (
    <APIProvider apiKey={googleMapsApiKey}>
      <Map
        defaultCenter={SF_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapId="f8ee6d0fa08a34dff1b50156"
        gestureHandling="greedy"
        restriction={{
          latLngBounds: {
            north: 37.85,  // Just north of SF
            south: 37.65,  // Just south of SF
            east: -122.30,  // East Bay side
            west: -122.55   // Pacific Ocean side
          },
          strictBounds: false 
        }}
        minZoom={11}
        maxZoom={19}
      >

      <MapControls sfCenter={SF_CENTER} defaultZoom={DEFAULT_ZOOM} />

        <NeighborhoodOverlay 
          neighborhoods={neighborhoods} 
          handleNeighborhoodClick={handleNeighborhoodClick} 
          selectedNeighborhoods={filter.neighborhoods || []}
        />

        {propertyData.map(listing => {
          const position = getLatLng(listing.location);
          
          // Skip if no valid coordinates
          if (!position) return null;

          return (
            <AdvancedMarker
              key={listing.id}
              position={position}
              onMouseEnter={() => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                setHoveredMarker(listing);
              }}
              onMouseLeave={() => {
                const timeout = setTimeout(() => {
                  setHoveredMarker(null);
                }, 150);
                setHoverTimeout(timeout);
              }}
              onClick={() => {
                setSelectedListing(listing);
                openModal(listing);
              }}
            >
              <div className="marker-icon" />
            </AdvancedMarker>
          );
        })}

        {/* Info window */}
        {hoveredMarker && hoveredPosition && (
          <InfoWindow
            position={{ lat: hoveredPosition.lat + 0.005, lng: hoveredPosition.lng }}
            options={{
              disableAutoPan: true,
              headerDisabled: true,
            }}
            onMouseEnter={() => {
              if (hoverTimeout) clearTimeout(hoverTimeout);
            }}
            onMouseLeave={() => {
              const timeout = setTimeout(() => {
                setHoveredMarker(null);
              }, 150);
              setHoverTimeout(timeout);
            }}
          >
            <div>
            <div className="mb-2">
              {getDaysCounter(hoveredMarker.time_sent_tz)}
            </div>
            <h3 className="mb-1">{hoveredMarker.address.street_address}</h3>
            <span className="mb-1">{hoveredMarker.neighborhood || 'Neighborhood not available'}</span>
            {hoveredMarker.total_units > 0 &&
              <p>{hoveredMarker.total_units} units</p>
            }
                        </div>        
          </InfoWindow>
        )}
        </Map>

    </APIProvider>
  );
}

export default MapView;