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
import pdfplumber
import re
from process_data import parse_copa3_form, extract_address, extract_basic_property_info, extract_seller_info, extract_financial_info

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


# Update the check_duplicate_listing function:
def check_duplicate_listing(address_obj):
    """
    Check if a listing already exists for this address.
    address_obj is a dict with full_address, street_address, secondary_address, zip_code
    """
    if not address_obj or not address_obj.get('full_address'):
        return None
    
    try:
        normalized_address = normalize_address(address_obj['full_address'])
        
        response = supabase.table('copa_listings_new')\
            .select('id, address, time_sent_tz')\
            .execute()
        
        for listing in response.data:
            # address is now JSONB, so extract full_address
            existing_full_address = listing.get('address', {}).get('full_address', '')
            existing_normalized = normalize_address(existing_full_address)
            
            if existing_normalized == normalized_address:
                print(f"    Match found: '{existing_full_address}' ≈ '{address_obj['full_address']}'")
                return listing['id']
        
        return None
        
    except Exception as e:
        print(f"    ⚠ Error checking for duplicates: {e}")
        return None


def is_copa3_form(pdf_path):
    """Check if PDF contains a COPA3 form on any page"""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if len(pdf.pages) == 0:
                return False
            
            # COPA3 markers
            markers = [
                "Certificate of Property Addresses",
                "Property Address:",
                "Total # of units",
                "# of residential units"
            ]
            
            # Check each page
            for page in pdf.pages:
                text = page.extract_text()
                
                if not text:
                    continue
                
                # Require at least 2 markers on a single page
                if sum(marker in text for marker in markers) >= 2:
                    return True
            
            return False
            
    except Exception as e:
        print(f"  ✗ Error checking if COPA3: {e}")
        return False


def parse_copa3_form_local(pdf_path):
    """Parse COPA3 form from multi-page PDF"""
    
    try:
        # Find which page has the COPA3 form
        copa3_page_num = None
        
        with pdfplumber.open(pdf_path) as pdf:
            markers = [
                "Certificate of Property Addresses",
                "Property Address:",
                "Total # of units",
                "# of residential units"
            ]
            
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and sum(marker in text for marker in markers) >= 2:
                    copa3_page_num = i
                    break
        
        if copa3_page_num is None:
            return {}
        
        # Extract text from the COPA3 page
        with pdfplumber.open(pdf_path) as pdf:
            text = pdf.pages[copa3_page_num].extract_text()
            cleaned_text = re.sub(r'[_*]+', '', text)
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text)
        
        # Use your existing extraction functions
        address = extract_address(cleaned_text)
        property_info = extract_basic_property_info(cleaned_text)
        seller_info = extract_seller_info(cleaned_text)
        financial_info = extract_financial_info(cleaned_text)
        
        if not address:
            return {}
        
        # Return in format matching database schema
        return {
            'classification': 'listing',
            'confidence': 'high',
            'address': {
                'full_address': address.get('full_address'),
                'street_address': address.get('street_address'),
                'secondary_address': address.get('secondary_address'),
                'zip_code': address.get('zip_code')
            },
            'asking_price': financial_info.get('asking_price', -1),
            'total_units': property_info.get('total_units', -1),
            'residential_units': property_info.get('residential_units', -1),
            'vacant_residential': property_info.get('vacant_residential', -1),
            'commercial_units': property_info.get('commercial_units', -1),
            'vacant_commercial': property_info.get('vacant_commercial', -1),
            'is_vacant_lot': property_info.get('is_vacant_lot', False),
            'details': {
                'sender_phone_number': None,
                'soft_story_required': property_info.get('soft_story_required'),
                'sqft': -1,
                'parking_spaces': -1,
                'financial_data': financial_info,
                'rent_roll': []
            }
        }
        
    except Exception as e:
        print(f"  ✗ Error parsing COPA3 form: {e}")
        import traceback
        traceback.print_exc()
        return {}

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

    copa3_data = {}
    # safe_attachment_texts = []

    
    for attachment in attachments:
        att_id = attachment['id']
        filename = attachment['filename']
        content_type = attachment['content_type']
        
        print(f"\nProcessing attachment: {filename}")
        
        '''
        # Check if already extracted
        if attachment.get('extracted_text'):
            print(f"  ✓ Using cached text ({len(attachment['extracted_text'])} chars)")
            attachment_texts.append(attachment['extracted_text'])
            continue
        '''
        
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
        
        '''
        # Extract text
        print(f"  Extracting text...")
        extracted_text = extract_text_from_file(temp_path, content_type)
        print(f"  Extracted {len(extracted_text)} characters")
        '''

        # Check if it's a COPA3 form
        if is_copa3_form(temp_path):
            print(f"  ✓ Detected COPA3 form")
            copa3_result = parse_copa3_form_local(temp_path)
            if copa3_result:
                print(f"  ✓ Successfully parsed COPA3 form")
                copa3_data = copa3_result
            else:
                print(f"  ⚠ COPA3 detection succeeded but parsing failed")
        else:
            print(f"  ⊘ Not a COPA3 form")
        
        # Clean up temp file
        try:
            os.remove(temp_path)
            print(f"  Cleaned up temp file")
        except Exception as e:
            print(f"  ⚠ Failed to clean up temp file: {e}")
        
    print(f"COPA3 data found: {bool(copa3_data)}")
    if not copa3_data:
        supabase.table('emails')\
            .update({'processed': True, 'processed_at': datetime.now().isoformat()})\
            .eq('id', email_id)\
            .execute()
        return True

    # Geocode address and find neighborhood (non-blocking)
    location = None
    neighborhood = None

    # address_obj = parsed_data.get('address')
    address_obj = copa3_data.get('address')

    if address_obj:
        print(f"\nGeocoding address: {address_obj}")
        try:
            location = get_location_from_address(address_obj)
            
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
    
    details = copa3_data.get('details', {})
    details['sender_email'] = email.get('from_address')

    # Add metadata from email
    listing_data = {
        'time_sent_tz': email['received_date'],
        'address': copa3_data.get('address'),
        'neighborhood': neighborhood,
        'asking_price': copa3_data.get('asking_price') if copa3_data.get('asking_price') != -1 else None,
        'total_units': copa3_data.get('total_units') if copa3_data.get('total_units') != -1 else None,
        'residential_units': copa3_data.get('residential_units') if copa3_data.get('residential_units') != -1 else None,
        'vacant_residential': copa3_data.get('vacant_residential') if copa3_data.get('vacant_residential') != -1 else None,
        'commercial_units': copa3_data.get('commercial_units') if copa3_data.get('commercial_units') != -1 else None,
        'vacant_commercial': copa3_data.get('vacant_commercial') if copa3_data.get('vacant_commercial') != -1 else None,
        'is_vacant_lot': copa3_data.get('is_vacant_lot', False),
        'details': details
    }

    if listing_data.get('neighborhood') is None:
        listing_data['flagged'] = True
    
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
    existing_listing_id = check_duplicate_listing(listing_data['address'])
    
    if existing_listing_id:
        print(f"⚠ Duplicate listing found!")
        print(f"  Address: {listing_data.get('address', {}).get('full_address')}")
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