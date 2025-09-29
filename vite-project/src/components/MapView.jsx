import { useState, useEffect } from 'react';
import {APIProvider, Map, AdvancedMarker, InfoWindow} from '@vis.gl/react-google-maps';
import './MapView.css';

function MapView( {propertyData, setSelectedListing} ) {
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Helper function to extract lat/lng from GeoJSON
  const getLatLng = (location) => {
    if (!location || !location.coordinates) return null;
    
    // GeoJSON format is [longitude, latitude]
    const [lng, lat] = location.coordinates;
    return { lat, lng };
  };

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
              <h3>{hoveredMarker.details.address_breakdown.street_address}</h3>
              {hoveredMarker.total_units > 0 &&
                <p>{hoveredMarker.total_units} units</p>
              }
              {hoveredMarker.details.financial_data?.average_rent &&
                <p>{hoveredMarker.details.financial_data?.average_rent}</p>
              }
            </div>        
          </InfoWindow>
        )}

      </Map>
    </APIProvider>
  );
}

export default MapView;