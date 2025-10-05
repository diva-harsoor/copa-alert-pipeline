import json
from supabase import create_client
from datetime import datetime
import config
from extract_text import extract_text_from_file
from parse_with_ai import parse_email_with_ai
import tempfile
import os
import requests
from typing import Dict, Optional
from sodapy import Socrata
from shapely.geometry import shape, Point

# Initialize Supabase client
supabase = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

# Cache neighborhoods data globally to avoid reloading
_NEIGHBORHOODS_CACHE = None

def load_sf_neighborhoods():
    """Load and return processed neighborhood data."""
    global _NEIGHBORHOODS_CACHE
    
    # Return cached data if available
    if _NEIGHBORHOODS_CACHE is not None:
        return _NEIGHBORHOODS_CACHE
    
    print("Loading SF neighborhoods data...")
    try:
        client = Socrata("data.sfgov.org", None)
        neighborhoods = client.get("gfpk-269f", limit=2000)
        
        processed = []
        for n in neighborhoods:
            try:
                # Convert GeoJSON dict to shapely geometry
                geometry = shape(n['the_geom'])
                processed.append({
                    'name': n['name'],
                    'geometry': geometry
                })
            except Exception as e:
                print(f"  ⚠ Error processing {n.get('name', 'Unknown')}: {e}")
                continue
        
        _NEIGHBORHOODS_CACHE = processed
        print(f"✓ Loaded {len(processed)} neighborhoods")
        return processed
    except Exception as e:
        print(f"✗ Error loading neighborhoods: {e}")
        return []

def get_neighborhood_from_location(lat, lng, neighborhoods):
    """Get neighborhood from location"""
    try:
        point = Point(lng, lat)
        for neighborhood in neighborhoods:
            if neighborhood['geometry'].contains(point):
                return neighborhood['name']
        return None
    except Exception as e:
        print(f"  ⚠ Error finding neighborhood: {e}")
        return None

def get_location_from_address(address: Dict[str, str]) -> Optional[Dict[str, float]]:
    """
    Convert a San Francisco address object to latitude and longitude coordinates.
    For corner buildings, tries both street addresses to get the best result.
    
    Args:
        address (Dict): Address object containing:
            - street_address: Primary street address
            - secondary_address: Alternate street address (for corner buildings)
            - zip_code: ZIP code
            - property_type: Type of property (not used in geocoding)
    
    Returns:
        Dict with 'lat' and 'lng' keys, or None if geocoding fails
    """
    
    def _geocode_address_string(addr_string: str) -> Optional[Dict[str, float]]:
        """Helper function to geocode a single address string."""
        try:
            url = 'https://nominatim.openstreetmap.org/search'
            params = {
                'q': addr_string,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'us'
            }
            
            headers = {
                'User-Agent': 'SF-Address-Geocoder/1.0'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data and len(data) > 0:
                result = data[0]
                result = {
                    'lat': float(result['lat']),
                    'lng': float(result['lon'])
                }
                return result
            return None
            
        except (requests.RequestException, KeyError, ValueError, IndexError):
            return None
    
    # Build address strings to try
    addresses_to_try = []
    
    # Try primary street address first
    if address.get('street_address'):
        addr_parts = [address['street_address'], 'San Francisco', 'CA']
        if address.get('zip_code'):
            addr_parts.append(address['zip_code'])
        addresses_to_try.append(', '.join(addr_parts))
    
    # Try secondary address (alternate street for corner buildings)
    if address.get('secondary_address'):
        addr_parts = [address['secondary_address'], 'San Francisco', 'CA']
        if address.get('zip_code'):
            addr_parts.append(address['zip_code'])
        addresses_to_try.append(', '.join(addr_parts))
    
    # Try geocoding each address until we get a result
    for addr_string in addresses_to_try:
        result = _geocode_address_string(addr_string)
        if result:
            print(f"Geocoding result for {addr_string}: {result}")
            return result
    
    print(f"No results found for any address variants")
    return {}

def normalize_address(address):
    """
    Normalize address string for better matching.
    Handles common variations like 'St' vs 'Street', etc.
    """
    if not address:
        return ""
    
    # Convert to lowercase and strip
    normalized = address.lower().strip()
    
    # Remove extra whitespace
    normalized = ' '.join(normalized.split())
    
    # Common abbreviation replacements for better matching
    replacements = {
        ' street': ' st',
        ' avenue': ' ave',
        ' road': ' rd',
        ' boulevard': ' blvd',
        ' drive': ' dr',
        ' lane': ' ln',
        ' court': ' ct',
        ' place': ' pl',
        'saint ': 'st ',
        'san francisco': 'sf',
    }
    
    for full, abbrev in replacements.items():
        normalized = normalized.replace(full, abbrev)
    
    # Remove common suffixes
    normalized = normalized.replace(', sf', '').replace(', ca', '')
    
    return normalized


def check_duplicate_listing(full_address):
    """
    Check if a listing already exists for this address.
    Returns existing listing_id if duplicate found, None otherwise.
    """
    if not full_address:
        return None
    
    try:
        # Normalize address for comparison
        normalized_address = normalize_address(full_address)
        
        # Get all listings and check with normalized comparison
        # This is more reliable than SQL ILIKE for address matching
        response = supabase.table('copa_listings_new')\
            .select('id, full_address, time_sent_tz')\
            .execute()
        
        for listing in response.data:
            existing_normalized = normalize_address(listing.get('full_address', ''))
            
            if existing_normalized == normalized_address:
                print(f"    Match found: '{listing['full_address']}' ≈ '{full_address}'")
                return listing['id']
        
        return None
        
    except Exception as e:
        print(f"    ⚠ Error checking for duplicates: {e}")
        return None

# Not using this until we have a AI service secure enough for taking tenant info
def download_attachment(storage_path):
    """
    Download attachment from Supabase storage to temp file.
    Returns path to temp file.
    """
    try:
        # Path is email-attachments/{email_id}/{file}
        
        # Extract filename
        filename = os.path.basename(storage_path)
        
        print(f"    Downloading {filename}...")
        print(f"    Storage path: {storage_path}")
        
        # Download from storage using full path as stored in database
        response = supabase.storage.from_('email-attachments').download(storage_path)
        
        print(f"    Downloaded {len(response)} bytes")
        
        # Create temp file
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, filename)
        
        # Write to temp file
        with open(temp_path, 'wb') as f:
            f.write(response)
        
        print(f"    ✓ Saved to {temp_path}")
        return temp_path
        
    except Exception as e:
        print(f"    ✗ Error downloading: {e}")
        import traceback
        traceback.print_exc()
        return None


