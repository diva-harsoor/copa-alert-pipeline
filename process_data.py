import pdfplumber
import re
import os
from typing import Dict, List, Optional, Union

def parse_copa3_form(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()

        # Clean the text first to remove OCR/PDF artifacts
        cleaned_text = re.sub(r'[_*]+', '', text)  # Remove underscores and asterisks
        cleaned_text = re.sub(r'\s+', ' ', cleaned_text)  # Normalize whitespace

        return cleaned_text

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

    print (info)

def extract_seller_info(text: str) -> Dict[str, str]:
    """Extract seller information"""
    
    info = {}
    
    # Seller name - appears right after "Seller:"
    seller_match = re.search(r'Seller:\s*(.*?)(?=(Asking\s*price)|Askingprice)', text, re.DOTALL)
    if seller_match:
        info['seller_name'] = seller_match.group(1).strip()
        
    return info

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
                print(extract_seller_info(cleaned_text))
                print("\n")
                '''
                if (filename=="test6.pdf" or filename=="test12.pdf"):
                    print("parsed_text: ", cleaned_text)
                '''
            except Exception as e:
                print(f"Error processing {current_path}: {e}")
                print("Skipping to next file...\n")
                continue  # Skip to next file
                
except FileNotFoundError:
    print(f"The folder {folder_path} does not exist.")
except Exception as e:  
    print(f"An error occurred accessing the folder: {e}")