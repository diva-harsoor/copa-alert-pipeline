import json
import os
import random
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from process_data import parse_copa3_form, extract_address, get_location_from_address, extract_basic_property_info, extract_seller_info, extract_financial_info, load_sf_neighborhoods, get_neighborhood_from_location

def random_datetime_last_10_days():
    """Generate a random datetime within the last 10 days."""
    now = datetime.now()
    ten_days_ago = now - timedelta(days=10)
    
    # Generate random seconds between ten_days_ago and now
    time_between = now - ten_days_ago
    total_seconds = int(time_between.total_seconds())
    random_seconds = random.randint(0, total_seconds)
    
    # Add random seconds to ten_days_ago
    random_datetime = ten_days_ago + timedelta(seconds=random_seconds)
    
    return random_datetime.isoformat()

def process_searchable_COPA3_form(pdf_path):
  try:
    cleaned_text = parse_copa3_form(pdf_path)

    address = extract_address(cleaned_text)
    basic_property_info = extract_basic_property_info(cleaned_text)
    seller_info = extract_seller_info(cleaned_text)
    financial_info = extract_financial_info(cleaned_text)
    time_sent_tz = random_datetime_last_10_days()
    print("generate_json.py: time_sent_tz: ", time_sent_tz)

    listing = {
      "time_sent_tz": time_sent_tz,
      # "location": get_location_from_address(address),
      # "full_address": address.get('full_address', ''),
      # "total_units": basic_property_info.get('total_units', -1),
      # "residential_units": basic_property_info.get('residential_units', -1),
      # "vacant_residential": basic_property_info.get('vacant_residential', -1),
      # "commercial_units": basic_property_info.get('commercial_units', -1),
      # "vacant_commercial": basic_property_info.get('vacant_commercial', -1),
      # "is_vacant_lot": basic_property_info.get('is_vacant_lot', False),
      "details": {
         "address_breakdown": {
      #    "street_address": address['street_address'],
      #    "secondary_address": address['secondary_address'],
      #    "zip_code": address['zip_code'],
        },
        "source": {
          "email_address": "edwin@campbell.com",
          "phone_number": "123-456-7890",
          "agent_name": "John Doe",
      #   "owner_name_COPA3": extract_seller_info(cleaned_text)['seller_name'],
          "pdf_path": pdf_path,
        },
      # "soft_story_required": basic_property_info.get('soft_story_required', False),
      # "financial_data": extract_financial_info(cleaned_text),
        "rent_roll": {
          "unit_1": {
            "rent": 1000,
            "tenant_name": "John Doe",
            "tenant_email": "john.doe@example.com",
            "unit_type": "studio",
          },
          "unit_2": {
            "rent": 1000,
            "tenant_name": "John Doe",
            "tenant_email": "john.doe@example.com",
            "unit_type": "studio",
          }
      }
    }
  }

    if address: 
      listing["location"] = get_location_from_address(address)
      listing["full_address"] = address.get('full_address', '')
      listing["details"]["address_breakdown"]["street_address"] = address.get('street_address', '')
      listing["details"]["address_breakdown"]["secondary_address"] = address.get('secondary_address', '')
      listing["details"]["address_breakdown"]["zip_code"] = address.get('zip_code', '')

    if seller_info:
      listing["details"]["source"]["owner_name_COPA3"] = seller_info.get('seller_name', '')

    if basic_property_info:
      listing["total_units"] = basic_property_info.get('total_units', -1)
      listing["residential_units"] = basic_property_info.get('residential_units', -1)
      listing["vacant_residential"] = basic_property_info.get('vacant_residential', -1)
      listing["commercial_units"] = basic_property_info.get('commercial_units', -1)
      listing["vacant_commercial"] = basic_property_info.get('vacant_commercial', -1)
      listing["is_vacant_lot"] = basic_property_info.get('is_vacant_lot', False)
      listing["details"]["soft_story_required"] = basic_property_info.get('soft_story_required', False)

    if financial_info:
      listing["asking_price"] = financial_info.get('asking_price', -1)
      listing["details"]["financial_data"] = financial_info

    print("DEBUG - asking_price in listing:", listing.get("asking_price"))  # Add this
    print("DEBUG - full listing keys:", listing.keys())  # Add this


  except Exception as e:
    print(f"Error processing {pdf_path}: {e}")
    return None

  return listing

# Data folder is local, change to your own path
def process_all_forms(folder_path="data"):

  neighborhoods = load_sf_neighborhoods()
  
  listings = []

  try:
    for pdf_file in os.listdir(folder_path):
      if pdf_file.endswith(".pdf"):
        full_path = os.path.join(folder_path, pdf_file)
        print(f"Processing {full_path}...")
        listing = process_searchable_COPA3_form(full_path)

        if listing and listing.get('location') and 'lat' in listing['location']:
          listing['neighborhood'] = get_neighborhood_from_location(listing['location']['lat'], listing['location']['lng'], neighborhoods)
          listings.append(listing)
        else:
          if listing:
            print(f"Skipping neighborhood lookup - invalid location data")
            listing['neighborhood'] = 'Unknown'
            listings.append(listing)

  except FileNotFoundError:
      print(f"The folder {folder_path} does not exist.")
  except Exception as e:  
      print(f"An error occurred accessing the folder: {e}")

  output = {"listings": listings}

  with open("property-data.json", "w") as f:
    json.dump(output, f, indent=4)

  return output

result = process_all_forms() # Uses default "data" folder

'''
listings = [
  {
      "id": "unique-id",
      "time_sent_tz": "2025-09-17T14:30:00-07:00",
      "location": {
          "lat": 37.770049,
          "lng": -122.4283606
      },
      "full_address": "107 - 113 Webster, 3899 24th Street San Francisco CA 94114",
      "neighborhood": "Hayes Valley",
      "asking_price": 1295000.0,
      "total_units": 4,
      "residential_units": 4,
      "vacant_residential": 0,
      "commercial_units": 4,
      "vacant_commercial": 0,
      "is_vacant_lot": false,
      "details": {
          "address_breakdown": {
              "street_address": "107 - 113 Webster",
              "secondary_address": "3899 24th Street",
              "zip_code": "94114",
          },
          "source": {
              "email_address": "edwin@campbell.com",
              "phone_number": "123-456-7890",
              "agent_name": "John Doe",
              "owner_name_COPA3": "The Edwin M. Campbell Trust",
          },
          "soft_story_required": false,
          "financial_data": {
              "monthly_income": 10000,
              "total_rents": 10000,
              "other_income": 1000,
              "total_monthly_income": 11000,
              "total_annual_income": 132000,
              "annual_expenses": 100000,
              "less_total_annual_expenses": 1000000,
              "net_operating_income": 100000,
              "property_tax_rate": 1.5,
              "property_tax_amount": 10000,
              "management_rate": 1.5,
              "management_amount": 10000,
              "insurance": 10000,
              "utilities": 10000,
              "maintenance": 10000,
              "other_expenses": 10000,
          }    
          "rent_roll": { // need to add
            "unit_1": {
              "rent": 1000,
              "tenant_name": "John Doe",
              "tenant_email": "john.doe@example.com",
              "unit_type": "studio",
            }
          }
      }
  }
]

'''