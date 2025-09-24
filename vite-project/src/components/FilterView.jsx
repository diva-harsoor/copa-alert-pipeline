export default function FilterView() {

    return (
      <div className="p-4 border-b bg-white">
      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search properties..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filters Section */}
      <div className="space-y-3">
        {/* Neighborhood Filter */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">📍 Neighborhood:</span>
            <select className="text-sm border-0 bg-transparent text-blue-600 font-medium focus:outline-none">
              <option value="all">All</option>
              <option value="soma">SOMA</option>
              <option value="mission">Mission</option>
              <option value="castro">Castro</option>
            </select>
          </div>
        </div>

        {/* Units Filter - Slider */}
        <div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">🏢 Units:</label>
            <div className="flex-1">
              <input
                type="range"
                min="1"
                max="50"
                value="25"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <span className="text-sm font-medium text-blue-600 w-8">25</span>
          </div>
        </div>

        {/* Days Remaining Filter - Slider */}
        <div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">⏰ Days:</label>
            <div className="flex-1">
              <input
                type="range"
                min="1"
                max="5"
                value="3"
                className="w-full h-2 bg-gray-200 from-red-200 via-yellow-200 to-green-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <span className="text-sm font-medium text-blue-600 w-8">3</span>
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <button className="text-sm text-gray-500 hover:text-gray-700">
          Clear all filters
        </button>
      </div>
    </div>
      )
}