import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [propertyData, setPropertyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/property-data.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load property data')
        }
        return response.json();
      })
      .then(data => {
        setPropertyData(data.listings)
        setLoading(false)
      })
      .catch(error => {
        console.error('Error loading data:', error)
        setError(error.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading property data...</div>
  if (error) return <div>Error loading property data: {error}</div>

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            COPA Property Listings
          </h1>
          <p className="text-lg text-gray-600">
            Found {propertyData.length} properties
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {propertyData.map(listing => (
            <div key={listing.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200 overflow-hidden">
              <div className="p-6">
                <div className="mb-4">
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
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
