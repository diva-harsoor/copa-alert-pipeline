import { supabase } from './supabase'

async function migrateData() {
  // Fetch your JSON data
  const response = await fetch('/property-data-v2.json')
  const data = await response.json()
  
  // Insert into Supabase
  const { data: result, error } = await supabase
    .from('copa_listings_new')
    .insert(data.listings)
  
  if (error) {
    console.error('Migration error:', error)
  } else {
    console.log('Migration successful:', result)
  }
}

migrateData()