def process_email(email, neighborhoods):
    """
    Process a single email: extract text from attachments, parse with AI,
    geocode location, find neighborhood, insert into copa_listings_new.
    """
    email_id = email['id']

    # Check if already processed with a listing
    if email.get('listing_id'):
        print(f"\n⊘ Email already has listing: {email['listing_id']}")
        print(f"  Subject: {email.get('subject')}")
        return True

    print(f"\n{'='*60}")
    print(f"Processing email ID: {email_id}")
    print(f"Subject: {email.get('subject', 'No subject')}")
    print(f"From: {email.get('from_address')}")
    print(f"Date: {email.get('received_date')}")
    print(f"{'='*60}")
    
    # Get email body text
    email_subject = email.get('subject', '')
    email_text = email.get('raw_text', '') or email.get('raw_html', '')
    print(f"Email body length: {len(email_text)} characters")
    
    # Commented out until we have a AI service secure enough to take tenant info

    '''
    # Get attachments
    print(f"\nQuerying attachments for email_id={email_id}...")
    attachments_response = supabase.table('email_attachments')\
        .select('*')\
        .eq('email_id', email_id)\
        .execute()
    
    attachments = attachments_response.data
    print(f"Found {len(attachments)} attachments")
    
    if len(attachments) > 0:
        print("Attachment details:")
        for att in attachments:
            print(f"  - {att['filename']} ({att['content_type']}, inline={att.get('is_inline')})")
    '''

    attachment_texts = []

    # Commented out until we have a AI service secure enough to take tenant info
    '''
    for attachment in attachments:
        att_id = attachment['id']
        filename = attachment['filename']
        content_type = attachment['content_type']
        
        print(f"\nProcessing attachment: {filename}")
        
        # Check if already extracted
        if attachment.get('extracted_text'):
            print(f"  ✓ Using cached text ({len(attachment['extracted_text'])} chars)")
            attachment_texts.append(attachment['extracted_text'])
            continue
        
        # Skip inline attachments (usually images in email body)
        if attachment.get('is_inline'):
            print(f"  ⊘ Skipping inline attachment")
            continue
        
        # Download and extract text
        storage_path = attachment.get('storage_path')
        if not storage_path:
            print(f"  ⚠ No storage path found")
            continue
        
        # Download attachment
        temp_path = download_attachment(storage_path)
        if not temp_path:
            print(f"  ✗ Download failed, skipping")
            continue
        
        # Extract text
        print(f"  Extracting text...")
        extracted_text = extract_text_from_file(temp_path, content_type)
        print(f"  Extracted {len(extracted_text)} characters")
        
        # Clean up temp file
        try:
            os.remove(temp_path)
            print(f"  Cleaned up temp file")
        except Exception as e:
            print(f"  ⚠ Failed to clean up temp file: {e}")
        
        # Save extracted text to database
        if extracted_text:
            print(f"  Saving extracted text to database...")
            try:
                supabase.table('email_attachments')\
                    .update({'extracted_text': extracted_text})\
                    .eq('id', att_id)\
                    .execute()
                print(f"  ✓ Saved to database")
                attachment_texts.append(extracted_text)
            except Exception as e:
                print(f"  ✗ Failed to save: {e}")
                import traceback
                traceback.print_exc()
    
    print(f"\nTotal attachment texts collected: {len(attachment_texts)}")
    '''

    # Parse with AI
    print(f"\nParsing with AI...")

    parsed_data = parse_email_with_ai(email_subject, email_text, attachment_texts)
    
    if not parsed_data:
        print("  ✗ AI parsing failed")
        return False
    
    print(f"\nParsed data summary:")
    print(f"  Classification: {parsed_data.get('classification')}")
    print(f"  Confidence: {parsed_data.get('confidence')}")
    print(f"  Address: {parsed_data.get('full_address')}")
    print(f"  Price: {parsed_data.get('asking_price')}")
    print(f"  Units: {parsed_data.get('total_units')}")
    
    # Check classification
    if parsed_data['classification'] != 'listing':
        print(f"\n⊘ Skipping: classified as '{parsed_data['classification']}'")
        
        # Mark as processed but don't create listing
        print(f"Marking email as processed (no listing)...")
        try:
            supabase.table('emails')\
                .update({'processed': True, 'processed_at': datetime.now().isoformat()})\
                .eq('id', email_id)\
                .execute()
            print(f"✓ Email marked as processed")
        except Exception as e:
            print(f"✗ Failed to update email: {e}")
            import traceback
            traceback.print_exc()
        
        return True
    
    # Geocode address and find neighborhood (non-blocking)
    location = None
    neighborhood = None
    
    address_breakdown = parsed_data.get('details', {}).get('address_breakdown')
    if address_breakdown:
        print(f"\nGeocoding address: {address_breakdown}")
        try:
            location = get_location_from_address(address_breakdown)
            
            if location and neighborhoods:
                print(f"Finding neighborhood...")
                neighborhood = get_neighborhood_from_location(
                    location['lat'], 
                    location['lng'], 
                    neighborhoods
                )
                if neighborhood:
                    print(f"  ✓ Neighborhood: {neighborhood}")
                else:
                    print(f"  ⚠ Neighborhood not found")
        except Exception as e:
            print(f"  ⚠ Location/neighborhood lookup failed (non-blocking): {e}")
            # Continue processing - don't let this block the listing creation
    
    # Add metadata from email
    listing_data = {
        'time_sent_tz': email['received_date'],
        'full_address': parsed_data.get('full_address'),
        'neighborhood': neighborhood,
        'asking_price': parsed_data.get('asking_price') if parsed_data.get('asking_price') != -1 else None,
        'total_units': parsed_data.get('total_units') if parsed_data.get('total_units') != -1 else None,
        'residential_units': parsed_data.get('residential_units') if parsed_data.get('residential_units') != -1 else None,
        'vacant_residential': parsed_data.get('vacant_residential') if parsed_data.get('vacant_residential') != -1 else None,
        'commercial_units': parsed_data.get('commercial_units') if parsed_data.get('commercial_units') != -1 else None,
        'vacant_commercial': parsed_data.get('vacant_commercial') if parsed_data.get('vacant_commercial') != -1 else None,
        'is_vacant_lot': parsed_data.get('is_vacant_lot', False),
        'details': parsed_data.get('details', {})
    }

    parsed_data['details']['sender_email'] = email.get('from_address')

    if parsed_data.get('confidence') == 'low' or parsed_data.get('classification') == 'other' or listing_data.get('neighborhood') is None:
        listing_data['flagged'] = True
    else:
        listing_data['flagged'] = False
    
    # Add location to details if available
    if location:
        listing_data['location'] = {
            'type': 'Point',
            'coordinates': [location['lng'], location['lat']]
        }
    
    # Add sender email to details.source
    if 'source' not in listing_data['details']:
        listing_data['details']['source'] = {}
    listing_data['details']['source']['email_address'] = email.get('from_address')
    
    print(f"\nListing data prepared:")
    print(json.dumps(listing_data, indent=2, default=str))
    
    # Check for duplicate listing before inserting into copa_listings_new
    print(f"\nChecking for duplicate listings...")
    existing_listing_id = check_duplicate_listing(listing_data['full_address'])
    
    if existing_listing_id:
        print(f"⚠ Duplicate listing found!")
        print(f"  Address: {listing_data['full_address']}")
        print(f"  Existing listing ID: {existing_listing_id}")
        print(f"  → Linking email to existing listing (not creating new)")
        
        # Link email to existing listing
        try:
            supabase.table('emails')\
                .update({
                    'processed': True,
                    'processed_at': datetime.now().isoformat(),
                    'listing_id': existing_listing_id
                })\
                .eq('id', email_id)\
                .execute()
            
            print(f"✓ Email linked to existing listing")
            return True
            
        except Exception as e:
            print(f"✗ Error linking to existing listing: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    print(f"✓ No duplicate found, creating new listing...")

    # Insert into copa_listings_new
    print(f"\nInserting into copa_listings_new...")
    try:
        # Separate details from other fields
        details = listing_data.pop('details')
        
        # Call the database function to insert with encryption
        result = supabase.rpc(
            'insert_listing_with_encryption',
            {
                'listing_data': listing_data,
                'details_to_encrypt': details
            }
        ).execute()

        '''
        listing_response = supabase.table('copa_listings_new')\
            .insert(listing_data)\
            .execute()
        
        print(f"Insert response: {listing_response}")
        
        listing_id = listing_response.data[0]['id']
        '''

        listing_id = result.data
        print(f"✓ Created listing: {listing_id}")
        
        # Mark email as processed and link to listing
        print(f"Updating email record...")
        supabase.table('emails')\
            .update({
                'processed': True,
                'processed_at': datetime.now().isoformat(),
                'listing_id': listing_id
            })\
            .eq('id', email_id)\
            .execute()
        
        print(f"✓ Email marked as processed and linked to listing")
        return True
        
    except Exception as e:
        print(f"✗ Error inserting listing: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """
    Main function: process unprocessed emails.
    """
    print("="*60)
    print("EMAIL PARSER - Processing Pipeline")
    print("="*60)

    # Load neighborhoods data once at startup
    neighborhoods = load_sf_neighborhoods()
    if not neighborhoods:
        print("⚠ Warning: Could not load neighborhoods data. Continuing without neighborhood lookup.")
    
    # Option to process specific email
    specific_id = input("Process specific email ID? (leave blank to process batch): ").strip()
    
    if specific_id:
        # Process single email by ID
        print(f"\nFetching email {specific_id}...")
        try:
            email_response = supabase.table('emails')\
                .select('*')\
                .eq('id', specific_id)\
                .execute()
            
            if not email_response.data:
                print(f"Email not found: {specific_id}")
                return
            
            emails = email_response.data
        except Exception as e:
            print(f"✗ Error fetching email: {e}")
            return
    else:
        # Get number of emails to process
        limit = input("How many emails to process? (default: 5): ").strip()
        limit = int(limit) if limit else 5
        
        # Query unprocessed emails
        print(f"\nQuerying {limit} unprocessed emails...")
        
        try:
            emails_response = supabase.table('emails')\
                .select('*')\
                .eq('processed', False)\
                .order('received_date', desc=True)\
                .limit(limit)\
                .execute()
            
            emails = emails_response.data
            print(f"Query returned {len(emails)} emails")
            
        except Exception as e:
            print(f"✗ Error querying emails: {e}")
            import traceback
            traceback.print_exc()
            return
    
    if not emails:
        print("No emails to process!")
        return
    
    # Show which emails we'll process
    print(f"\nEmails to process:")
    for i, email in enumerate(emails, 1):
        print(f"  {i}. {email.get('subject', 'No subject')} (from {email.get('from_address')})")
    
    # Process each email
    success_count = 0
    skip_count = 0
    fail_count = 0
    
    for i, email in enumerate(emails, 1):
        print(f"\n{'#'*60}")
        print(f"EMAIL {i}/{len(emails)}")
        print(f"{'#'*60}")
        
        try:
            result = process_email(email, neighborhoods)
            
            if result:
                # Check if listing was created
                email_check = supabase.table('emails').select('listing_id').eq('id', email['id']).execute()
                if email_check.data and email_check.data[0].get('listing_id'):
                    success_count += 1
                    print(f"\n✓ Email {i} completed successfully - listing created")
                else:
                    skip_count += 1
                    print(f"\n⊘ Email {i} completed - no listing (non-listing classification)")
            else:
                fail_count += 1
                print(f"\n✗ Email {i} failed")
        except Exception as e:
            fail_count += 1
            print(f"\n✗ Email {i} failed with exception: {e}")
            import traceback
            traceback.print_exc()
    
    # Summary
    print("\n" + "="*60)
    print("PROCESSING COMPLETE")
    print("="*60)
    print(f"Total processed: {len(emails)}")
    print(f"  ✓ Listings created: {success_count}")
    print(f"  ⊘ Skipped (non-listings): {skip_count}")
    print(f"  ✗ Failed: {fail_count}")
    print("="*60)

if __name__ == "__main__":
    main()