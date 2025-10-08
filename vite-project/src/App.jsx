import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { supabase } from './supabase'
import Auth from './components/Auth'
import PropertyCardCollection from './components/PropertyCardCollection'
import FilterView from './components/FilterView'
import MapView from './components/MapView'
import NavBar from './components/NavBar'
import PropertyInfoModal from './components/PropertyInfoModal.jsx'
// import './migrate-data.js'

function App() {
  const [propertyData, setPropertyData] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [filter, setFilter] = useState({
    searchQuery: '',
    neighborhoods: [],
    units: null,
    daysLeft: 1,
    showActive: false,
    flagged: false,
  });
  const [selectedListing, setSelectedListing] = useState(null);
  const [decryptedListing, setDecryptedListing] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [modalIsOpen, setModalIsOpen] = useState(false);

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


  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()

  }, [])


  useEffect(() => {
    if (!session) {
      setPropertyData([])
      setInitialLoading(false)
      return
    }
  
    async function fetchAllProperties() {
      const { data, error } = await supabase
        .from('copa_listings_new')
        .select(`
          *,
          email:emails!listing_id (
            subject,
            from_address
          )
        `)
        .order('time_sent_tz', { ascending: false });
  
      if (error) {
        console.error('Error fetching properties:', error)
      } else {
        setPropertyData(data)
      }
      setInitialLoading(false)
    }
    
    fetchAllProperties()
  }, [session])

  useEffect(() => {
    async function decryptListingDetails() {
      if (!selectedListing || !session) {
        setDecryptedListing(null);
        return;
      }
  
      setDecrypting(true);
      try {
        const { data: decryptedDetails, error } = await supabase.rpc('get_listing_details', {
          listing_id_param: selectedListing.id,
          user_id_param: session.user.id
        });
  
        if (error) {
          console.error('Error decrypting details:', error);
          // Still set the listing but without decrypted details
          setDecryptedListing(selectedListing);
        } else {
          // Combine listing with decrypted details
          setDecryptedListing({
            ...selectedListing,
            details: decryptedDetails
          });
        }
      } catch (error) {
        console.error('Error:', error);
        setDecryptedListing(selectedListing);
      } finally {
        setDecrypting(false);
      }
    }
  
    decryptListingDetails();
  }, [selectedListing, session]);  

  useEffect(() => {
    const handleListingUpdate = async (event) => {
      // If you pass the listing ID in the event
      const listingId = selectedListing?.id;
      
      if (!listingId) return;
      
      // Fetch just the updated listing
      const { data, error } = await supabase
        .from('copa_listings_new')
        .select('*')
        .eq('id', listingId)
        .single();
      
      if (error) {
        console.error('Error refreshing listing:', error);
      } else {
        // Update the specific listing in propertyData
        setPropertyData(prev => 
          prev.map(listing => listing.id === listingId ? data : listing)
        );
        
        // Also update selectedListing so the modal shows fresh data
        setSelectedListing(data);
      }
    };
  
    window.addEventListener('listingUpdated', handleListingUpdate);
    
    return () => {
      window.removeEventListener('listingUpdated', handleListingUpdate);
    };
  }, [selectedListing]);


  const filteredProperties = propertyData.filter(listing => {
    // Search functionality - checks across multiple fields
    if (filter.searchQuery && filter.searchQuery.trim() !== '') {
      const query = filter.searchQuery.toLowerCase().trim();
      
      // Search in address.full_address (jsonb field)
      const addressMatch = listing.address?.full_address?.toLowerCase().includes(query);
      
      // Search across ALL emails for this listing
      const emails = Array.isArray(listing.email) ? listing.email : (listing.email ? [listing.email] : []);
      
      const subjectMatch = emails.some(email => 
        email.subject?.toLowerCase().includes(query)
      );
      
      const fromAddressMatch = emails.some(email => 
        email.from_address?.toLowerCase().includes(query)
      );
      
      // If none of the fields match, filter out this listing
      if (!addressMatch && !subjectMatch && !fromAddressMatch) return false;
    }
    
    // Existing neighborhood filter
    if (filter.neighborhoods.length > 0) {
      console.log('Checking listing:', listing.id, 'neighborhood:', listing.neighborhood, 'against selected:', filter.neighborhoods);
      if (!filter.neighborhoods.includes(listing.neighborhood)) return false;
    }
    
    // Existing units filters
    if (filter.units === 1 && (listing.total_units < 1 || listing.total_units > 10)) return false;
    if (filter.units === 2 && (listing.total_units < 11 || listing.total_units > 25)) return false;
    if (filter.units === 3 && (listing.total_units < 26 || listing.total_units > 49)) return false;
    if (filter.units === 4 && listing.total_units < 50) return false;
    
    // Existing active/days left filter
    if (filter.showActive) {
      const daysLeft = calculateDaysRemaining(listing.time_sent_tz);
      if (daysLeft < filter.daysLeft) return false;
    }

    // Existing flagged filter
    if (filter.flagged !== undefined) {
      if (filter.flagged) {
        // Show only flagged items (flagged === true)
        if (!listing.flagged) return false;
      } else {
        // Show only unflagged items (flagged === false/null/undefined)
        if (listing.flagged) return false;
      }
    }
    
    
    return true;
  });
  // Open the modal and log access to the listing, which contains decrypted data
  const openModal = async (listing) => {
    setModalIsOpen(true);
    setSelectedListing(listing);
    
    // Log access to the listing
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && listing?.id) {
        const { error } = await supabase
          .from('access_log')
          .insert({
            user_id: user.id,
            listing_id: listing.id,
            accessed_at: new Date().toISOString()
          });
        
        if (error) {
          console.error('Error logging access:', error);
          // Don't block the modal from opening if logging fails
        }
      }
    } catch (error) {
      console.error('Error logging access:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (!session) {
    return <Auth />
  }
        
  /*
  // Test the connection to the Supabase Realtime channel
  useEffect(() => {
    const testConnection = async () => {
      const { data, error } = await supabase.from('_realtime').select('*').limit(1)
      if (error) {
        console.error('Supabase connection text - error fetching data:', error.message)
      } else {
        console.log('Supabase connected successfully')
      }
    }
    testConnection()
  }, [])
  */

  if (initialLoading) return <div>Loading property data...</div>
  if (error) return <div>Error loading property data: {error}</div>

  return (

    <div className="h-screen flex flex-col overflow-hidden">
      {/* Modal - renders on top of everything when open */}
      <PropertyInfoModal 
        selectedListing={selectedListing}
        decryptedListing={decryptedListing}
        decrypting={decrypting}
        modalIsOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
      />

      <NavBar className="flex-shrink-0" handleLogout={handleLogout}/>
    
      {/* Main content area */}
      <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
          {/* Map - 9 columns = 75%  */}
          <div className="col-span-8 relative overflow-hidden">
            <MapView 
              propertyData={filteredProperties} 
              setSelectedListing={setSelectedListing} 
              filter={filter} 
              setFilter={setFilter}
              modalIsOpen={modalIsOpen}
              openModal={openModal}
            />
          </div>

        {/* Sidebar - 3 columns = 25% */}
        <div className="col-span-4 bg-white border-l flex flex-col min-h-0 overflow-hidden">
          {/* FilterView fixed at the top */}
          <div className="flex-shrink-0">
            <FilterView 
              filter={filter} 
              setFilter={setFilter} 
            />
          </div>
          {/* PropertyCardCollection scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <PropertyCardCollection 
              propertyData={filteredProperties} 
              selectedListing={selectedListing} 
              setSelectedListing={setSelectedListing} 
              modalIsOpen={modalIsOpen}
              openModal={openModal}
            />
          </div>
        </div>
        
      </div>
  </div>


  )
}

export default App
