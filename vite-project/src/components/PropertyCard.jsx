
export default function PropertyCard( { listing } ) {

    return (
              <div key={listing.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200 overflow-hidden">
                <div className="p-6">
                  <div className="mb-4">
                      <p>
                        <span className="font-medium text-gray-900">Date:</span>{' '}
                        {listing.date?.toLocaleString()}
                      </p>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {listing.address?.full_address || 'Address not available'}
                    </h3>
                    {listing.financial_data?.asking_price && (
                      <p className="text-2xl font-bold text-green-600">
                        ${listing.financial_data.asking_price.toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-gray-900">Seller:</span>{' '}
                      {listing.seller_info?.seller_name || 'N/A'}
                    </p>
                    {listing.financial_data?.total_monthly_income && (
                      <p>
                        <span className="font-medium text-gray-900">Monthly Income:</span>{' '}
                        ${listing.financial_data.total_monthly_income.toLocaleString()}
                      </p>
                    )}
                    {listing.financial_data?.net_operating_income && (
                      <p>
                        <span className="font-medium text-gray-900">NOI:</span>{' '}
                        ${listing.financial_data.net_operating_income.toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Source: {listing.source.split('/').pop()}
                    </p>
                  </div>
                </div>
              </div>
      )
}