import { supabase } from './supabase'

async function migrateData() {
  // Fetch your JSON data
  const response = await fetch('/qnps.json')
  const data = await response.json()
  
  // Insert into Supabase
  const { data: result, error } = await supabase
    .from('qnps')
    .insert(data.qnps)
  
  if (error) {
    console.error('Migration error:', error)
  } else {
    console.log('Migration successful:', result)
  }
}

migrateData()