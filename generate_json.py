import json
import uuid
import os
from process_data import parse_copa3_form, extract_address, extract_basic_property_info, extract_seller_info, extract_financial_info

def process_searchableCOPA3_form(pdf_path):
  try:
    cleaned_text = parse_copa3_form(pdf_path)
    listing = {
      "id": str(uuid.uuid4()),
      "source": pdf_path,
      "address": extract_address(cleaned_text),
      "basic_property_info": extract_basic_property_info(cleaned_text),
      "seller_info": extract_seller_info(cleaned_text),
      "financial_data": extract_financial_info(cleaned_text),
    }

  except Exception as e:
    print(f"Error processing {pdf_path}: {e}")
    return None

  return listing

# Data folder is local, change to your own path
def process_all_forms(folder_path="data"):
  listings = []

  try:
    for pdf_file in os.listdir(folder_path):
      if pdf_file.endswith(".pdf"):
        full_path = os.path.join(folder_path, pdf_file)
        print(f"Processing {full_path}...")
        listing = process_searchableCOPA3_form(full_path)

        if listing:
          listings.append(listing)
        else:
          print(f"Skipping {full_path} due to error")

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
{
  "listings": [
    {
      "id": "unique-id",
      "source": "filename.pdf",
      "date_submitted": "2025-09-18", // need to add
      "address": "123 Main St, San Francisco, CA 94133",
      "basic_property_info": {
        "total_units": 10,
        "residential_units": 8,
        "vacant_residential": 2,
        "commercial_units": 2,
        "vacant_commercial": 1,
        "is_vacant_lot": true,
        "soft_story_required": true
      },
      "seller_info": {
        "seller_name": "John Doe",
        // should add property agent name and email here
      },
      "financial_data": {
        "asking_price": 1000000,
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
      },
      "rent_roll": { // need to add
        "unit_1": {
          "rent": 1000,
          "tenant_name": "John Doe",
          "tenant_email": "john.doe@example.com",
        }
      }
    }
  ]
}

'''