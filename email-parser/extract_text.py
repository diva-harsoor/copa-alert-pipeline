import os
import io
from google.cloud import vision
from PyPDF2 import PdfReader
from pdf2image import convert_from_path
from PIL import Image
import config

# Initialize Vision API client
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = config.VISION_CREDENTIALS_PATH
vision_client = vision.ImageAnnotatorClient()

def extract_text_from_pdf(file_path):
    """
    Try to extract text from PDF. If text extraction fails (non-searchable PDF),
    fall back to OCR.
    """
    try:
        # Try direct text extraction first
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        
        # If we got meaningful text, return it
        if text.strip():
            print(f"  ✓ Extracted text directly from PDF ({len(text)} chars)")
            return text
        
        # Otherwise, fall back to OCR
        print(f"  ⚠ PDF appears to be non-searchable, using OCR...")
        return ocr_pdf(file_path)
    
    except Exception as e:
        print(f"  ⚠ Error extracting text from PDF: {e}, trying OCR...")
        return ocr_pdf(file_path)

def ocr_pdf(file_path):
    """
    Convert PDF pages to images and OCR them using Google Vision API.
    """
    try:
        # Convert PDF to images
        images = convert_from_path(file_path)
        
        all_text = ""
        for i, image in enumerate(images):
            print(f"    OCR page {i+1}/{len(images)}...")
            page_text = ocr_image(image)
            all_text += page_text + "\n"
        
        print(f"  ✓ OCR completed ({len(all_text)} chars)")
        return all_text
    
    except Exception as e:
        print(f"  ✗ Error during OCR: {e}")
        return ""

def ocr_image(image):
    """
    OCR a PIL Image using Google Vision API.
    """
    try:
        # Convert PIL image to bytes
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='PNG')
        img_byte_arr = img_byte_arr.getvalue()
        
        # Call Vision API
        vision_image = vision.Image(content=img_byte_arr)
        response = vision_client.text_detection(image=vision_image)
        
        if response.error.message:
            raise Exception(response.error.message)
        
        # Extract text
        texts = response.text_annotations
        if texts:
            return texts[0].description
        return ""
    
    except Exception as e:
        print(f"    ✗ OCR error: {e}")
        return ""

def extract_text_from_image(file_path):
    """
    Extract text from an image file using OCR.
    """
    try:
        image = Image.open(file_path)
        text = ocr_image(image)
        print(f"  ✓ OCR completed ({len(text)} chars)")
        return text
    except Exception as e:
        print(f"  ✗ Error extracting text from image: {e}")
        return ""

def extract_text_from_file(file_path, content_type):
    """
    Main function to extract text from a file based on its content type.
    """
    print(f"  Processing {os.path.basename(file_path)} ({content_type})...")
    
    if content_type == 'application/pdf':
        return extract_text_from_pdf(file_path)
    elif content_type.startswith('image/'):
        return extract_text_from_image(file_path)
    else:
        print(f"  ⚠ Unsupported content type: {content_type}")
        return ""

if __name__ == "__main__":
    # Test the extraction
    print("Testing text extraction...")
    test_file = input("Enter path to test file: ")
    content_type = input("Enter content type (e.g., application/pdf or image/png): ")
    
    text = extract_text_from_file(test_file, content_type)

    # Save to file
    output_file = "extracted_text_output.txt"
    with open(output_file, 'w') as f:
        f.write(text)

    print("\n--- Extracted Text ---")
    print(text[:500])  # Print first 500 chars
    print(f"\n... (total {len(text)} characters)")
    print(f"\n✓ Extracted text saved to {output_file}")