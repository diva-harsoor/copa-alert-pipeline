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
// import './migrate-data.js'

function App() {
  const [propertyData, setPropertyData] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [filter, setFilter] = useState({
    neighborhood: 'all',
    units: null,
    daysLeft: 1,
    showActive: false,
  });
  const [selectedListing, setSelectedListing] = useState(null);

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
      
      const { data, error } = await supabase.from('copa_listings_new').select('*')

      if (error) {
        console.error('Error fetching properties:', error)
      } else {
        setPropertyData(data)
      }
      setInitialLoading(false)
    }
    fetchAllProperties()
  }, [session])

  const filteredProperties = propertyData.filter(listing => {
    if (filter.units === 1 && (listing.total_units < 1 || listing.total_units > 10)) return false
    if (filter.units === 2 && (listing.total_units < 11 || listing.total_units > 25)) return false
    if (filter.units === 3 && (listing.total_units < 26 || listing.total_units > 49)) return false
    if (filter.units === 4 && listing.total_units < 50) return false

    if (filter.showActive) {
      const daysLeft = calculateDaysRemaining(listing.time_sent_tz);
      if (daysLeft < filter.daysLeft) return false;  
    }

    return true;
  });

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
      <NavBar className="flex-shrink-0" handleLogout={handleLogout}/>
    
    {/* Main content area */}
    <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
        {/* Map - 9 columns = 75%  */}
        <div className="col-span-8 relative overflow-hidden">
          <MapView propertyData={propertyData} setSelectedListing={setSelectedListing}/>
        </div>

      {/* Sidebar - 3 columns = 25% */}
      <div className="col-span-4 bg-white border-l flex flex-col min-h-0 overflow-hidden">
        {/* FilterView fixed at the top */}
        {!selectedListing && (
          <div className="flex-shrink-0">
            <FilterView filter={filter} setFilter={setFilter} />
          </div>
        )}
        {/* PropertyCardCollection scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <PropertyCardCollection propertyData={filteredProperties} selectedListing={selectedListing} setSelectedListing={setSelectedListing} />
        </div>
      </div>
      
    </div>
  </div>


  )
}

export default App
