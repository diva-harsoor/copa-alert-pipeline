
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
        <h3 className="font-semibold text-lg text-gray-900">{listing.details.address_breakdown.street_address}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-gray-600 text-sm">{listing.neighborhood || 'Neighborhood not available'}</span>
          {getDaysCounter(listing.time_sent_tz)}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {listing.date &&
          <div>
            <span className="text-gray-500">Date Listed:</span>
            <span className="ml-2 font-medium">{listing.date}</span>
          </div>      
        }

        {listing.asking_price &&
          <div>
            <span className="text-gray-500">Asking Price:</span>
            <span className="ml-2 font-medium">{listing.asking_price ? formatCurrency(listing.asking_price) : 'Not available'}</span>
          </div>
        }

        {listing.total_units > 0 &&
          <div>
            <span className="text-gray-500">Total Units:</span>
            <span className="ml-2 font-medium">{listing.total_units || 'Not available'}</span>
          </div>
        }

        {listing.residential_units > 0 &&
        <div>
            <span className="text-gray-500">Residential:</span>
            <span className="ml-2 font-medium">{listing.residential_units || 'Not available'}</span>
          </div>
        }

        {listing.vacant_residential > 0 &&
          <div>
            <span className="text-gray-500">Vacant Res:</span>
            <span className="ml-2 font-medium">{listing.vacant_residential || 'Not available'}</span>
          </div>
        }

        {listing.commercial_units > 0&&
          <div>
            <span className="text-gray-500">Commercial:</span>
            <span className="ml-2 font-medium">{listing.commercial_units || 'Not available'}</span>
          </div>
        }

        {listing.vacant_commercial > 0 &&
          <div>
            <span className="text-gray-500">Vacant Com:</span>
            <span className="ml-2 font-medium">{listing.vacant_commercial || 'Not available'}</span>
          </div>
        }

        {listing.details.unit_mix &&
          <div>
            <span className="text-gray-500">Unit Mix:</span>
            <span className="ml-2 font-medium">{listing.details.unit_mix || 'Not available'}</span>
          </div>
        }

        {listing.details.financial_data &&
        <>
          {listing.details.financial_data.averageRent &&
            <div>
              <span className="text-gray-500">Avg Rent:</span>
              <span className="ml-2 font-medium">{listing.details.financial_data?.averageRent ? formatCurrency(listing.details.financial_data.averageRent) : 'Not available'}</span>
            </div>
          }

          {listing.details.financial_data.net_operating_income &&
          <div>
            <span className="text-gray-500">NOI:</span>
            <span className="ml-2 font-medium">{listing.details.financial_data?.net_operating_income ? formatCurrency(listing.details.financial_data.net_operating_income) : 'Not available'}</span>
          </div>
          }

          {listing.details.financial_data.capRate &&
          <div>
            <span className="text-gray-500">Cap Rate:</span>
            <span className="ml-2 font-medium">{listing.details.financial_data?.capRate ? formatPercent(listing.details.financial_data.capRate) : 'Not available'}</span>
          </div>
          }

          
        </>
        }

      </div>
      <div className="flex justify-end">
        <button className="px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
          Edit
        </button>
      </div>
    </div>
  );
}