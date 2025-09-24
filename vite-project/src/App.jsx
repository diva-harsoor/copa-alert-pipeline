import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { supabase } from './supabase'
import Auth from './components/Auth'
import PropertyCardCollection from './components/PropertyCardCollection'
import FilterView from './components/FilterView'
import MapView from './components/MapView'
//import './migrate-data.js'

function App() {
  const [propertyData, setPropertyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);

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
    if (session) {
      fetchData()
    } else {
      setPropertyData([])
      setLoading(false)
    }
  }, [session])

  const fetchData = async () => {
    setLoading(true)
    console.log('Fetching data from Supabase...')
    
    const { data, error } = await supabase
      .from('copa_listings')
      .select('*')
    
    console.log('Supabase response:', { data, error })
    
    if (error) {
      console.error('Supabase error:', error)
      setError(error.message)
    } else {
      console.log('Data received:', data?.length, 'properties')
      setPropertyData(data || [])
    }
    setLoading(false)
  }

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

  if (loading) return <div>Loading property data...</div>
  if (error) return <div>Error loading property data: {error}</div>

  return (

    <div className="h-screen flex flex-col">
    {/* Nav bar <NavBar className="flex-shrink-0" /> */}
    
    <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
    {/* Main content area */}
    <div className="flex-1 grid grid-cols-12 min-h-0">
        {/* Map - 9 columns = 75%  */}
        <div className="col-span-8 relative">
          <MapView />
        </div>

      {/* Sidebar - 3 columns = 25% */}
      <div className="col-span-4 bg-white border-r overflow-y-auto">
        {/* Sidebar content */}
        <FilterView />
        <PropertyCardCollection propertyData={propertyData} />
      </div>
      
    </div>
  </div>


  )
}

export default App
