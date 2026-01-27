import React, { useEffect, useRef } from 'react';
import { Input } from './ui/input';

// Parse Google Places address components for Australian addresses
const parseAddressComponents = (addressComponents) => {
  const result = {
    street_address: '',
    suburb: '',
    state: '',
    postcode: ''
  };

  let streetNumber = '';
  let route = '';

  addressComponents.forEach(component => {
    const types = component.types;
    
    if (types.includes('street_number')) {
      streetNumber = component.long_name;
    }
    if (types.includes('route')) {
      route = component.long_name;
    }
    if (types.includes('locality')) {
      result.suburb = component.long_name;
    }
    // Sydney suburbs sometimes use sublocality_level_1
    if (types.includes('sublocality_level_1') && !result.suburb) {
      result.suburb = component.long_name;
    }
    if (types.includes('administrative_area_level_1')) {
      result.state = component.short_name; // NSW, VIC, QLD, etc.
    }
    if (types.includes('postal_code')) {
      result.postcode = component.long_name;
    }
  });

  // Construct street address
  if (streetNumber && route) {
    result.street_address = `${streetNumber} ${route}`;
  } else if (route) {
    result.street_address = route;
  }

  return result;
};

export function AddressAutocomplete({ 
  value, 
  onChange, 
  onAddressSelect,
  placeholder = "Start typing address...",
  ...props 
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    // Load Google Maps script if not already loaded
    if (!window.google && !document.querySelector('#google-maps-script')) {
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_PLACES_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initAutocomplete;
      document.head.appendChild(script);
    } else if (window.google) {
      initAutocomplete();
    }
  }, []);

  const initAutocomplete = () => {
    if (!inputRef.current || !window.google) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'au' },
      fields: ['address_components', 'formatted_address']
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      
      if (place && place.address_components) {
        const parsed = parseAddressComponents(place.address_components);
        
        // Update the input value with formatted address
        if (onChange) {
          onChange(place.formatted_address || '');
        }
        
        // Callback with parsed components
        if (onAddressSelect) {
          onAddressSelect(parsed);
        }
      }
    });
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      {...props}
    />
  );
}

export default AddressAutocomplete;
