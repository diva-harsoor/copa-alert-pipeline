import pdfplumber
import re
import os

    
def parse_copa3_form(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        text = page.extract_text()
        return text

def extract_address(text):
    # Clean the text first to remove OCR/PDF artifacts
    cleaned_text = re.sub(r'[_*]+', '', text)  # Remove underscores and asterisks
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text)  # Normalize whitespace
    
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
    
    # Pattern 2: Flexible format (missing CA or other variations) - from process_data_v2.py  
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


# Data folder is local, change to your own path
folder_path = "data/top_page"

try:
    filenames = os.listdir(folder_path)
    for filename in filenames:
        if os.path.isfile(os.path.join(folder_path, filename)):
            current_path = os.path.join(folder_path, filename)
            
            try:
                parsed_text = parse_copa3_form(current_path)
                result = extract_address(parsed_text)
                print("current path: ", current_path, "\n extract_address: ", result, "\n")
            except Exception as e:
                print(f"Error processing {current_path}: {e}")
                print("Skipping to next file...\n")
                continue  # Skip to next file
                
except FileNotFoundError:
    print(f"The folder {folder_path} does not exist.")
except Exception as e:  
    print(f"An error occurred accessing the folder: {e}")