// Utility to handle OAuth redirects to correct domain
export const handleOAuthRedirect = () => {
  try {
    const currentUrl = window.location.href;
    const targetDomain = 'https://hymnapp.netlify.app';
    
    console.log('Checking OAuth redirect for URL:', currentUrl);
    
    // Check if we're on the wrong domain with OAuth tokens
    const hasOAuthTokens = currentUrl.includes('access_token=') || 
                          currentUrl.includes('refresh_token=') || 
                          currentUrl.includes('provider_token=') ||
                          currentUrl.includes('expires_at=');
    
    const isWrongDomain = !window.location.hostname.includes('hymnapp.netlify.app') && 
                         !window.location.hostname.includes('localhost');
    
    console.log('OAuth check:', { hasOAuthTokens, isWrongDomain, hostname: window.location.hostname });
    
    if (hasOAuthTokens && isWrongDomain) {
      console.log('🔄 REDIRECTING OAuth from wrong domain to Netlify...');
      console.log('Current URL:', currentUrl);
      
      // Extract the path and all parameters
      const url = new URL(currentUrl);
      const newUrl = `${targetDomain}${url.pathname}${url.search}${url.hash}`;
      
      console.log('Redirecting to:', newUrl);
      
      // Force immediate redirect
      window.location.replace(newUrl);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in OAuth redirect handler:', error);
    return false;
  }
};
