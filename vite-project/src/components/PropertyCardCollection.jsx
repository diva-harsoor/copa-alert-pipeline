import PropertyCard from './PropertyCard'

export default function PropertyCardCollection( { propertyData, selectedListing, setSelectedListing, setModalIsOpen  } ) {

    return (
          <div className="flex flex-col space-y-6 p-4">
            {selectedListing ? (
              <PropertyCard listing={selectedListing} expanded={true} setSelectedListing={setSelectedListing}/>
            ) : (
            <>
              <span className="text-gray-600 text-left">
                Found {propertyData.length} properties
              </span>
              {propertyData.map(listing => (
                <PropertyCard key={listing.id} listing={listing} setSelectedListing={setSelectedListing} setModalIsOpen={setModalIsOpen} />
              ))}
            </>
            )}
          </div>
      )
}