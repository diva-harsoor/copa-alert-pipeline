import { useState, useEffect } from 'react';
import {APIProvider, Map, AdvancedMarker, InfoWindow} from '@vis.gl/react-google-maps';
import './MapView.css';

function MapView( {propertyData, setSelectedListing} ) {
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [hoverTimeout, setHoverTimeout] = useState(null);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const handleZoomIn = () => {
    // Placeholder for zoom functionality
    console.log('Zoom in clicked');
  };

  const handleZoomOut = () => {
    // Placeholder for zoom functionality
    console.log('Zoom out clicked');
  };

  const handleResetView = () => {
    // Placeholder for reset view functionality
    console.log('Reset view clicked');
  };

  return (
    <APIProvider apiKey={googleMapsApiKey}>
      <Map
        center={{ lat: 37.75, lng: -122.44 }}
        zoom={12.5}
        mapId="f8ee6d0fa08a34dff1b50156"
      >

        {propertyData.map(listing => (
          <AdvancedMarker
            key={listing.id}
            position={{ lat: listing.location.lat, lng: listing.location.lng }}
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
            <div className="marker-icon"  
            />
          </AdvancedMarker>
        ))}

        {/* Info window */}
        {hoveredMarker && (
          <InfoWindow
            position={{ lat: hoveredMarker.location.lat + 0.005, lng: hoveredMarker.location.lng }}
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
              setHoverTimeout(timeout)
            }}
          >
            <div>
              <h3>{hoveredMarker.address.street_address}</h3>
              <p>{hoveredMarker.basic_property_info.total_units} units</p>
              <p>{hoveredMarker.financial_data.average_rent? hoveredMarker.listing.financial_data.average_rent : 'Average rent not available'}</p>
            </div>        
          </InfoWindow>
        )

        }
        


      </Map>
    </APIProvider>
);
}

export default MapView;
