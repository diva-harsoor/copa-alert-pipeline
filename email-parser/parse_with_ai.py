import json
import google.generativeai as genai
import config

# Configure Gemini
genai.configure(api_key=config.GEMINI_API_KEY)

# Load the prompt
with open('prompt.txt', 'r') as f:
    SYSTEM_PROMPT = f.read()

def parse_email_with_ai(email_subject, email_text, attachment_texts):
    """
    Send email and attachment text to Gemini API for parsing.
    Returns parsed JSON data.
    """

    # Combine email subject and text
    combined_text = f"EMAIL SUBJECT:\n{email_subject}\n\nEMAIL BODY:\n{email_text}\n\n"
    
    if attachment_texts:
        combined_text += "ATTACHMENTS:\n"
        for i, att_text in enumerate(attachment_texts, 1):
            combined_text += f"\n--- ATTACHMENT {i} ---\n{att_text}\n"
    
    # Prepare the full prompt
    full_prompt = f"{SYSTEM_PROMPT}\n\n---\n\nHere is the email data to parse:\n\n{combined_text}"
    
    try:
        # Call Gemini API
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        print("  Calling Gemini API...")
        response = model.generate_content(full_prompt)
        
        # Extract JSON from response
        response_text = response.text.strip()
        
        # Sometimes the model wraps JSON in markdown code blocks
        if response_text.startswith('```json'):
            response_text = response_text[7:]  # Remove ```json
        if response_text.startswith('```'):
            response_text = response_text[3:]   # Remove ```
        if response_text.endswith('```'):
            response_text = response_text[:-3]  # Remove trailing ```
        
        response_text = response_text.strip()
        
        # Parse JSON
        parsed_data = json.loads(response_text)
        
        print(f"  ✓ Gemini parsed successfully")
        print(f"    Classification: {parsed_data.get('classification')}")
        print(f"    Confidence: {parsed_data.get('confidence')}")
        print(f"    Address: {parsed_data.get('full_address')}")
        
        return parsed_data
    
    except json.JSONDecodeError as e:
        print(f"  ✗ Failed to parse JSON response: {e}")
        print(f"  Response was: {response_text[:200]}...")
        return None
    
    except Exception as e:
        print(f"  ✗ Error calling Gemini API: {e}")
        return None

if __name__ == "__main__":
    # Test with your extracted text
    print("Testing Gemini API parsing...")
    
    # Load test data
    test_file = input("Enter path to extracted text file (or press enter to paste text): ")
    
    if test_file:
        with open(test_file, 'r') as f:
            test_text = f.read()
    else:
        print("Paste your text (press Ctrl+D when done):")
        import sys
        test_text = sys.stdin.read()
    
    # Parse it
    result = parse_email_with_ai(test_text, [])
    
    if result:
        print("\n--- PARSED RESULT ---")
        print(json.dumps(result, indent=2))
        
        # Save to file
        with open('test_parse_result.json', 'w') as f:
            json.dumps(result, f, indent=2)
        print("\n✓ Result saved to test_parse_result.json")
    else:
        print("\n✗ Parsing failed")