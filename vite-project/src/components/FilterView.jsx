import './FilterView.css'

export default function FilterView({ filter, setFilter, numFlagged }) {

  return (
    <div>
      <div className="p-4 border-b bg-white">
      {/* Review flagged listings button */}
      <button 
        onClick={() => setFilter({...filter, flagged: !filter.flagged})}
        className="mb-4 w-full px-3 py-2 bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
        {filter.flagged ? 'View listings with addresses' : 'Review flagged listings'} ({numFlagged})
      </button>
      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search properties..."
          value={filter.searchQuery}
          onChange={(e) => setFilter({...filter, searchQuery: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Filters Section */}
      <div className="space-y-3">
        {/* Neighborhood Filter */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">📍 Neighborhoods:</span>
            <span className="text-sm text-gray-700">
              {filter.neighborhoods.length > 0 ? (
                `${filter.neighborhoods.length} selected`
              ) : (
                <i className="text-gray-500 bg-gray-100 px-2 py-1 rounded-md">click map to filter</i>
              )}
            </span>
            <button 
              onClick={() => setFilter({...filter, neighborhoods: []})} 
              className={`px-3 py-1 text-xs rounded-full border transition-opacity ${
                filter.neighborhoods.length > 0 
                  ? 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 opacity-100' 
                  : 'opacity-0 pointer-events-none'
              }`}
            > 
              Show all 
            </button>
          </div>
        </div>


        {/* Units Filter - Toggle Buttons */}
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
          <label className="text-sm font-medium text-gray-700">🏢 Units:</label>
            <button onClick={() => setFilter({ ...filter, units: 1 })}
                    className={`px-3 py-1 text-xs rounded-full border hover:bg-opacity-80 ${
                      filter.units === 1 
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}>
              1-10
            </button>
            <button onClick={() => setFilter({ ...filter, units: 2 })}
                    className={`px-3 py-1 text-xs rounded-full border hover:bg-opacity-80 ${
                      filter.units === 2 
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
              >
              11-25
            </button>
            <button onClick={() => setFilter({ ...filter, units: 3 })}
                    className={`px-3 py-1 text-xs rounded-full border hover:bg-opacity-80 ${
                      filter.units === 3 
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
                    >
              26-49
            </button>
            <button onClick={() => setFilter({ ...filter, units: 4 })}
                    className={`px-3 py-1 text-xs rounded-full border hover:bg-opacity-80 ${
                      filter.units === 4 
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
              >
              50+
            </button>
          </div>
        </div>

      {/* Show Active/Show All Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="showActive"
          checked={filter.showActive}
          onChange={(e) => setFilter({...filter, showActive: e.target.checked})}
          className="rounded"
        />
        <label htmlFor="showExpired" className="text-sm font-medium text-gray-700">
          Only show active listings
        </label>
      </div>

        {/* Days Remaining Filter - Slider */}
        {filter.showActive && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">⏰ Days Left (Minimum):</label>
            <div className="flex-1">
              <input
                type="range"
                min="1"
                max="5"
                value={filter.daysLeft}
                onChange={(e) => setFilter({...filter, daysLeft: Number(e.target.value)})}
                className="custom-slider w-full rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <span className="text-sm font-medium text-indigo-600 w-8">{filter.daysLeft}</span>
          </div>
        )}
      </div>

      {/* Clear Filters */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <button className="text-sm text-gray-500 hover:text-gray-700"
          onClick={() => setFilter({
            neighborhoods: [],
            units: null,
            daysLeft: 1,
            showActive: false
          })}
        >
          Reset all filters
        </button>
      </div>
    </div>
  </div>
    )
}