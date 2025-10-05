import os
from pathlib import Path
from dotenv import load_dotenv

# Get the directory of where this script is located
BASE_DIR = Path(__file__).resolve().parent

# Load environment variables
dotenv_path = BASE_DIR / '.env'
load_dotenv(dotenv_path)

# Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Google AI parsing APIs
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
VISION_CREDENTIALS_PATH = os.getenv('VISION_CREDENTIALS_PATH')

# Validate required variables
required_vars = {
    'SUPABASE_URL': SUPABASE_URL,
    'SUPABASE_KEY': SUPABASE_KEY,
    'GEMINI_API_KEY': GEMINI_API_KEY,
    'VISION_CREDENTIALS_PATH': VISION_CREDENTIALS_PATH
}

missing = [key for key, value in required_vars.items() if not value]
if missing:
    raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

print("✅ All required environment variables are set")