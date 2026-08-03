import { useEffect, useMemo, useState } from 'react';
import { fetchSiteContent } from '../services/siteContentApi';
import { FAQ_IDS } from '../data/faqs';
import { getTranslation, LANG_ZH, LANG_EN } from '../constants/translations';

function buildFallbackFaq() {
  return FAQ_IDS.map((id, index) => ({
    id,
    sortOrder: index,
    isActive: true,
    question: {
      zh: getTranslation(LANG_ZH, `homePage.${id}Q`),
      en: getTranslation(LANG_EN, `homePage.${id}Q`),
    },
    answer: {
      zh: getTranslation(LANG_ZH, `homePage.${id}A`),
      en: getTranslation(LANG_EN, `homePage.${id}A`),
    },
  }));
}

export default function useFaqItems() {
  const [dynamicFaq, setDynamicFaq] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchSiteContent({ force: true })
        .then((data) => {
          if (cancelled) return;
          const list = Array.isArray(data?.faq) ? data.faq.filter((item) => item.isActive !== false) : [];
          setDynamicFaq(list.length > 0 ? list : null);
        })
        .catch(() => {
          if (!cancelled) setDynamicFaq(null);
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

  const faqItems = useMemo(() => dynamicFaq || buildFallbackFaq(), [dynamicFaq]);
  const isManaged = !!dynamicFaq?.length;

  return { faqItems, isManaged, loading };
}

export function pickLocalizedText(bundle, lang) {
  if (!bundle) return '';
  return bundle[lang] || bundle.zh || bundle.en || '';
}
