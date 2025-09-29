import { supabase } from './supabase'

const migrateData = async () => {
  try {
    const response = await fetch('/property-data.json');
    const data = await response.json();
    
    for (const listing of data.listings) {
      const insertData = {
        time_sent_tz: listing.time_sent_tz,
        full_address: listing.full_address,
        total_units: listing.total_units,
        residential_units: listing.residential_units,
        vacant_residential: listing.vacant_residential,
        commercial_units: listing.commercial_units,
        vacant_commercial: listing.vacant_commercial,
        is_vacant_lot: listing.is_vacant_lot,
        neighborhood: listing.neighborhood,
        asking_price: listing.asking_price,
        details: listing.details,
        
        // Convert lat/lng to PostGIS format
        location: `POINT(${listing.location.lng} ${listing.location.lat})`,
      };
      
      const { data: insertResult, error } = await supabase
        .from('copa_listings_new')
        .insert(insertData);
        
      if (error) {
        console.error('Insert error:', error);
      } else {
        console.log('Successfully inserted listing');
      }
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
};

migrateData()