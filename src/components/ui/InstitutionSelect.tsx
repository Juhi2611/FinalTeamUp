import React, { useState, useEffect, useRef } from 'react';
import { Search, GraduationCap, Check, ChevronDown } from 'lucide-react';
import {
  InstitutionData,
  searchInstitutions,
  getInstitutionById,
  normalizeInstitutionString,
} from '../../utils/institutionData';

interface InstitutionSelectProps {
  value: string;
  onChange: (id: string, displayName: string) => void;
  className?: string;
  placeholder?: string;
  error?: boolean;
}

const InstitutionSelect: React.FC<InstitutionSelectProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'Select a college/institution',
  error = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<InstitutionData[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialise selected value
  useEffect(() => {
    let isMounted = true;
    const initValue = async () => {
      if (!value) {
        if (isMounted) setSelectedInstitution(null);
        return;
      }
      let inst = await getInstitutionById(value);
      if (!inst) inst = (await normalizeInstitutionString(value)) ?? undefined;
      if (!inst) inst = { id: value, name: value, district: '', displayName: value };
      if (isMounted) setSelectedInstitution(inst!);
    };
    initValue();
    return () => { isMounted = false; };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Re-search whenever query or open state changes
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!isOpen) return;
      setIsLoading(true);
      try {
        const res = await searchInstitutions(searchQuery);
        if (active) setResults(res);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    const id = setTimeout(run, 50);
    return () => { active = false; clearTimeout(id); };
  }, [searchQuery, isOpen]);

  const handleSelect = (inst: InstitutionData | { id: string; name: string; district: string; displayName: string }) => {
    setSelectedInstitution(inst as InstitutionData);
    setSearchQuery('');
    setIsOpen(false);
    onChange(inst.id, inst.displayName);
  };

  const trimmedQuery = searchQuery.trim();
  const hasExactMatch = results.some(
    c => c.name.toLowerCase() === trimmedQuery.toLowerCase() ||
      c.displayName.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const showCustomOption = trimmedQuery.length > 0 && !isLoading && !hasExactMatch;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger button */}
      <div
        className={`input-field flex items-center cursor-pointer min-h-[42px] ${error ? 'border-destructive' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        style={{ paddingLeft: '2.5rem', paddingRight: '1rem' }}
      >
        <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <div className="flex-1 text-sm text-foreground truncate">
          {selectedInstitution ? selectedInstitution.name : placeholder}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-border flex items-center bg-secondary/30">
            <Search className="w-4 h-4 text-muted-foreground mr-2" />
            <input
              type="text"
              placeholder="Search colleges or districts..."
              className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && trimmedQuery && !isLoading) {
                  if (results.length > 0) {
                    handleSelect(results[0]);
                  } else {
                    handleSelect({ id: trimmedQuery, name: trimmedQuery, district: '', displayName: trimmedQuery });
                  }
                }
              }}
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto w-full custom-scrollbar">
            {/* "All Colleges" clear option — shown only when search is empty */}
            {searchQuery.trim().length === 0 && (
              <div className="p-2 border-b border-border">
                <div
                  onClick={() => { setSelectedInstitution(null); setIsOpen(false); onChange('', 'All Colleges'); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer flex justify-between items-center"
                >
                  <span className="block font-medium text-sm">All Colleges</span>
                  {!selectedInstitution && <Check className="w-4 h-4 text-primary" />}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
            )}

            {!isLoading && results.length > 0 && (
              <div className="p-2 space-y-1">
                {results.map(inst => (
                  <div
                    key={inst.id}
                    onClick={() => handleSelect(inst)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer flex justify-between items-center group"
                  >
                    <div>
                      <span className="block font-medium text-sm">{inst.name}</span>
                      {inst.district && (
                        <span className="block text-xs text-muted-foreground">{inst.district}</span>
                      )}
                    </div>
                    {selectedInstitution?.id === inst.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Custom entry option */}
            {showCustomOption && (
              <div className="p-2 border-t border-border">
                <div
                  onClick={() => handleSelect({ id: trimmedQuery, name: trimmedQuery, district: '', displayName: trimmedQuery })}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer"
                >
                  👉 Use "{trimmedQuery}"
                </div>
              </div>
            )}

            {!isLoading && results.length === 0 && trimmedQuery.length > 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">No colleges found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionSelect;