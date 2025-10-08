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

function MapView( {propertyData, setSelectedListing, filter, setFilter, openModal} ) {
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const { neighborhoods, loading, error } = useNeighborhoods();

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

  function convertGeoJSONToLatLng(coordinates) {
    // Handle MultiPolygon outer array for multiple polygons
    if (coordinates[0][0][0] && Array.isArray(coordinates[0][0][0])) {
      return coordinates[0][0].map(([lng, lat]) => ({ lat, lng}));
    }
    // Handle Polygon
    return coordinates[0].map(([lng, lat]) => ({ lat, lng }));
  }

  const handleZoomIn = () => {
    console.log('Zoom in clicked');
  };

  const handleZoomOut = () => {
    console.log('Zoom out clicked');
  };

  const handleResetView = () => {
    console.log('Reset view clicked');
  };

  // Get position for hovered marker info window
  const hoveredPosition = hoveredMarker ? getLatLng(hoveredMarker.location) : null;

  return (
    <APIProvider apiKey={googleMapsApiKey}>
      <Map
        center={{ lat: 37.75, lng: -122.44 }}
        zoom={12.5}
        mapId="f8ee6d0fa08a34dff1b50156"
      >
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