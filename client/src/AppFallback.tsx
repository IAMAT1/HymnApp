import { useState } from "react";

// Minimal fallback app to debug deployment issues
function AppFallback() {
  const [message, setMessage] = useState("Loading music app...");

  const testAPI = async () => {
    try {
      setMessage("Testing API connection...");
      const response = await fetch('/.netlify/functions/search?q=test');
      const data = await response.json();
      setMessage(`API works! Found ${data.length || 0} results`);
    } catch (error) {
      setMessage(`API Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold mb-4">Hymn Music App</h1>
        <p className="text-gray-400 mb-8">{message}</p>
        
        <div className="space-y-4">
          <button 
            onClick={testAPI}
            className="bg-green-500 hover:bg-green-600 px-6 py-3 rounded-lg font-semibold"
          >
            Test API Connection
          </button>
          
          <div className="text-sm text-gray-500">
            <p>If you see this, the React app is loading correctly.</p>
            <p>The issue might be with specific components or API calls.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppFallback;