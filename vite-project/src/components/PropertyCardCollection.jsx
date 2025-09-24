import PropertyCard from './PropertyCard'

export default function PropertyCardCollection( { propertyData } ) {

    return (
          <div className="flex flex-col space-y-6">
          <div className="text-center">
            <p className="text-lg text-gray-600">
              Found {propertyData.length} properties
            </p>
          </div>
            {propertyData.map(listing => (
              <PropertyCard key={listing.id} listing={listing} />
            ))}
          </div>
      )
}