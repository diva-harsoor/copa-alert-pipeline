import SourceMaterials from './SourceMaterials'
import Editor from './Editor'

export default function PropertyInfoModal({ selectedListing, decryptedListing, decrypting, modalIsOpen, onClose }) {
    if (!modalIsOpen || !selectedListing) return null;
  
    // Helper function to format currency
    const formatCurrency = (amount) => {
      if (!amount) return 'N/A';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };
  
    const calculateDaysRemaining = (timeSentTz) => {
      if (!timeSentTz) return null;
      
      const sentDate = new Date(timeSentTz);
      const expiryDate = new Date(sentDate);
      expiryDate.setDate(expiryDate.getDate() + 5);
      
      const now = new Date();
      const diffTime = expiryDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return Math.max(0, diffDays);
    };
  
    const getDaysCounter = (time_sent_tz) => {
      let days = calculateDaysRemaining(time_sent_tz);
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
          <span className="px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100"> 
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
  
    const handleBackdropClick = (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    };
  
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-lg w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {selectedListing.address.street_address}
                </h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-gray-600">{selectedListing.neighborhood || 'Neighborhood not available'}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{selectedListing.total_units} Total Units</span>
                  <span className="text-gray-400">•</span>
                  {getDaysCounter(selectedListing.time_sent_tz)}
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
          </div>
  
          {/* Content Area - Two Panes */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Pane - Source Materials */}
            <div className="w-3/5 border-r border-gray-200 overflow-y-auto p-6">
            {/* 
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Source Materials</h3>
              <p className="text-gray-500 text-sm">Email and document viewer coming soon...</p>
            */}
              <SourceMaterials listingId={selectedListing.id} />
            </div>
  
            {/* Right Pane - Editor */}
            <div className="w-2/5 overflow-y-auto p-6">

              {decrypting && (
                <div className="p-4 text-center text-gray-500">
                  Decrypting listing details...
                </div>
              )}

              {!decrypting && decryptedListing && (
                <Editor listing={decryptedListing} />
              )}
              
            </div>
          </div>
        </div>
      </div>
    );
  }