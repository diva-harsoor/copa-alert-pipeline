import { useState, useEffect, useRef } from 'react';
import { useNeighborhoods } from '../hooks/useNeighborhoods';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import './MapView.css';


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
              <h3>{hoveredMarker.address.street_address}</h3>
              {hoveredMarker.total_units > 0 &&
                <p>{hoveredMarker.total_units} units</p>
              }
              {/*
              {hoveredMarker.details.financial_data?.average_rent &&
                <p>{hoveredMarker.details.financial_data?.average_rent}</p>
              }
              */}
            </div>        
          </InfoWindow>
        )}

      </Map>
    </APIProvider>
  );
}

export default MapView;