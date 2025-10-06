from datetime import datetime, timedelta
from supabase import create_client
import config

supabase = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

# Get old emails
ninety_days_ago = datetime.now() - timedelta(days=90)
old_emails = supabase.table('emails')\
    .select('id')\
    .lt('received_date', ninety_days_ago.isoformat())\
    .execute()

# Get their attachments
for email in old_emails.data:
    attachments = supabase.table('email_attachments')\
        .select('storage_path')\
        .eq('email_id', email['id'])\
        .execute()
    
    # Delete files from storage
    for att in attachments.data:
        if att['storage_path']:
            try:
                supabase.storage.from_('email-attachments').remove([att['storage_path']])
            except Exception as e:
                print(f"Failed to delete {att['storage_path']}: {e}")

# Then run the SQL delete
supabase.rpc('delete_old_emails').execute()
