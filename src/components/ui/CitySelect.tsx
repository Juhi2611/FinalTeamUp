import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Check, ChevronDown } from 'lucide-react';
import { CityData, searchCities, getCityById, normalizeCityString } from '../../utils/cityData';

interface CitySelectProps {
  value: string; // This could be a cityId OR a raw string for backwards compat
  onChange: (cityId: string, displayName: string) => void;
  className?: string;
  placeholder?: string;
  error?: boolean;
}

const CitySelect: React.FC<CitySelectProps> = ({ 
  value, 
  onChange, 
  className = '', 
  placeholder = 'Select a city in India',
  error = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<CityData[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize selectedCity based on value
  useEffect(() => {
    if (!value) {
      setSelectedCity(null);
      return;
    }

    // Is it a valid ID?
    let city = getCityById(value);
    
    // Fallback normalization if it's an old raw string
    if (!city) {
      city = normalizeCityString(value);
    }
    
    // Support custom string if normalizeCityString returns null
    if (!city && value) {
      city = { id: value, name: value, state: '', country: '', displayName: value };
    }
    
    setSelectedCity(city);
  }, [value]);

  // Handle open/close click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search query updates
  useEffect(() => {
    if (isOpen) {
      setResults(searchCities(searchQuery));
    }
  }, [searchQuery, isOpen]);

  const handleSelect = (city: CityData | { id: string; name: string; state: string; country: string; displayName: string }) => {
    setSelectedCity(city as CityData);
    setSearchQuery('');
    setIsOpen(false);
    onChange(city.id, city.displayName);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div 
        className={`input-field flex items-center cursor-pointer min-h-[42px] ${error ? 'border-destructive' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
      >
        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <div className="flex-1 text-sm text-foreground truncate">
          {selectedCity ? selectedCity.displayName : placeholder}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="p-3 border-b border-border flex items-center bg-secondary/30">
            <Search className="w-4 h-4 text-muted-foreground mr-2" />
            <input
              type="text"
              placeholder="Search cities..."
              className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  if (results.length > 0) {
                    handleSelect(results[0]);
                  } else {
                    handleSelect({ 
                      id: searchQuery.trim(), 
                      name: searchQuery.trim(), 
                      state: '', 
                      country: '', 
                      displayName: searchQuery.trim() 
                    });
                  }
                }
              }}
              autoFocus
            />
          </div>
          
          <div className="max-h-60 overflow-y-auto w-full custom-scrollbar">
            {searchQuery.trim().length === 0 && (
              <div className="p-2 border-b border-border">
                <div
                  onClick={() => {
                    setSelectedCity(null);
                    setIsOpen(false);
                    onChange('', 'All Cities');
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer flex justify-between items-center"
                >
                  <span className="block font-medium text-sm">All Cities</span>
                  {!selectedCity && <Check className="w-4 h-4 text-primary" />}
                </div>
              </div>
            )}
            
            {results.length > 0 ? (
              <div className="p-2 space-y-1">
                {results.map((city) => (
                  <div
                    key={city.id}
                    onClick={() => handleSelect(city)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer flex justify-between items-center group"
                  >
                    <div>
                      <span className="block font-medium text-sm">{city.name}</span>
                      <span className="block text-xs text-muted-foreground">{city.state}</span>
                    </div>
                    {selectedCity?.id === city.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {searchQuery.trim().length > 0 && 
             !results.some(c => c.name.toLowerCase() === searchQuery.trim().toLowerCase()) && (
              <div className="p-2 border-t border-border mt-1">
                <div
                  onClick={() => handleSelect({ 
                    id: searchQuery.trim(), 
                    name: searchQuery.trim(), 
                    state: '', 
                    country: '', 
                    displayName: searchQuery.trim() 
                  })}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer flex justify-between items-center"
                >
                  <span className="block font-medium text-sm">
                    👉 Use "{searchQuery.trim()}"
                  </span>
                </div>
              </div>
            )}

            {results.length === 0 && searchQuery.trim().length === 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No cities found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CitySelect;
