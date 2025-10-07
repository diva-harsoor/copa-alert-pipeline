import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Editor({ listing }) {
  const [formData, setFormData] = useState({
    street_address: '',
    neighborhood: '',
    asking_price: '',
    total_units: '',
    residential_units: '',
    vacant_residential: '',
    commercial_units: '',
    vacant_commercial: ''
  });
  
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [neighborhoodOptions, setNeighborhoodOptions] = useState([]);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);

  // Populate form with listing data on mount
  useEffect(() => {
    if (listing) {
      const initialData = {
        street_address: listing.address?.street_address || '',
        neighborhood: listing.neighborhood || '',
        asking_price: listing.asking_price || '',
        total_units: listing.total_units || '',
        residential_units: listing.residential_units || '',
        vacant_residential: listing.vacant_residential || '',
        commercial_units: listing.commercial_units || '',
        vacant_commercial: listing.vacant_commercial || ''
      };
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [listing]);

  useEffect(() => {
    async function loadNeighborhoodOptions() {
      setLoadingNeighborhoods(true);
      try {
        const { data, error } = await supabase
          .from('sf_neighborhoods')
          .select('name')
          .order('name');
        
        if (error) {
          console.error('Error loading neighborhoods:', error);
        } else {
          setNeighborhoodOptions(data.map(n => n.name));
        }
      } catch (error) {
        console.error('Error loading neighborhoods:', error);
      } finally {
        setLoadingNeighborhoods(false);
      }
    }
    
    loadNeighborhoodOptions();
  }, []);
  

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const geocodeAddress = async () => {
    if (!formData.street_address.trim()) {
      alert('Please enter a street address first');
      return;
    }
  
    setGeocoding(true);
    
    try {
      // Step 1: Geocode the address to get coordinates
      const addressString = `${formData.street_address}, San Francisco, CA`;
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
          q: addressString,
          format: 'json',
          limit: 1,
          countrycodes: 'us'
        })}`,
        {
          headers: {
            'User-Agent': 'SF-COPA-Dashboard/1.0'
          }
        }
      );
      
      const geocodeData = await geocodeResponse.json();
      
      if (!geocodeData || geocodeData.length === 0) {
        alert('Address not found. Please check the address.');
        setGeocoding(false);
        return;
      }
  
      const result = geocodeData[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      
      console.log(`Geocoded to coordinates: ${lat}, ${lng}`);
  
      // Step 2: Call Supabase function to get neighborhood
      const { data, error } = await supabase.rpc('get_neighborhood_from_coords', {
        lat: lat,
        lng: lng
      });
  
      if (error) {
        console.error('Error getting neighborhood:', error);
        alert('Could not determine neighborhood. Please enter manually.');
        setGeocoding(false);
        return;
      }
  
      if (data) {
        setFormData(prev => ({ ...prev, neighborhood: data }));
        console.log(`Found neighborhood: ${data}`);
      } else {
        alert('Address is not in a recognized San Francisco neighborhood. Please enter manually.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Geocoding failed. Please enter neighborhood manually.');
    } finally {
      setGeocoding(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.street_address.trim()) {
      newErrors.street_address = 'Address is required';
    }

    // Numeric validations
    const numericFields = [
      'asking_price', 
      'total_units', 
      'residential_units', 
      'vacant_residential', 
      'commercial_units', 
      'vacant_commercial'
    ];

    numericFields.forEach(field => {
      if (formData[field] && isNaN(Number(formData[field]))) {
        newErrors[field] = 'Must be a number';
      }
      if (formData[field] && Number(formData[field]) < 0) {
        newErrors[field] = 'Must be positive';
      }
    });

    // Business logic: residential + commercial should not exceed total
    if (formData.total_units && formData.residential_units && formData.commercial_units) {
      const total = Number(formData.total_units);
      const residential = Number(formData.residential_units);
      const commercial = Number(formData.commercial_units);
      
      if (residential + commercial > total) {
        newErrors.total_units = 'Total units must be ≥ residential + commercial';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      // Prepare update data - only include fields that exist in your schema
      const updateData = {
        address: {
          street_address: formData.street_address
        },
        neighborhood: formData.neighborhood,
        asking_price: formData.asking_price ? Number(formData.asking_price) : null,
        total_units: formData.total_units ? Number(formData.total_units) : null,
        residential_units: formData.residential_units ? Number(formData.residential_units) : null,
        vacant_residential: formData.vacant_residential ? Number(formData.vacant_residential) : null,
        commercial_units: formData.commercial_units ? Number(formData.commercial_units) : null,
        vacant_commercial: formData.vacant_commercial ? Number(formData.vacant_commercial) : null
      };

      const { error } = await supabase
        .from('copa_listings_new')
        .update(updateData)
        .eq('id', listing.id);

      if (error) {
        console.error('Error saving listing:', error);
        alert('Failed to save changes: ' + error.message);
      } else {
        setSaveSuccess(true);
        setOriginalData(formData); // Update original data to match saved data
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);

        // Trigger parent to refresh listing data
        window.dispatchEvent(new CustomEvent('listingUpdated'));
      }
    } catch (error) {
      console.error('Error saving listing:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original data
    setFormData(originalData);
    setErrors({});
    setSaveSuccess(false);
  };

  const isDirty = JSON.stringify(formData) !== JSON.stringify(originalData);

  // Check if field was auto-populated (exists in original listing)
  const isAutoPopulated = (fieldName) => {
    if (fieldName === 'street_address') {
      return listing?.address?.street_address;
    }
    return listing && listing[fieldName];
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {saveSuccess && (
        <div className="p-3 bg-green-100 border border-green-300 text-green-800 rounded text-sm">
          Changes saved successfully!
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Street Address */}
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
            <input
                type="text"
                name="street_address"
                value={formData.street_address}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isAutoPopulated('street_address') ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'
                } ${errors.street_address ? 'border-red-500' : ''}`}
            />
            <button
                type="button"
                onClick={geocodeAddress}
                disabled={geocoding || !formData.street_address.trim()}
                className={`px-4 py-2 rounded font-medium whitespace-nowrap ${
                geocoding || !formData.street_address.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                }`}
            >
                {geocoding ? 'Geocoding...' : 'Find Neighborhood'}
            </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">Click "Find Neighborhood" to auto-fill neighborhood from address</p> 
    </div>

        {errors.street_address && (
            <p className="mt-1 text-sm text-red-600">{errors.street_address}</p>
          )}


        {/* Neighborhood */}
        <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            Neighborhood
        </label>
        <div className="flex gap-2">
            <select
            name="neighborhood"
            value={formData.neighborhood}
            onChange={handleChange}
            disabled={loadingNeighborhoods}
            className={`flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isAutoPopulated('neighborhood') ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'
            }`}
            >
            <option value="">Select a neighborhood...</option>
            {neighborhoodOptions.map(name => (
                <option key={name} value={name}>
                {name}
                </option>
            ))}
            </select>
        </div>
        <p className="mt-1 text-xs text-gray-500">Select manually or click "Geocode" to auto-fill from address</p>
        </div>


        {/* Total Units */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Total Units
          </label>
          <input
            type="number"
            name="total_units"
            value={formData.total_units}
            onChange={handleChange}
            min="0"
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isAutoPopulated('total_units') ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'
            } ${errors.total_units ? 'border-red-500' : ''}`}
          />
          {errors.total_units && (
            <p className="mt-1 text-sm text-red-600">{errors.total_units}</p>
          )}
        </div>

        {/* Residential Units */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Residential Units
          </label>
          <input
            type="number"
            name="residential_units"
            value={formData.residential_units}
            onChange={handleChange}
            min="0"
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isAutoPopulated('residential_units') ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'
            } ${errors.residential_units ? 'border-red-500' : ''}`}
          />
          {errors.residential_units && (
            <p className="mt-1 text-sm text-red-600">{errors.residential_units}</p>
          )}
        </div>

        {/* Vacant Residential */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vacant Residential
          </label>
          <input
            type="number"
            name="vacant_residential"
            value={formData.vacant_residential}
            onChange={handleChange}
            min="0"
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isAutoPopulated('vacant_residential') ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'
            } ${errors.vacant_residential ? 'border-red-500' : ''}`}
          />
          {errors.vacant_residential && (
            <p className="mt-1 text-sm text-red-600">{errors.vacant_residential}</p>
          )}
        </div>

        {/* Commercial Units */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commercial Units
          </label>
          <input
            type="number"
            name="commercial_units"
            value={formData.commercial_units}
            onChange={handleChange}
            min="0"
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isAutoPopulated('commercial_units') ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'
            } ${errors.commercial_units ? 'border-red-500' : ''}`}
          />
          {errors.commercial_units && (
            <p className="mt-1 text-sm text-red-600">{errors.commercial_units}</p>
          )}
        </div>

        {/* Vacant Commercial */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vacant Commercial
          </label>
          <input
            type="number"
            name="vacant_commercial"
            value={formData.vacant_commercial}
            onChange={handleChange}
            min="0"
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              isAutoPopulated('vacant_commercial') ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'
            } ${errors.vacant_commercial ? 'border-red-500' : ''}`}
          />
          {errors.vacant_commercial && (
            <p className="mt-1 text-sm text-red-600">{errors.vacant_commercial}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={`flex-1 px-4 py-2 rounded font-medium ${
            saving || !isDirty
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving || !isDirty}
          className={`px-4 py-2 rounded font-medium ${
            saving || !isDirty
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Cancel
        </button>
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-500 pt-2 border-t">
        <span className="inline-block px-2 py-1 bg-blue-50 border border-blue-200 rounded mr-2">Blue background</span>
        = Auto-populated from email
      </div>
    </div>
  );
}