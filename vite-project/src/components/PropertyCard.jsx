
export default function PropertyCard({ listing, expanded, setSelectedListing }) {
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

  // Helper function to format percentage
  const formatPercent = (rate) => {
    if (!rate) return 'N/A';
    return `${rate}%`;
  };

  // Helper function to get days remaining color
  const getDaysRemainingColor = (days) => {
    if (days <= 2) return 'text-red-600 bg-red-100';
    if (days <= 4) return 'text-orange-600 bg-orange-100';
    return 'text-amber-700 bg-amber-100';
  };

  return (
    <div className="py-4 border-b border-gray-200 text-left">
      {/* Header */}
      <div className="mb-3">
        {expanded && (
          <div className="flex justify-end">
            <button 
              className="px-3 py-1 text-xs rounded hover:text-red-600"
              onClick={() => setSelectedListing(null)}>
              Return to full list
            </button>
          </div>
        )
        }
        <h3 className="font-semibold text-lg text-gray-900">{listing.address.street_address}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-gray-600 text-sm">{listing.neighborhood || 'Neighborhood not available'}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDaysRemainingColor(3)}`}>
            3 {listing.daysRemaining} days left
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <span className="text-gray-500">Date Listed:</span>
          <span className="ml-2 font-medium">{listing.date || 'Date not available'}</span>
        </div>
        
        <div>
          <span className="text-gray-500">Total Units:</span>
          <span className="ml-2 font-medium">{listing.basic_property_info.total_units || 'Not available'}</span>
        </div>

        <div>
          <span className="text-gray-500">Avg Rent:</span>
          <span className="ml-2 font-medium">{listing.averageRent ? formatCurrency(listing.averageRent) : 'Not available'}</span>
        </div>

        <div>
          <span className="text-gray-500">Residential:</span>
          <span className="ml-2 font-medium">{listing.basic_property_info.residential_units || 'Not available'}</span>
        </div>

        <div>
          <span className="text-gray-500">Vacant Res:</span>
          <span className="ml-2 font-medium">{listing.basic_property_info.vacant_residential || 'Not available'}</span>
        </div>

        <div>
          <span className="text-gray-500">Commercial:</span>
          <span className="ml-2 font-medium">{listing.basic_property_info.commercial_units || 'Not available'}</span>
        </div>

        <div>
          <span className="text-gray-500">Vacant Com:</span>
          <span className="ml-2 font-medium">{listing.basic_property_info.vacant_commercial || 'Not available'}</span>
        </div>

        <div>
          <span className="text-gray-500">Unit Mix:</span>
          <span className="ml-2 font-medium">{listing.basic_property_infounit_mix || 'Not available'}</span>
        </div>

        <div>
          <span className="text-gray-500">NOI:</span>
          <span className="ml-2 font-medium">{listing.financial_data.net_operating_income ? formatCurrency(listing.financial_data.net_operating_income) : 'Not available'}</span>
        </div>

        <div>
          <span className="text-gray-500">Cap Rate:</span>
          <span className="ml-2 font-medium">{listing.capRate ? formatPercent(listing.capRate) : 'Not available'}</span>
        </div>

        <div>
          <span className="text-gray-500">Asking Price:</span>
          <span className="ml-2 font-medium">{listing.askingPrice ? formatCurrency(listing.askingPrice) : 'Not available'}</span>
        </div>

        <div className="flex justify-end">
          <button className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}