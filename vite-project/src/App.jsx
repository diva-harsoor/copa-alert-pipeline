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
import {APIProvider, Map, Marker, InfoWindow, useMap} from '@vis.gl/react-google-maps';
//import './migrate-data.js'

function App() {
  const [propertyData, setPropertyData] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [filter, setFilter] = useState({
    neighborhood: 'all',
    units: null,
    daysLeft: 3,
  });

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

    console.log('Filter:', filter)
    async function fetchFilteredProperties() {
      // setLoading(true)

      let query = supabase.from('copa_listings').select('*')

      if (filter.units) {
        if (filter.units === 1) {
          query = query
            .gte('basic_property_info->total_units', 1)
            .lte('basic_property_info->total_units', 10)
        }
        if (filter.units === 2) {
          query = query
            .gte('basic_property_info->total_units', 11)
            .lte('basic_property_info->total_ units', 25)
        }
        if (filter.units === 3) {
          query = query
            .gte('basic_property_info->total_units', 26)
            .lte('basic_property_info->total_units', 49)
        }
        if (filter.units === 4) {
          query = query.gte('basic_property_info->total_units', 50)
        }
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching filtered properties:', error)
      } else {
        setPropertyData(data)
      }

      setInitialLoading(false)
    }
    
    fetchFilteredProperties()
  }, [filter, session])

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
      <NavBar className="flex-shrink-0" logout={handleLogout}/>
    
    {/* Main content area */}
    <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
        {/* Map - 9 columns = 75%  */}
        <div className="col-span-8 relative overflow-hidden">
          <APIProvider apiKey={googleMapsApiKey}>
            <Map
              center={{ lat: 37.75, lng: -122.44 }}
              zoom={12.5}
            >
              {propertyData.map(listing => 
                <Marker position={{ lat: listing.location.lat, lng: listing.location.lng }}/> 
              )}
            </Map>
          </APIProvider>
          { /* <MapView /> */}
        </div>

      {/* Sidebar - 3 columns = 25% */}
      <div className="col-span-4 bg-white border-l flex flex-col min-h-0 overflow-hidden">
        {/* FilterView fixed at the top */}
        <div className="flex-shrink-0">
          <FilterView filter={filter} setFilter={setFilter} />
        </div>
        {/* PropertyCardCollection scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <PropertyCardCollection propertyData={propertyData} />
        </div>
      </div>
      
    </div>
  </div>


  )
}

export default App
