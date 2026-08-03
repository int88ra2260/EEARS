import { useEffect, useMemo, useState } from 'react';
import { fetchSiteContent } from '../services/siteContentApi';
import { EMI_ADMIN_STAFF, EMI_FACULTY } from '../data/emiCenterStaff';

function toMemberShape(row) {
  return {
    id: row.slug || String(row.id),
    name: row.name || { zh: '', en: '' },
    role: row.role || { zh: '', en: '' },
    email: row.email || undefined,
    extension: row.extension || undefined,
  };
}

export default function useStaffMembers() {
  const [dynamicStaff, setDynamicStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchSiteContent({ force: true })
        .then((data) => {
          if (cancelled) return;
          const faculty = data?.staff?.faculty;
          const admin = data?.staff?.admin;
          const hasFaculty = Array.isArray(faculty) && faculty.length > 0;
          const hasAdmin = Array.isArray(admin) && admin.length > 0;
          if (hasFaculty || hasAdmin) {
            setDynamicStaff({
              faculty: hasFaculty ? faculty.map(toMemberShape) : null,
              admin: hasAdmin ? admin.map(toMemberShape) : null,
            });
          } else {
            setDynamicStaff(null);
          }
        })
        .catch(() => {
          if (!cancelled) setDynamicStaff(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    window.addEventListener('eears:site-content-updated', load);
    return () => {
      cancelled = true;
      window.removeEventListener('eears:site-content-updated', load);
    };
  }, []);

  const faculty = useMemo(
    () => dynamicStaff?.faculty || EMI_FACULTY,
    [dynamicStaff]
  );
  const adminStaff = useMemo(
    () => dynamicStaff?.admin || EMI_ADMIN_STAFF,
    [dynamicStaff]
  );
  const isManaged = !!(dynamicStaff?.faculty?.length || dynamicStaff?.admin?.length);

  return { faculty, adminStaff, isManaged, loading };
}
