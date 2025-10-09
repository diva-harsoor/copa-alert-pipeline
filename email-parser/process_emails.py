import json
import sys
from supabase import create_client
from dotenv import load_dotenv
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

load_dotenv()

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

def should_skip_email(subject):
    """
    Check if email should be skipped based on subject line.
    Returns True if email should be skipped, False otherwise.
    """
    if not subject:
        return False
    
    # Convert to string and check for exclusion patterns
    subject_str = str(subject)
    
    # Check for exact matches (case-insensitive)
    skip_keywords = ["Moderator", "Delivery Status", "Log In"]
    for keyword in skip_keywords:
        if keyword.lower() in subject_str.lower():
            return True
    
    # Check for "Re:" prefix (case variations)
    if subject_str.strip().lower().startswith("re:"):
        return True
    
    return False

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


def find_copa3_form(pdf_path):
    """Check if PDF contains a COPA3 form on any page"""
    try:
        markers = [
            "[COPA3]",
            "Property Address:",
            "Total # of units",
            "# of residential units"
        ]
        
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and sum(marker in text for marker in markers) >= 2:
                    return i
        return None
    except Exception as e:
        print(f"  ✗ Error finding COPA3 page: {e}")
        return None

def find_copa4_form(pdf_path):
    """Check if PDF contains a COPA3 form on any page"""
    try:
        markers = [
            "[COPA4]",
            "Property Address",
            "INTENT TO SELL",
            "SAN FRANCISCO ASSOCIATION"
        ]
        
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and sum(marker in text for marker in markers) >= 2:
                    return i
        return None
    except Exception as e:
        print(f"  ✗ Error finding COPA4 page: {e}")
        return None
            
def parse_copa3_form_local(pdf_path):
    """Parse COPA3 form from multi-page PDF"""
    try:
        copa3_page_num = find_copa3_form(pdf_path)
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
        
        # Helper function to safely get numeric values
        def safe_numeric(value, default=None):
            """Return value if it's not -1, otherwise return default (None)"""
            if value is None or value == -1:
                return default
            return value
        
        # Helper function to safely get boolean values
        def safe_bool(value, default=None):
            """Return value if it's a boolean, otherwise return default (None)"""
            if isinstance(value, bool):
                return value
            return default
        
        # Return in format matching database schema with flattened details
        return {
            'classification': 'listing',
            'confidence': 'high',
            'address': {
                'full_address': address.get('full_address'),
                'street_address': address.get('street_address'),
                'secondary_address': address.get('secondary_address'),
                'zip_code': address.get('zip_code')
            },
            'asking_price': safe_numeric(financial_info.get('asking_price')),
            'total_units': safe_numeric(property_info.get('total_units')),
            'residential_units': safe_numeric(property_info.get('residential_units')),
            'vacant_residential': safe_numeric(property_info.get('vacant_residential')),
            'commercial_units': safe_numeric(property_info.get('commercial_units')),
            'vacant_commercial': safe_numeric(property_info.get('vacant_commercial')),
            'is_vacant_lot': safe_bool(property_info.get('is_vacant_lot'), False),
            'unit_mix': property_info.get('unit_mix'),
            'details': {
                # Property details
                'soft_story_required': safe_bool(property_info.get('soft_story_required')),
                'sqft': safe_numeric(property_info.get('sqft')),
                'parking_spaces': safe_numeric(property_info.get('parking_spaces')),
                
                # Financial details - income
                'total_annual_income': safe_numeric(financial_info.get('total_annual_income')),
                'total_rents': safe_numeric(financial_info.get('total_rents')),
                'other_income': safe_numeric(financial_info.get('other_income')),
                'total_monthly_income': safe_numeric(financial_info.get('total_monthly_income')),
                'average_rent': safe_numeric(financial_info.get('average_rent')),
                
                # Financial details - expenses
                'annual_expenses': safe_numeric(financial_info.get('annual_expenses')),
                'management_amount': safe_numeric(financial_info.get('management_amount')),
                'insurance': safe_numeric(financial_info.get('insurance')),
                'utilities': safe_numeric(financial_info.get('utilities')),
                'maintenance': safe_numeric(financial_info.get('maintenance')),
                'other_expenses': safe_numeric(financial_info.get('other_expenses')),
                
                # Financial metrics
                'cap_rate': safe_numeric(financial_info.get('cap_rate')),
                'grm': safe_numeric(financial_info.get('grm')),
                
                # Rent roll (keep as array)
                'rent_roll': financial_info.get('rent_roll', []),
                
                # Seller info
                'seller_name': seller_info.get('seller_name'),
                'seller_phone': seller_info.get('seller_phone'),
                'seller_email': seller_info.get('seller_email'),
                
                # Source will be added later in process_email
                'sender_phone_number': None,
            }
        }
        
    except Exception as e:
        print(f"  ✗ Error parsing COPA3 form: {e}")
        import traceback
        traceback.print_exc()
        return {}

