function NavBar( {handleLogout} ) {
    return (
      <nav className="h-16 bg-white border-b border-gray-200 flex items-center justify-between">
        {/* Left side - Logo and Title */}
        <div className="flex items-center gap-3">
          {/* Logo placeholder */}
          <div className="w-12 h-12 bg-blue-600 rounded flex items-center justify-center">
            <img src="/SF_COPA_Dashboard_Logo.png" alt="Logo" className="w-12 h-12" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">SF COPA Dashboard</h1>
        </div>
  
        {/* Right side - Actions */}
        <div className="flex items-center gap-4">
           {/* Add Property Button 
          <button className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            Add Property
          </button>
          */}
  
          {/* Profile Button 
          <button className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
            <span className="text-gray-600 font-medium text-sm">👤</span>
          </button>
          */}
  
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors">
            Logout
          </button>

          {/* Feedback Button */}
          <button 
            onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSfhrgnZIeigF5WExD9N-zaueEajP-pJJLLPe-y3wFsdY4DjoA/viewform?usp=header', '_blank')}
            className="px-3 py-2 text-gray-500 text-sm hover:text-gray-600 hover:underline rounded-md transition-colors">
            Give Feedback
          </button>

        </div>
      </nav>
    );
  }
  
  export default NavBar;

  