import pdfplumber
import re
import os
from typing import Dict, List, Optional, Union
import requests
from typing import Dict, Optional
from sodapy import Socrata
from shapely.geometry import shape, Point

def parse_copa3_form(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()

        # Clean the text first to remove OCR/PDF artifacts
        cleaned_text = re.sub(r'[_*]+', '', text)  # Remove underscores and asterisks
        cleaned_text = re.sub(r'\s+', ' ', cleaned_text)  # Normalize whitespace

        return cleaned_text

def extract_address_components(address_string):
    """
    Extract street address, secondary address, and zip code from a full address string.
    
    Args:
        address_string (str): Full address string
        
    Returns:
        dict: Contains 'street_address', 'secondary_address', and 'zip_code' fields
    """
    if not address_string:
        return {'street_address': '', 'secondary_address': '', 'zip_code': ''}
    
    # Extract zip code (5 digits, optionally followed by +4)
    zip_match = re.search(r'\b(\d{5}(?:-\d{4})?)\b', address_string)
    zip_code = zip_match.group(1) if zip_match else ''
    
    # Remove San Francisco CA and zip code from the string
    cleaned_address = address_string
    
    # Remove zip code
    if zip_code:
        cleaned_address = re.sub(r'\b' + re.escape(zip_code) + r'\b', '', cleaned_address)
    
    # Remove San Francisco and CA patterns
    patterns_to_remove = [
        r'\s*,?\s*San Francisco\s*,?\s*CA\s*',
        r'\s*,?\s*San Francisco\s*',
        r'\s*,?\s*CA\s*',
        r'\s+San Francisco\s+CA\s*',
        r'\s+San Francisco\s*',
        r'\s+CA\s*'
    ]
    
    for pattern in patterns_to_remove:
        cleaned_address = re.sub(pattern, '', cleaned_address, flags=re.IGNORECASE)
    
    # Clean up any trailing/leading commas and whitespace
    cleaned_address = re.sub(r'^[,\s]+|[,\s]+$', '', cleaned_address)
    
    # Now split by slash first (higher priority), then comma
    if '/' in cleaned_address:
        parts = [part.strip() for part in cleaned_address.split('/')]
    elif ',' in cleaned_address:
        parts = [part.strip() for part in cleaned_address.split(',')]
    else:
        parts = [cleaned_address.strip()]
    
    # Filter out empty parts
    address_parts = [part for part in parts if part.strip()]
    
    # Determine primary and secondary addresses
    if len(address_parts) >= 2:
        street_address = address_parts[0]
        secondary_address = address_parts[1]
    elif len(address_parts) == 1:
        street_address = address_parts[0]
        secondary_address = ''
    else:
        street_address = ''
        secondary_address = ''
    
    return {
        'street_address': street_address,
        'secondary_address': secondary_address,
        'zip_code': zip_code
    }

def extract_address(cleaned_text):
    
    # Pattern 1: Standard format with full state (CA) - from process_data.py
    standard_pattern = r'(.*?)Property Address:\s*([^,]+,\s*[A-Z]{2}\s*\d{5})'
    standard_match = re.search(standard_pattern, cleaned_text, re.DOTALL)
    
    if standard_match:
        before_label = standard_match.group(1).strip()
        city_state_zip = standard_match.group(2).strip()
        
        # Look for street address with standard suffixes
        street_match = re.search(r'(\d+[\w\s-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd))', before_label)
        if street_match:
            street_address = street_match.group(1).strip()
            full_address = f"{street_address}, {city_state_zip}"
            components = extract_address_components(full_address)
            
            return {
                'full_address': full_address,
                'street_address': components['street_address'],
                'secondary_address': components['secondary_address'],
                'zip_code': components['zip_code'],
                'property_type': 'single_building'
            }
    
    # Pattern 2: Flexible format (missing CA or other variations)
    flexible_pattern = r'(.*?)Property Address:\s*([^\n]+)'
    flexible_match = re.search(flexible_pattern, cleaned_text, re.DOTALL)
    
    if flexible_match:
        before_label = flexible_match.group(1).strip()
        city_state_zip = flexible_match.group(2).strip()
        
        # Extract just the ZIP and city from the line
        zip_match = re.search(r'([^,\n]*(?:San Francisco)[^,\n]*\d{5})', city_state_zip)
        if zip_match:
            clean_city_zip = zip_match.group(1).strip()
        else:
            clean_city_zip = city_state_zip
            
        # Word-based extraction for tricky cases
        parts = before_label.split('Property Address:')[0]
        words = parts.strip().split()
        
        # Look for address in last few words
        if len(words) >= 2:
            for i in range(max(0, len(words)-6), len(words)):
                if words[i] and words[i][0].isdigit():
                    street_address = ' '.join(words[i:])
                    full_address = f"{street_address}, {clean_city_zip}"
                    components = extract_address_components(full_address)
                    
                    return {
                        'full_address': full_address,
                        'street_address': components['street_address'],
                        'secondary_address': components['secondary_address'],
                        'zip_code': components['zip_code'],
                        'property_type': 'single_building'
                    }
    
    # Pattern 3: Fallback - address completely after "Property Address:"
    single_address = re.search(r'Property Address:\s*(\d+[^,\n]+,\s*[^,]+,\s*[A-Z]{2}\s*\d{5})', cleaned_text)
    if single_address:
        full_address = single_address.group(1).strip()
        components = extract_address_components(full_address)
        
        return {
            'full_address': full_address,
            'street_address': components['street_address'],
            'secondary_address': components['secondary_address'],
            'zip_code': components['zip_code'],
            'property_type': 'single_building'
        }
    
    return None

'''
def extract_address(cleaned_text):
    
    # Pattern 1: Standard format with full state (CA) - from process_data.py
    standard_pattern = r'(.*?)Property Address:\s*([^,]+,\s*[A-Z]{2}\s*\d{5})'
    standard_match = re.search(standard_pattern, cleaned_text, re.DOTALL)
    
    if standard_match:
        before_label = standard_match.group(1).strip()
        city_state_zip = standard_match.group(2).strip()
        
        # Look for street address with standard suffixes
        street_match = re.search(r'(\d+[\w\s-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd))', before_label)
        if street_match:
            street_address = street_match.group(1).strip()
            return {
                'full_address': f"{street_address}, {city_state_zip}",
                'property_type': 'single_building'
            }
    
    # Pattern 2: Flexible format (missing CA or other variations)
    flexible_pattern = r'(.*?)Property Address:\s*([^\n]+)'
    flexible_match = re.search(flexible_pattern, cleaned_text, re.DOTALL)
    
    if flexible_match:
        before_label = flexible_match.group(1).strip()
        city_state_zip = flexible_match.group(2).strip()
        
        # Extract just the ZIP and city from the line
        zip_match = re.search(r'([^,\n]*(?:San Francisco)[^,\n]*\d{5})', city_state_zip)
        if zip_match:
            clean_city_zip = zip_match.group(1).strip()
        else:
            clean_city_zip = city_state_zip
            
        # Word-based extraction for tricky cases
        parts = before_label.split('Property Address:')[0]
        words = parts.strip().split()
        
        # Look for address in last few words
        if len(words) >= 2:
            for i in range(max(0, len(words)-6), len(words)):
                if words[i] and words[i][0].isdigit():
                    street_address = ' '.join(words[i:])
                    return {
                        'full_address': f"{street_address}, {clean_city_zip}",
                        'property_type': 'single_building'
                    }
    
    # Pattern 3: Fallback - address completely after "Property Address:"
    single_address = re.search(r'Property Address:\s*(\d+[^,\n]+,\s*[^,]+,\s*[A-Z]{2}\s*\d{5})', cleaned_text)
    if single_address:
        return {
            'full_address': single_address.group(1).strip(),
            'property_type': 'single_building'
        }
    
    return None
'''

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

def load_sf_neighborhoods():
    """Load and return processed neighborhood data."""
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
            print(f"Error processing {n.get('name', 'Unknown')}: {e}")
            continue
    
    return processed

def get_neighborhood_from_location(lat, lng, neighborhoods):
    """Get neighborhood from location"""        
    point = Point(lng, lat)
    for neighborhood in neighborhoods:
        if neighborhood['geometry'].contains(point):
            return neighborhood['name']
    return 'Unknown neighborhood'

def extract_basic_property_info(cleaned_text: str) -> Dict[str, Union[str, int, bool]]:
    """Extract basic property information from COPA form text"""
        
    info = {}
    
    # Total number of units
    total_units_match = re.search(r'Total\s*#\s*of\s*units\s*(\d+)', cleaned_text, re.IGNORECASE)
    if total_units_match:
        info['total_units'] = int(total_units_match.group(1))
    
    # Number of residential units
    residential_match = re.search(r'#\s*of\s*residential\s*units\s*(\d+)', cleaned_text, re.IGNORECASE)
    if residential_match:
        info['residential_units'] = int(residential_match.group(1))
    
    # Currently vacant residential
    vacant_residential_match = re.search(r'#\s*currently\s*vacant\s*(\d+)', cleaned_text, re.IGNORECASE)
    if vacant_residential_match:
        info['vacant_residential'] = int(vacant_residential_match.group(1))
    
    # Commercial units
    commercial_match = re.search(r'#\s*of\s*commercial\s*\(office/retail\)\s*units\s*(\d+)', cleaned_text, re.IGNORECASE)
    if commercial_match:
        info['commercial_units'] = int(commercial_match.group(1))
    
    # Currently vacant commercial
    vacant_commercial_pattern = r'#\s*currently\s*vacant.*?(\d+)(?=\s|$)'
    all_vacant_matches = re.findall(vacant_commercial_pattern, cleaned_text, re.IGNORECASE)
    if len(all_vacant_matches) >= 2:
        info['vacant_commercial'] = int(all_vacant_matches[1])
    
    # Vacant lot checkbox
    vacant_lot_match = re.search(r'Check\s*if\s*a\s*vacant\s*lot\s{0,10}([☑✓X])', cleaned_text, re.IGNORECASE)
    info['is_vacant_lot'] = bool(vacant_lot_match)
    
    # Soft story work
    soft_story_match = re.search(r'Soft\s*Story\s*work\s*required.*?(?:(?P<yes>[☑✓X])\s*Yes|(?P<no>[☑✓X])\s*No)', cleaned_text, re.IGNORECASE)

    if soft_story_match:
        if soft_story_match.group('yes'):
            info['soft_story_required'] = True
        elif soft_story_match.group('no'):
            info['soft_story_required'] = False

    return info

def extract_seller_info(text: str) -> Dict[str, str]:
    """Extract seller information"""
    
    info = {}
    
    # Seller name - appears right after "Seller:"
    seller_match = re.search(r'Seller:\s*(.*?)(?=(Asking\s*price)|Askingprice)', text, re.DOTALL)
    if seller_match:
        info['seller_name'] = seller_match.group(1).strip()
        
    return info

def extract_financial_info(text: str) -> Dict[str, str]:
    """Extract financial information from the form"""
    
    info = {}
    
    # Asking price
    asking_price_match = re.search(r'(?:Asking\s*price|Askingprice):\s*\$?([\d,]+\.?\d*)', text)
    if asking_price_match:
        info['asking_price'] = float(asking_price_match.group(1).replace(',', ''))
    
    # Monthly income
    monthly_income_match = re.search(r'(?:Monthly\s*income|Monthlyincome):\s*\$?([\d,]+\.?\d*)', text)
    if monthly_income_match:
        info['monthly_income'] = float(monthly_income_match.group(1).replace(',', ''))
    
    # Total rents (computed from table below) - stay on same line
    total_rents_match = re.search(r'(?:Total\s*rents\s*\(computed from table below\)|Totalrents\(computedfromtablebelow\))\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if total_rents_match:
        info['total_rents'] = float(total_rents_match.group(1).replace(',', ''))
    
    # Other income - stay on same line
    other_income_match = re.search(r'(?:Other\s*income|Otherincome)\s*\(parking,?\s*laundry,?\s*etc\.?\)\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if other_income_match:
        info['other_income'] = float(other_income_match.group(1).replace(',', ''))
    
    # Total monthly income - stay on same line
    total_monthly_match = re.search(r'(?:Total\s*monthly\s*income|Totalmonthlyincome)\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if total_monthly_match:
        info['total_monthly_income'] = float(total_monthly_match.group(1).replace(',', ''))
    
    # Total annual income - stay on same line
    total_annual_match = re.search(r'(?:Total\s*annual\s*income|Totalannualincome)\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if total_annual_match:
        info['total_annual_income'] = float(total_annual_match.group(1).replace(',', ''))
    
    # Annual expenses (projected)
    annual_expenses_match = re.search(r'(?:Annual\s*expenses\s*\(projected\)|Annualexpenses\(projected\)):\s*\$?([\d,]+\.?\d*)', text)
    if annual_expenses_match:
        info['annual_expenses'] = float(annual_expenses_match.group(1).replace(',', ''))
    
    # Less total annual expenses - stay on same line
    less_total_annual_expenses_match = re.search(r'(?:Less\s*total\s*annual\s*expenses|Lesstotalannualexpenses)\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if less_total_annual_expenses_match:
        info['less_total_annual_expenses'] = float(less_total_annual_expenses_match.group(1).replace(',', ''))
    
    # Net operating income - stay on same line
    net_income_match = re.search(r'(?:Net\s*operating\s*income|Netoperatingincome)\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if net_income_match:
        info['net_operating_income'] = float(net_income_match.group(1).replace(',', ''))
    
    # Property tax - extract both percentage and dollar amount
    property_tax_rate_match = re.search(r'(?:Property\s*tax|Propertytax)\s*at\s*([\d.]+)%', text) # inconsistent
    if property_tax_rate_match:
        info['property_tax_rate'] = float(property_tax_rate_match.group(1))

    property_tax_amount_match = re.search(r'(?:Property\s*tax|Propertytax)\s*at.*?tax\s*rate\s*\$?([\d,]+\.?\d*)', text)
    if property_tax_amount_match:
        info['property_tax_amount'] = float(property_tax_amount_match.group(1).replace(',', ''))

    # Management fee - extract both percentage and dollar amount
    management_rate_match = re.search(r'(?:Management|Managementat)\s*at\s*([\d.]+)%\s*of\s*income', text)
    if management_rate_match:
        info['management_rate'] = float(management_rate_match.group(1))

    # Management dollar amount - try specific format first
    management_amount_match = re.search(r'(?:Management|Managementat)\s*at\s*[\d.]+%\s*of\s*income\s*\$?([\d,]+\.?\d*)', text) # didn't record 0.00
    if management_amount_match:
        info['management_amount'] = float(management_amount_match.group(1).replace(',', ''))
    
    # Insurance - stay on same line
    insurance_match = re.search(r'Insurance\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if insurance_match:
        info['insurance'] = float(insurance_match.group(1).replace(',', ''))
    
    # Utilities - stay on same line
    utilities_match = re.search(r'Utilities\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if utilities_match:
        info['utilities'] = float(utilities_match.group(1).replace(',', ''))
    
    # Maintenance - stay on same line
    maintenance_match = re.search(r'Maintenance\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if maintenance_match:
        info['maintenance'] = float(maintenance_match.group(1).replace(',', ''))
    
    # Other expenses - stay on same line
    other_expenses_match = re.search(r'(?:Other\s*expenses|Otherexpenses)\s*\$?([\d,]+\.?\d*)(?=\s|$)', text)
    if other_expenses_match:
        info['other_expenses'] = float(other_expenses_match.group(1).replace(',', ''))
        
    return info

'''
# Data folder is local, change to your own path
folder_path = "data"

try:
    filenames = os.listdir(folder_path)
    for filename in filenames:
        if os.path.isfile(os.path.join(folder_path, filename)):
            current_path = os.path.join(folder_path, filename)
            
            try:
                cleaned_text = parse_copa3_form(current_path)
                print("filename: ", filename, "\n")
                extract_address(cleaned_text)
                extract_basic_property_info(cleaned_text)
                extract_seller_info(cleaned_text)
                extract_financial_info(cleaned_text)
                print("\n")
                                
            except Exception as e:
                print(f"Error processing {current_path}: {e}")
                print("Skipping to next file...\n")
                continue  # Skip to next file
                
except FileNotFoundError:
    print(f"The folder {folder_path} does not exist.")
except Exception as e:  
    print(f"An error occurred accessing the folder: {e}")
'''