def parse_copa4_form_local(pdf_path):
    """Parse COPA4 form from multi-page PDF"""
    try:
        copa4_page_num = find_copa4_form(pdf_path)
        if copa4_page_num is None:
            return {}
        
        # Extract text from the COPA4 page
        with pdfplumber.open(pdf_path) as pdf:
            text = pdf.pages[copa4_page_num].extract_text()
            cleaned_text = re.sub(r'[_*]+', '', text)
            cleaned_text = re.sub(r'\s+', ' ', cleaned_text)
        
        # Use your existing extraction functions
        address = extract_address(cleaned_text)
        if not address:
            return {}
        
        # Return in format matching database schema with minimal details
        return {
            'classification': 'listing',
            'confidence': 'high',
            'address': {
                'full_address': address.get('full_address'),
                'street_address': address.get('street_address'),
                'secondary_address': address.get('secondary_address'),
                'zip_code': address.get('zip_code')
            },
            'asking_price': None,
            'total_units': None,
            'residential_units': None,
            'vacant_residential': None,
            'commercial_units': None,
            'vacant_commercial': None,
            'is_vacant_lot': False,
            'unit_mix': None,
            'details': {
                # All fields default to None for COPA4
                'soft_story_required': None,
                'sqft': None,
                'parking_spaces': None,
                'total_annual_income': None,
                'total_rents': None,
                'other_income': None,
                'total_monthly_income': None,
                'average_rent': None,
                'annual_expenses': None,
                'management_amount': None,
                'insurance': None,
                'utilities': None,
                'maintenance': None,
                'other_expenses': None,
                'cap_rate': None,
                'grm': None,
                'rent_roll': [],
                'seller_name': None,
                'seller_phone': None,
                'seller_email': None,
                'sender_phone_number': None,
            }
        }
        
    except Exception as e:
        print(f"  ✗ Error parsing COPA4 form: {e}")
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
    email_subject = email.get('subject', 'No subject')


    # Check if email should be skipped based on subject
    if should_skip_email(email_subject):
        print(f"\n⊘ Skipping email - excluded subject pattern")
        print(f"  Subject: {email_subject}")
        
        # Mark as processed so it doesn't get picked up again
        supabase.table('emails')\
            .update({'processed': True, 'processed_at': datetime.now().isoformat()})\
            .eq('id', email_id)\
            .execute()
        
        return True

    # Check if already processed with a listing
    if email.get('listing_id'):
        print(f"\n⊘ Email already has listing: {email['listing_id']}")
        print(f"  Subject: {email.get('subject')}")
        return True

    print(f"\n{'='*60}")
    print(f"Processing email ID: {email_id}")
    print(f"Subject: {email_subject}")
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

    copa_form_data = {}
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
        copa_form_result = parse_copa3_form_local(temp_path)
        if copa_form_result:
            print(f"  ✓ Successfully parsed COPA3 form")
            copa_form_data = copa_form_result
        else:
            print(f"  COPA3 not detected or failed to parse, trying COPA4")
            copa_form_result = parse_copa4_form_local(temp_path)
            if copa_form_result:
                print(f"  ✓ Successfully parsed COPA4 form")
                copa_form_data = copa_form_result
                break
            else:
                print(f"  COPA4 not detected or failed to parse")

        # Clean up temp file
        try:
            os.remove(temp_path)
            print(f"  Cleaned up temp file")
        except Exception as e:
            print(f"  ⚠ Failed to clean up temp file: {e}")
        
    print(f"COPA form data found: {bool(copa_form_data)}")
    
    if not copa_form_data:
    # Mark email as processed
        supabase.table('emails')\
            .update({'processed': True, 'processed_at': datetime.now().isoformat()})\
            .eq('id', email_id)\
            .execute()
    
        try:
            listing_data = {
                'flagged': True,
                'time_sent_tz': email['received_date'],
                'address': {
                    'full_address': email.get('subject'),
                },
                'details': {
                    'source': {
                        'email_address': email.get('from_address')
                    }
                }
            }
            
            # Separate details for encryption
            details = listing_data.pop('details')
            
            # Insert the flagged listing
            listing_id = supabase.rpc(
                'insert_listing_with_encryption',
                {
                    'listing_data': listing_data,
                    'details_to_encrypt': details
                }
            ).execute().data
            
            # Link email to the new flagged listing
            supabase.table('emails')\
                .update({'listing_id': listing_id})\
                .eq('id', email_id)\
                .execute()
                
            print(f"✓ Created flagged listing: {listing_id}")
            
        except Exception as e:
            print(f"✗ Error creating flagged listing: {e}")
            import traceback
            traceback.print_exc()
        
        return True

    # Geocode address and find neighborhood (non-blocking)
    location = None
    neighborhood = None

    # address_obj = parsed_data.get('address')
    address_obj = copa_form_data.get('address')

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
    
    details = copa_form_data.get('details', {})
    # Add sender email to details
    details['sender_email'] = email.get('from_address')

    # Helper function to convert -1 to None
    def safe_value(value):
        """Return None if value is -1, otherwise return value"""
        return None if value == -1 else value

    # Add metadata from email
    listing_data = {
        'time_sent_tz': email['received_date'],
        'address': copa_form_data.get('address'),
        'neighborhood': neighborhood,
        'asking_price': safe_value(copa_form_data.get('asking_price')),
        'total_units': safe_value(copa_form_data.get('total_units')),
        'residential_units': safe_value(copa_form_data.get('residential_units')),
        'vacant_residential': safe_value(copa_form_data.get('vacant_residential')),
        'commercial_units': safe_value(copa_form_data.get('commercial_units')),
        'vacant_commercial': safe_value(copa_form_data.get('vacant_commercial')),
        'is_vacant_lot': copa_form_data.get('is_vacant_lot', False),
        'unit_mix': copa_form_data.get('unit_mix'),
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
    Main function: process unprocessed emails from the last 5 minutes,
    or optionally process historical emails via command line arguments.
    """
    print("="*60)
    print("EMAIL PARSER - Processing Pipeline")
    print(f"Started at: {datetime.now()}")
    print("="*60)

    # Load neighborhoods data once at startup
    neighborhoods = load_sf_neighborhoods()
    if not neighborhoods:
        print("⚠ Warning: Could not load neighborhoods data. Continuing without neighborhood lookup.")
            
    if len(sys.argv) > 1:
        # Historical processing
        try:
            limit = int(sys.argv[1])
            print(f"\n[HISTORICAL MODE] Processing {limit} oldest unprocessed emails...")

            emails_response = supabase.table('emails')\
                .select('*')\
                .eq('processed', False)\
                .order('received_date', desc=False)\
                .limit(limit)\
                .execute()
        except ValueError:
            print(f"✗ Invalid limit: {sys.argv[1]}")
            return
    else:
        # Default cron job mode - process up to 25 unprocessed emails
        print(f"\n[CRON MODE] Processing up to 25 unprocessed emails...")
    
        emails_response = supabase.table('emails')\
            .select('*')\
            .eq('processed', False)\
            .order('received_date', desc=True)\
            .limit(25)\
            .execute()
        
    try:
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