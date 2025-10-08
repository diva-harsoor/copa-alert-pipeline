import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import DOMPurify from 'dompurify';

export default function SourceMaterials({ listingId }) {
  const [emails, setEmails] = useState([]);
  const [attachments, setAttachments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewUrls, setPreviewUrls] = useState({}); // Cache URLs

  useEffect(() => {
    async function fetchEmailsAndAttachments() {
      setLoading(true);
      setError(null);

      // Fetch emails
      const { data: emailData, error: emailError } = await supabase
        .from('emails')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });

      if (emailError) {
        console.error('Error fetching emails:', emailError);
        setError('Failed to load emails');
        setLoading(false);
        return;
      }

      setEmails(emailData || []);

      // Fetch attachments for all emails
      if (emailData && emailData.length > 0) {
        const emailIds = emailData.map(email => email.id);
        
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('email_attachments')
          .select('*')
          .in('email_id', emailIds);

        if (attachmentError) {
          console.error('Error fetching attachments:', attachmentError);
        } else {
          // Group attachments by email_id
          const attachmentsByEmail = {};
          attachmentData.forEach(attachment => {
            if (!attachmentsByEmail[attachment.email_id]) {
              attachmentsByEmail[attachment.email_id] = [];
            }
            attachmentsByEmail[attachment.email_id].push(attachment);
          });
          setAttachments(attachmentsByEmail);
        }
      }
      
      setLoading(false);
    }

    if (listingId) {
      fetchEmailsAndAttachments();
    }
  }, [listingId]);

  const getPublicUrl = async (attachment) => {
    // Check if we already have the URL cached
    if (previewUrls[attachment.id]) {
      return previewUrls[attachment.id];
    }
  
    if (!attachment.storage_path) {
      console.error('No storage path for attachment:', attachment);
      return null;
    }
  
    // Generate a signed URL that expires in 1 hour (3600 seconds)
    const { data, error } = await supabase.storage
      .from('email-attachments')
      .createSignedUrl(attachment.storage_path, 3600);
  
    if (error) {
      console.error('Error generating signed URL:', error);
      return null;
    }
  
    const url = data?.signedUrl;
    
    if (url) {
      // Cache the URL
      setPreviewUrls(prev => ({ ...prev, [attachment.id]: url }));
    }
  
    return url;
  };

  const handleAttachmentClick = async (attachment) => {
    // Toggle preview for PDFs and images
    if (isPDF(attachment.content_type) || isImage(attachment.content_type)) {
      if (previewAttachment?.id === attachment.id) {
        setPreviewAttachment(null); // Close if clicking same attachment
      } else {
        const url = await getPublicUrl(attachment);
        if (url) {
          setPreviewAttachment({ ...attachment, url });
        } else {
          alert('Unable to load attachment preview');
        }
      }
    } else {
      // For other file types, get URL and open in new tab
      const url = await getPublicUrl(attachment);
      if (url) {
        window.open(url, '_blank');
      } else {
        alert('Unable to open attachment');
      }
    }
  };

  const handleDownload = async (attachment) => {
    const url = await getPublicUrl(attachment);
    if (!url) {
      alert('Unable to download attachment');
      return;
    }
  
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename;
    link.target = '_blank'; // Fallback to open in new tab if download fails
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading emails...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">No emails found for this property</div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Date unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (contentType) => {
    if (!contentType) return '📄';
    if (contentType.includes('pdf')) return '📕';
    if (contentType.includes('image')) return '🖼️';
    if (contentType.includes('word') || contentType.includes('document')) return '📝';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return '📊';
    return '📄';
  };

  const isPDF = (contentType) => {
    return contentType && contentType.includes('pdf');
  };

  const isImage = (contentType) => {
    return contentType && contentType.includes('image');
  };

  return (
    <div className="space-y-6">
      {emails.map((email) => (
        <div key={email.id} className="border-b border-gray-200 pb-6 last:border-b-0">
          {/* Email Header */}
          <div className="mb-3">
            <h4 className="font-semibold text-gray-900 mb-1">
              {email.subject || '(No Subject)'}
            </h4>
            <div className="text-sm text-gray-600">
              <div>From: {email.from_address || 'Unknown sender'}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatDate(email.created_at)}
              </div>
            </div>
          </div>

          {/* Email Body */}
          <div 
            className="text-sm text-gray-700 mb-4 text-left"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.raw_html || email.raw_text || '(No content)') }}
          />

          {/* Attachments */}
          {attachments[email.id] && attachments[email.id].length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 mb-2">
                Attachments ({attachments[email.id].length})
              </div>
              <div className="space-y-2">
                {attachments[email.id].map((attachment) => (
                  <div key={attachment.id}>
                    <div 
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleAttachmentClick(attachment)}
                    >
                    <span className="text-lg">{getFileIcon(attachment.content_type)}</span>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                        {attachment.filename}
                        </div>
                        <div className="text-xs text-gray-500">
                        {formatFileSize(attachment.file_size)}
                        </div>
                    </div>
                    
                    {/* Download button */}
                    <button
                        onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering preview
                        handleDownload(attachment);
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="Download"
                    >
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                    </button>
                    
                    {(isPDF(attachment.content_type) || isImage(attachment.content_type)) ? (
                        <svg 
                        className={`w-4 h-4 text-gray-400 transition-transform ${previewAttachment?.id === attachment.id ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    )}
                    </div>
                    {/* Preview for PDFs and Images */}
                    {previewAttachment?.id === attachment.id && previewAttachment.url && (
                      <div className="mt-2 border border-gray-300 rounded overflow-hidden bg-white">
                        {isPDF(attachment.content_type) ? (
                          <iframe
                            src={previewAttachment.url}
                            className="w-full h-96"
                            title={attachment.filename}
                            allow="fullscreen"
                          />
                        ) : isImage(attachment.content_type) ? (
                          <img
                            src={previewAttachment.url}
                            alt={attachment.filename}
                            className="w-full h-auto"
                          />
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}