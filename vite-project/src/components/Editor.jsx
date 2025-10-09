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
    unit_mix: '',
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

  // Populate form with listing data on mount
  useEffect(() => {
    if (listing) {
      const details = listing.details || {};
      
      const initialData = {
        street_address: listing.address?.street_address || '',
        neighborhood: listing.neighborhood || '',
        asking_price: listing.asking_price || '',
        total_units: listing.total_units || '',
        residential_units: listing.residential_units || '',
        vacant_residential: listing.vacant_residential || '',
        commercial_units: listing.commercial_units || '',
        vacant_commercial: listing.vacant_commercial || '',
        is_vacant_lot: listing.is_vacant_lot || false,  // ADD THIS
        location: listing.location ? {
          lat: listing.location.coordinates?.[1],
          lng: listing.location.coordinates?.[0]
        } : null,        
        // Details section - now flat in details
        sender_phone_number: details.sender_phone_number || '',
        soft_story_required: details.soft_story_required,
        unit_mix: details.unit_mix || '',  // ADD THIS
        sqft: details.sqft && details.sqft !== -1 ? details.sqft : '',
        parking_spaces: details.parking_spaces && details.parking_spaces !== -1 ? details.parking_spaces : '',
        // Financial data - now flat in details (not nested)
        grm: details.grm && details.grm !== -1 ? details.grm : '',
        cap_rate: details.cap_rate && details.cap_rate !== -1 ? details.cap_rate : '',
        monthly_income: details.monthly_income && details.monthly_income !== -1 ? details.monthly_income : '',
        total_rents: details.total_rents && details.total_rents !== -1 ? details.total_rents : '',
        other_income: details.other_income && details.other_income !== -1 ? details.other_income : '',
        total_monthly_income: details.total_monthly_income && details.total_monthly_income !== -1 ? details.total_monthly_income : '',
        total_annual_income: details.total_annual_income && details.total_annual_income !== -1 ? details.total_annual_income : '',
        annual_expenses: details.annual_expenses && details.annual_expenses !== -1 ? details.annual_expenses : '',
        less_total_annual_expenses: details.less_total_annual_expenses && details.less_total_annual_expenses !== -1 ? details.less_total_annual_expenses : '',
        net_operating_income: details.net_operating_income && details.net_operating_income !== -1 ? details.net_operating_income : '',
        property_tax_rate: details.property_tax_rate && details.property_tax_rate !== -1 ? details.property_tax_rate : '',
        property_tax_amount: details.property_tax_amount && details.property_tax_amount !== -1 ? details.property_tax_amount : '',
        management_rate: details.management_rate && details.management_rate !== -1 ? details.management_rate : '',
        management_amount: details.management_amount && details.management_amount !== -1 ? details.management_amount : '',
        insurance: details.insurance && details.insurance !== -1 ? details.insurance : '',
        utilities: details.utilities && details.utilities !== -1 ? details.utilities : '',
        maintenance: details.maintenance && details.maintenance !== -1 ? details.maintenance : '',
        other_expenses: details.other_expenses && details.other_expenses !== -1 ? details.other_expenses : '',
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
      if (formData[field]) {
        // Remove commas before checking
        const cleanValue = String(formData[field]).replace(/,/g, '');
        
        if (isNaN(Number(cleanValue))) {
          newErrors[field] = 'Must be a number';
        }
        if (Number(cleanValue) < 0) {
          newErrors[field] = 'Must be positive';
        }
      }
    });
  
    if (formData.total_units && formData.residential_units && formData.commercial_units) {
      const total = Number(String(formData.total_units).replace(/,/g, ''));
      const residential = Number(String(formData.residential_units).replace(/,/g, ''));
      const commercial = Number(String(formData.commercial_units).replace(/,/g, ''));
      
      if (residential + commercial > total) {
        newErrors.total_units = 'Total units must be ≥ residential + commercial';
      }
    }
  
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    
    if (!validateForm()) {
      console.log('🔴 Validation failed, stopping');
      return;
    }
    
    setSaving(true);
    setSaveSuccess(false);

    const cleanNumber = (value) => {
      if (!value) return null;
      return Number(String(value).replace(/,/g, ''));
    };  
  
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
        flagged: formData.flagged,
        asking_price: formData.asking_price ? cleanNumber(formData.asking_price) : null,
        total_units: formData.total_units ? cleanNumber(formData.total_units) : null,
        residential_units: formData.residential_units ? cleanNumber(formData.residential_units) : null,
        vacant_residential: formData.vacant_residential ? cleanNumber(formData.vacant_residential) : null,
        commercial_units: formData.commercial_units ? cleanNumber(formData.commercial_units) : null,
        vacant_commercial: formData.vacant_commercial ? cleanNumber(formData.vacant_commercial) : null,
        is_vacant_lot: formData.is_vacant_lot || false,
        unit_mix: formData.unit_mix || null
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
        sqft: formData.sqft ? cleanNumber(formData.sqft) : null,
        parking_spaces: formData.parking_spaces ? cleanNumber(formData.parking_spaces) : null,
        // Flatten financial data - no more nesting!
        grm: formData.grm ? cleanNumber(formData.grm) : null,
        cap_rate: formData.cap_rate ? cleanNumber(formData.cap_rate) : null,
        monthly_income: formData.monthly_income ? cleanNumber(formData.monthly_income) : null,
        total_rents: formData.total_rents ? cleanNumber(formData.total_rents) : null,
        other_income: formData.other_income ? cleanNumber(formData.other_income) : null,
        total_monthly_income: formData.total_monthly_income ? cleanNumber(formData.total_monthly_income) : null,
        total_annual_income: formData.total_annual_income ? cleanNumber(formData.total_annual_income) : null,
        annual_expenses: formData.annual_expenses ? cleanNumber(formData.annual_expenses) : null,
        less_total_annual_expenses: formData.less_total_annual_expenses ? cleanNumber(formData.less_total_annual_expenses) : null,
        net_operating_income: formData.net_operating_income ? cleanNumber(formData.net_operating_income) : null,
        property_tax_rate: formData.property_tax_rate ? cleanNumber(formData.property_tax_rate) : null,
        property_tax_amount: formData.property_tax_amount ? cleanNumber(formData.property_tax_amount) : null,
        management_rate: formData.management_rate ? cleanNumber(formData.management_rate) : null,
        management_amount: formData.management_amount ? cleanNumber(formData.management_amount) : null,
        insurance: formData.insurance ? cleanNumber(formData.insurance) : null,
        utilities: formData.utilities ? cleanNumber(formData.utilities) : null,
        maintenance: formData.maintenance ? cleanNumber(formData.maintenance) : null,
        other_expenses: formData.other_expenses ? cleanNumber(formData.other_expenses) : null,
        rent_roll: listing.details?.rent_roll || []
      };
  
      console.log('Calling update_listing_with_encryption with:', {
        listing_id_param: listing.id,
        user_id_param: user.id,
        listingData,
        detailsToEncrypt
      });

      console.log('listingData being sent:', JSON.stringify(listingData, null, 2));
      console.log('detailsToEncrypt being sent:', JSON.stringify(detailsToEncrypt, null, 2));

      console.log('FINAL DATA CHECK:', {
        hasUnitMix: 'unit_mix' in listingData,
        unitMixValue: listingData.unit_mix,
        unitMixType: typeof listingData.unit_mix
      });
      
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
    <div className="space-y-2 pr-4 overflow-hidden">
      {saveSuccess && (
        <div className="p-1 bg-green-100 text-green-800 text-xs">
          Changes saved successfully!
        </div>
      )}
  
      {/* All fields in one view */}
      <div className="space-y-0.5">
        {/* Street Address */}
        <div className="flex items-start gap-2">
          <label className="text-xs text-gray-700 w-40 pt-0.5 flex-shrink-0">
            Street Address <span className="text-red-500">*</span>
          </label>
          <div className="flex-1 flex gap-1">
            <input
              type="text"
              name="street_address"
              value={formData.street_address}
              onChange={handleChange}
              className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b focus:outline-none focus:border-indigo-500 ${
                isAutoPopulated('street_address') ? 'text-indigo-700 font-medium' : 'text-gray-900'
              } ${errors.street_address ? 'border-red-500' : 'border-gray-300'}`}
            />
            <button
              type="button"
              onClick={geocodeAddress}
              disabled={geocoding || !formData.street_address.trim()}
              className={`px-1.5 py-0.5 text-xs whitespace-nowrap ${
                geocoding || !formData.street_address.trim()
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              }`}
            >
              {geocoding ? 'Geocoding...' : 'Find'}
            </button>
          </div>
        </div>
        {errors.street_address && (
          <div className="flex">
            <div className="w-40 flex-shrink-0"></div>
            <p className="text-xs text-red-600 flex-1">{errors.street_address}</p>
          </div>
        )}
  
        {/* Neighborhood */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Neighborhood</label>
          <select
            name="neighborhood"
            value={formData.neighborhood}
            onChange={handleChange}
            disabled={loadingNeighborhoods}
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('neighborhood') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`}
          >
            <option value="">Select...</option>
            {neighborhoodOptions.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
  
        {/* Asking Price with Per Unit inline */}
        <div className="flex-1 flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Asking Price</label>
          <input 
            type="text" 
            name="asking_price" 
            value={formData.asking_price} 
            onChange={handleChange} 
            className={`w-32 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('asking_price') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
          <span className="text-xs text-gray-700 whitespace-nowrap">per unit:</span>
          <input 
            type="text" 
            name="asking_price_per_unit" 
            value={formData.asking_price_per_unit} 
            onChange={handleChange} 
            className={`w-32 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('asking_price_per_unit') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Total Units</label>
          <input type="text" name="total_units" value={formData.total_units} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('total_units') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
        
        {/* Residential Units with Vacant inline */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Residential Units</label>
          <input 
            type="text" 
            name="residential_units" 
            value={formData.residential_units} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('residential_units') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
          <span className="text-xs text-gray-700 whitespace-nowrap">vacant:</span>
          <input 
            type="text" 
            name="vacant_residential" 
            value={formData.vacant_residential} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('vacant_residential') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
        </div>
        
        {/* Commercial Units with Vacant inline */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Commercial Units</label>
          <input 
            type="text" 
            name="commercial_units" 
            value={formData.commercial_units} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('commercial_units') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
          <span className="text-xs text-gray-700 whitespace-nowrap">vacant:</span>
          <input 
            type="text" 
            name="vacant_commercial" 
            value={formData.vacant_commercial} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('vacant_commercial') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
        </div>
  
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Unit Mix</label>
          <input type="text" name="unit_mix" value={formData.unit_mix} onChange={handleChange} placeholder="e.g., (4) 2BR/1BA, (2) 1BR/1BA" className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('unit_mix') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
  
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Average Rent</label>
          <input type="text" name="average_rent" value={formData.average_rent} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('average_rent') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
          

        {/* GRM and Cap Rate on one line */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Cap Rate</label>
          <input 
            type="text" 
            name="cap_rate" 
            value={formData.cap_rate} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('cap_rate') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
          <span className="text-xs text-gray-700 whitespace-nowrap">GRM</span>
          <input 
            type="text" 
            name="grm" 
            value={formData.grm} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('grm') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
        </div>
  
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Square Footage</label>
          <input type="text" name="sqft" value={formData.sqft} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('sqft') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Soft Story Required</label>
          <input type="checkbox" name="soft_story_required" checked={formData.soft_story_required || false} onChange={handleCheckboxChange} className="border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3" />
        </div>
  
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Vacant Lot</label>
          <input type="checkbox" name="is_vacant_lot" checked={formData.is_vacant_lot || false} onChange={handleCheckboxChange} className="border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3" />
        </div>

          
        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-200">
          <label className="font-bold text-xs text-gray-700 w-40 flex-shrink-0">Total Annual Income</label>
          <input type="text" name="total_annual_income" value={formData.total_annual_income} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('total_annual_income') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Total Rents</label>
          <input type="text" name="total_rents" value={formData.total_rents} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('total_rents') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Other Income</label>
          <input type="text" name="other_income" value={formData.other_income} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('other_income') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Total Monthly</label>
          <input type="text" name="total_monthly_income" value={formData.total_monthly_income} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('total_monthly_income') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
          
        {/* Annual Expenses with Per Unit inline */}
        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-200">
          <label className="font-bold text-xs text-gray-700 w-40 flex-shrink-0">Total Annual Expenses</label>
          <input 
            type="text" 
            name="annual_expenses" 
            value={formData.annual_expenses} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('annual_expenses') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
          <span className="text-xs text-gray-700 whitespace-nowrap">per unit:</span>
          <input 
            type="text" 
            name="annual_expenses_per_unit" 
            value={formData.annual_expenses_per_unit} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('annual_expenses_per_unit') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
        </div>
                        
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Management</label>
          <input type="text" name="management_amount" value={formData.management_amount} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('management_amount') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Insurance</label>
          <input type="text" name="insurance" value={formData.insurance} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('insurance') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Utilities</label>
          <input type="text" name="utilities" value={formData.utilities} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('utilities') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Maintenance</label>
          <input type="text" name="maintenance" value={formData.maintenance} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('maintenance') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-700 w-40 flex-shrink-0">Other</label>
          <input type="text" name="other_expenses" value={formData.other_expenses} onChange={handleChange} className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${isAutoPopulated('other_expenses') ? 'text-indigo-700 font-medium' : 'text-gray-900'}`} />
        </div>

        {/* Annual Expenses with Per Unit inline */}
        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-200">
          <label className="font-bold text-xs text-gray-700 w-40 flex-shrink-0">Net Operating Income</label>
          <input 
            type="text" 
            name="net_operating_income" 
            value={formData.annual_expenses} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('net_operating_income') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
          <span className="text-xs text-gray-700 whitespace-nowrap">per unit:</span>
          <input 
            type="text" 
            name="annual_expenses_per_unit" 
            value={formData.annual_expenses_per_unit} 
            onChange={handleChange} 
            className={`flex-1 px-1 py-0.5 text-xs bg-blue-50 border-0 border-b border-gray-300 focus:outline-none focus:border-indigo-500 ${
              isAutoPopulated('annual_expenses_per_unit') ? 'text-indigo-700 font-medium' : 'text-gray-900'
            }`} 
          />
        </div>
        
                        
  
      {/* Action Buttons */}
      <div className="flex gap-2 pt-1.5 border-t mt-2">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={`flex-1 px-2 py-0.5 text-xs ${
            saving || !isDirty
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={saving || !isDirty}
          className={`px-2 py-0.5 text-xs ${
            saving || !isDirty
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Cancel
        </button>
      </div>
    </div>
    </div>
  );
}