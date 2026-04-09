import { useState, useEffect } from 'react';
import { getInstitutionById } from './institutionData';

export function useInstitutionName(collegeId?: string | null) {
  const [name, setName] = useState<string>(collegeId || '');

  useEffect(() => {
    if (!collegeId) {
      setName('');
      return;
    }

    let isMounted = true;

    async function load() {
      // Small optim: if it's already a regular string not looking like an ID
      if (!collegeId?.startsWith('1-') && !collegeId?.startsWith('inst_')) {
        if (isMounted) setName(collegeId || '');
        return;
      }
      
      try {
        const inst = await getInstitutionById(collegeId);
        if (isMounted) {
          setName(inst ? inst.name : collegeId);
        }
      } catch (err) {
        if (isMounted) {
          setName(collegeId || '');
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [collegeId]);

  return name;
}
