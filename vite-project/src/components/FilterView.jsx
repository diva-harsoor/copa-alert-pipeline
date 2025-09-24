import './FIlterView.css'

export default function FilterView() {

    return (
      <div className="p-4 border-b bg-white">
      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search properties..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        />
      </div>

      {/* Filters Section */}
      <div className="space-y-3">
        {/* Neighborhood Filter */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">📍 Neighborhood:</span>
            <select className="text-sm border-0 bg-transparent text-indigo-600 font-medium focus:outline-none">
              <option value="all">All</option>
              <option value="soma">SOMA</option>
              <option value="mission">Mission</option>
              <option value="castro">Castro</option>
            </select>
          </div>
        </div>

        {/* Units Filter - Toggle Buttons */}
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
          <label className="text-sm font-medium text-gray-700">🏢 Units:</label>
            <button className="px-3 py-1 text-xs rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200">
              1-10
            </button>
            <button className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200">
              11-25
            </button>
            <button className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200">
              26-49
            </button>
            <button className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200">
              50+
            </button>
          </div>
        </div>

        {/* Days Remaining Filter - Slider */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">⏰ Days Left:</label>
          <div className="flex-1">
            <input
              type="range"
              min="1"
              max="5"
              value="3"
              className="custom-slider w-full rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <span className="text-sm font-medium text-indigo-600 w-8">3</span>
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