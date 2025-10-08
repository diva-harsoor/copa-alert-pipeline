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
    vacant_commercial: '',
    // Details section
    sender_phone_number: '',
    soft_story_required: null,
    sqft: '',
    parking_spaces: '',
    // Financial data
    grm: '',
    cap_rate: '',
    monthly_income: '',
    total_rents: '',
    other_income: '',
    total_monthly_income: '',
    total_annual_income: '',
    annual_expenses: '',
    less_total_annual_expenses: '',
    net_operating_income: '',
    property_tax_rate: '',
    property_tax_amount: '',
    management_rate: '',
    management_amount: '',
    insurance: '',
    utilities: '',
    maintenance: '',
    other_expenses: '',
  });
  
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [neighborhoodOptions, setNeighborhoodOptions] = useState([]);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Populate form with listing data on mount
  useEffect(() => {
    if (listing) {
      const details = listing.details || {};
      const financialData = details.financial_data || {};
      
      const initialData = {
        street_address: listing.address?.street_address || '',
        neighborhood: listing.neighborhood || '',
        asking_price: listing.asking_price || '',
        total_units: listing.total_units || '',
        residential_units: listing.residential_units || '',
        vacant_residential: listing.vacant_residential || '',
        commercial_units: listing.commercial_units || '',
        vacant_commercial: listing.vacant_commercial || '',
        location: listing.location ? {
          lat: listing.location.coordinates?.[1],
          lng: listing.location.coordinates?.[0]
        } : null,        
        // Details section
        sender_phone_number: details.sender_phone_number || '',
        soft_story_required: details.soft_story_required,
        sqft: details.sqft && details.sqft !== -1 ? details.sqft : '',
        parking_spaces: details.parking_spaces && details.parking_spaces !== -1 ? details.parking_spaces : '',
        // Financial data
        grm: financialData.grm && financialData.grm !== -1 ? financialData.grm : '',
        cap_rate: financialData.cap_rate && financialData.cap_rate !== -1 ? financialData.cap_rate : '',
        monthly_income: financialData.monthly_income && financialData.monthly_income !== -1 ? financialData.monthly_income : '',
        total_rents: financialData.total_rents && financialData.total_rents !== -1 ? financialData.total_rents : '',
        other_income: financialData.other_income && financialData.other_income !== -1 ? financialData.other_income : '',
        total_monthly_income: financialData.total_monthly_income && financialData.total_monthly_income !== -1 ? financialData.total_monthly_income : '',
        total_annual_income: financialData.total_annual_income && financialData.total_annual_income !== -1 ? financialData.total_annual_income : '',
        annual_expenses: financialData.annual_expenses && financialData.annual_expenses !== -1 ? financialData.annual_expenses : '',
        less_total_annual_expenses: financialData.less_total_annual_expenses && financialData.less_total_annual_expenses !== -1 ? financialData.less_total_annual_expenses : '',
        net_operating_income: financialData.net_operating_income && financialData.net_operating_income !== -1 ? financialData.net_operating_income : '',
        property_tax_rate: financialData.property_tax_rate && financialData.property_tax_rate !== -1 ? financialData.property_tax_rate : '',
        property_tax_amount: financialData.property_tax_amount && financialData.property_tax_amount !== -1 ? financialData.property_tax_amount : '',
        management_rate: financialData.management_rate && financialData.management_rate !== -1 ? financialData.management_rate : '',
        management_amount: financialData.management_amount && financialData.management_amount !== -1 ? financialData.management_amount : '',
        insurance: financialData.insurance && financialData.insurance !== -1 ? financialData.insurance : '',
        utilities: financialData.utilities && financialData.utilities !== -1 ? financialData.utilities : '',
        maintenance: financialData.maintenance && financialData.maintenance !== -1 ? financialData.maintenance : '',
        other_expenses: financialData.other_expenses && financialData.other_expenses !== -1 ? financialData.other_expenses : '',
        flagged: listing.flagged || false
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

  useEffect(() => {
    console.log('formData CHANGED:', formData);
  }, [formData]);  

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const geocodeAddress = async () => {
    if (!formData.street_address.trim()) {
      alert('Please enter a street address first');
      return;
    }
  
    setGeocoding(true);
    
    try {
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
  
      const { data, error } = await supabase.rpc('get_neighborhood_from_coords', {
        lat: lat,
        lng: lng
      });
  
      if (error) {
        console.error('Error getting neighborhood:', error);
        alert('Could not determine neighborhood. Please check that you are entering just one address and check that it is in San Francisco.');
        setGeocoding(false);
        return;
      }
  
      if (data) {
        console.log('BEFORE UPDATE - formData:', formData); // ADD THIS
        console.log('UPDATE VALUES:', { 
          location: { lat, lng }, 
          neighborhood: data, 
          flagged: false 
        }); // ADD THIS
        
        setFormData(prev => {
          console.log('PREV STATE:', prev); // ADD THIS
          const newState = { 
            ...prev, 
            location: { lat: lat, lng: lng }, 
            neighborhood: data,
            flagged: false
          };
          console.log('NEW STATE:', newState); // ADD THIS
          return newState;
        });
        
        console.log(`Found neighborhood: ${data}`);
      } else {
        alert('Could not determine neighborhood. Please check that you are entering just one address and check that it is in San Francisco.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Could not determine neighborhood. Please check that you are entering just one address and check that it is in San Francisco.');
    } finally {
      setGeocoding(false);
    }
  };
  

  const validateForm = () => {
    const newErrors = {};

    if (!formData.street_address.trim()) {
      newErrors.street_address = 'Address is required';
    }

    const numericFields = [
      'asking_price', 'total_units', 'residential_units', 'vacant_residential', 
      'commercial_units', 'vacant_commercial', 'sqft', 'parking_spaces',
      'grm', 'cap_rate', 'monthly_income', 'total_rents', 'other_income',
      'total_monthly_income', 'total_annual_income', 'annual_expenses',
      'less_total_annual_expenses', 'net_operating_income', 'property_tax_rate',
      'property_tax_amount', 'management_rate', 'management_amount', 'insurance',
      'utilities', 'maintenance', 'other_expenses'
    ];

    numericFields.forEach(field => {
      if (formData[field] && isNaN(Number(formData[field]))) {
        newErrors[field] = 'Must be a number';
      }
      if (formData[field] && Number(formData[field]) < 0) {
        newErrors[field] = 'Must be positive';
      }
    });

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
    if (!validateForm()) {
      return;
    }
  
    setSaving(true);
    setSaveSuccess(false);
  
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('User not authenticated');
        setSaving(false);
        return;
      }
  
      const listingData = {
        address: {
          street_address: formData.street_address
        },
        neighborhood: formData.neighborhood,
        flagged: formData.flagged,  // Add this line
        asking_price: formData.asking_price ? Number(formData.asking_price) : null,
        total_units: formData.total_units ? Number(formData.total_units) : null,
        residential_units: formData.residential_units ? Number(formData.residential_units) : null,
        vacant_residential: formData.vacant_residential ? Number(formData.vacant_residential) : null,
        commercial_units: formData.commercial_units ? Number(formData.commercial_units) : null,
        vacant_commercial: formData.vacant_commercial ? Number(formData.vacant_commercial) : null
      };

      if (formData.location && formData.location.lat && formData.location.lng) {
        listingData.location = {
          type: 'Point',
          coordinates: [formData.location.lng, formData.location.lat]
        };
      }  
  
      const detailsToEncrypt = {
        sender_phone_number: formData.sender_phone_number || null,
        soft_story_required: formData.soft_story_required,
        sqft: formData.sqft ? Number(formData.sqft) : -1,
        parking_spaces: formData.parking_spaces ? Number(formData.parking_spaces) : -1,
        financial_data: {
          grm: formData.grm ? Number(formData.grm) : -1,
          cap_rate: formData.cap_rate ? Number(formData.cap_rate) : -1,
          monthly_income: formData.monthly_income ? Number(formData.monthly_income) : -1,
          total_rents: formData.total_rents ? Number(formData.total_rents) : -1,
          other_income: formData.other_income ? Number(formData.other_income) : -1,
          total_monthly_income: formData.total_monthly_income ? Number(formData.total_monthly_income) : -1,
          total_annual_income: formData.total_annual_income ? Number(formData.total_annual_income) : -1,
          annual_expenses: formData.annual_expenses ? Number(formData.annual_expenses) : -1,
          less_total_annual_expenses: formData.less_total_annual_expenses ? Number(formData.less_total_annual_expenses) : -1,
          net_operating_income: formData.net_operating_income ? Number(formData.net_operating_income) : -1,
          property_tax_rate: formData.property_tax_rate ? Number(formData.property_tax_rate) : -1,
          property_tax_amount: formData.property_tax_amount ? Number(formData.property_tax_amount) : -1,
          management_rate: formData.management_rate ? Number(formData.management_rate) : -1,
          management_amount: formData.management_amount ? Number(formData.management_amount) : -1,
          insurance: formData.insurance ? Number(formData.insurance) : -1,
          utilities: formData.utilities ? Number(formData.utilities) : -1,
          maintenance: formData.maintenance ? Number(formData.maintenance) : -1,
          other_expenses: formData.other_expenses ? Number(formData.other_expenses) : -1
        },
        rent_roll: listing.details?.rent_roll || []
      };
  
      console.log('Calling update_listing_with_encryption with:', {
        listing_id_param: listing.id,
        user_id_param: user.id,
        listingData,
        detailsToEncrypt
      });

      console.log('formData.location:', formData.location);
      console.log('formData.flagged:', formData.flagged);
      console.log('listingData.location:', listingData.location);
      console.log('listingData.flagged:', listingData.flagged);
  
      const { error } = await supabase.rpc('update_listing_with_encryption', {
        listing_id_param: listing.id,
        user_id_param: user.id,
        listing_data: listingData,
        details_to_encrypt: detailsToEncrypt,
        last_updated_at: listing.updated_at
      });
  
      if (error) {
        console.error('Error saving listing:', error);
        alert('Failed to save changes: ' + error.message);
        if (error.message.includes('modified by another user')) {
          alert('This listing has been modified by another user. Your changes were not saved. Please refresh the page to see the latest version.');
        }
      } else {
        console.log('Save successful!');
        console.log('listing id:', listing.id);
        setSaveSuccess(true);
        setOriginalData(formData);
        
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
  
        window.dispatchEvent(new CustomEvent('listingUpdated'));
      }
    } catch (error) {
      console.error('Error saving listing:', error);
      alert('Failed to save changes: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(originalData);
    setErrors({});
    setSaveSuccess(false);
  };

  const isDirty = JSON.stringify(formData) !== JSON.stringify(originalData);

  const isAutoPopulated = (fieldName) => {
    if (fieldName === 'street_address') {
      return listing?.address?.street_address;
    }
    if (['sender_phone_number', 'soft_story_required', 'sqft', 'parking_spaces'].includes(fieldName)) {
      return listing?.details?.[fieldName];
    }
    if (['grm', 'cap_rate', 'monthly_income', 'total_rents', 'other_income', 'total_monthly_income', 
         'total_annual_income', 'annual_expenses', 'less_total_annual_expenses', 'net_operating_income',
         'property_tax_rate', 'property_tax_amount', 'management_rate', 'management_amount',
         'insurance', 'utilities', 'maintenance', 'other_expenses'].includes(fieldName)) {
      return listing?.details?.financial_data?.[fieldName];
    }
    return listing && listing[fieldName];
  };

  const renderInput = (name, label, required = false, type = "number") => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={formData[name]}
        onChange={handleChange}
        min={type === "number" ? "0" : undefined}
        step={type === "number" && ['cap_rate', 'property_tax_rate', 'management_rate'].includes(name) ? "0.01" : undefined}
        className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          isAutoPopulated(name) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'
        } ${errors[name] ? 'border-red-500' : ''}`}
      />
      {errors[name] && (
        <p className="mt-1 text-sm text-red-600">{errors[name]}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {saveSuccess && (
        <div className="p-3 bg-green-100 border border-green-300 text-green-800 rounded text-sm">
          Changes saved successfully!
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('basic')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'basic'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Basic Info
          </button>
          <button
            onClick={() => setActiveTab('property')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'property'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Property Details
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'financial'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Financial Data
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'basic' && (
          <>
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
              {errors.street_address && (
                <p className="mt-1 text-sm text-red-600">{errors.street_address}</p>
              )}
            </div>

            {/* Neighborhood */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Neighborhood</label>
              <select
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleChange}
                disabled={loadingNeighborhoods}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isAutoPopulated('neighborhood') ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-300'
                }`}
              >
                <option value="">Select a neighborhood...</option>
                {neighborhoodOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Select manually or click "Find Neighborhood" to auto-fill from address</p>
            </div>

            {/* Asking Price */}
            {renderInput('asking_price', 'Asking Price')}
            
            {/* Total Units */}
            {renderInput('total_units', 'Total Units')}
            
            {/* Residential Units */}
            {renderInput('residential_units', 'Residential Units')}
            
            {/* Vacant Residential */}
            {renderInput('vacant_residential', 'Vacant Residential')}
            
            {/* Commercial Units */}
            {renderInput('commercial_units', 'Commercial Units')}
            
            {/* Vacant Commercial */}
            {renderInput('vacant_commercial', 'Vacant Commercial')}
          </>
        )}

        {activeTab === 'property' && (
          <>
            {/* Sender Phone Number */}
            {renderInput('sender_phone_number', 'Sender Phone Number', false, 'tel')}
            
            {/* Soft Story Required */}
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="soft_story_required"
                  checked={formData.soft_story_required || false}
                  onChange={handleCheckboxChange}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Soft Story Required</span>
              </label>
            </div>

            {/* Square Footage */}
            {renderInput('sqft', 'Square Footage')}
            
            {/* Parking Spaces */}
            {renderInput('parking_spaces', 'Parking Spaces')}
          </>
        )}

        {activeTab === 'financial' && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 pt-2">Income</h3>
            {renderInput('monthly_income', 'Monthly Income')}
            {renderInput('total_rents', 'Total Rents')}
            {renderInput('other_income', 'Other Income')}
            {renderInput('total_monthly_income', 'Total Monthly Income')}
            {renderInput('total_annual_income', 'Total Annual Income')}

            <h3 className="text-lg font-semibold text-gray-900 pt-4">Expenses</h3>
            {renderInput('annual_expenses', 'Annual Expenses')}
            {renderInput('less_total_annual_expenses', 'Less Total Annual Expenses')}
            {renderInput('property_tax_amount', 'Property Tax Amount')}
            {renderInput('management_amount', 'Management Amount')}
            {renderInput('insurance', 'Insurance')}
            {renderInput('utilities', 'Utilities')}
            {renderInput('maintenance', 'Maintenance')}
            {renderInput('other_expenses', 'Other Expenses')}

            <h3 className="text-lg font-semibold text-gray-900 pt-4">Metrics</h3>
            {renderInput('grm', 'GRM (Gross Rent Multiplier)')}
            {renderInput('cap_rate', 'Cap Rate (%)')}
            {renderInput('net_operating_income', 'Net Operating Income (NOI)')}
            {renderInput('property_tax_rate', 'Property Tax Rate (%)')}
            {renderInput('management_rate', 'Management Rate (%)')}
          </>
        )}
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
        <span className="inline-block px-2 py-1 bg-blue-50 border-blue-200 rounded mr-2">Blue background</span>
        = Auto-populated from email
      </div>
    </div>
  );
}