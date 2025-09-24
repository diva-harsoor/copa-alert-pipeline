function MapView() {
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
    <div className="relative h-full w-full">
      {/* Static Map Background */}
      <img 
        src="/StaticMapOfSF.png" 
        alt="Map of San Francisco" 
        className="h-full w-full object-cover"
      />
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 flex items-center justify-center text-gray-700 font-bold text-lg"
          title="Zoom In"
        >
          +
        </button>
        
        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 flex items-center justify-center text-gray-700 font-bold text-lg"
          title="Zoom Out"
        >
          −
        </button>
        
        {/* Reset to Default View */}
        <button
          onClick={handleResetView}
          className="w-10 h-10 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 flex items-center justify-center text-gray-700"
          title="Reset View"
        >
          🏠
        </button>
      </div>
    </div>
  );
}

export default MapView;
