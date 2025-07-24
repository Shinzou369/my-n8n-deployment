# Google OAuth Fix for n8n

## Problem
Google OAuth authentication fails with "Error 400: invalid_request" because n8n doesn't know its own public URL.

## Root Cause
The error shows: `redirect_uri=n8n-app-gvq5/rest/oauth2-credential/callback`

This is missing the full HTTPS URL that Google requires for security.

## Solution Applied
Added missing environment variables to render.yaml:

### N8N_HOST
- **Value**: `n8n-app-gvq5.onrender.com` 
- **Purpose**: Tells n8n its hostname (without https://)
- **Effect**: Enables proper OAuth redirect URL generation

### N8N_EDITOR_BASE_URL  
- **Value**: `https://n8n-app-gvq5.onrender.com/`
- **Purpose**: Sets the base URL for the n8n editor
- **Effect**: Ensures consistent URL handling

## Next Steps
1. **Push Configuration**: Deploy the updated render.yaml
2. **Google Cloud Console**: Add the correct redirect URI:
   - Go to Google Cloud Console
   - Find your OAuth client ID
   - Add: `https://n8n-app-gvq5.onrender.com/rest/oauth2-credential/callback`
3. **Test**: Try Google authentication again

## Expected Result
Instead of: `redirect_uri=n8n-app-gvq5/rest/oauth2-credential/callback`
You'll get: `redirect_uri=https://n8n-app-gvq5.onrender.com/rest/oauth2-credential/callback`

This will satisfy Google's OAuth security requirements and allow successful authentication.