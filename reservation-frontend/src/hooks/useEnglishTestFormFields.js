import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCityDistrictByPostalCode } from '../utils/postalCodeMap';

export function useEnglishTestFormFields(initialFormData, options = {}) {
  const { readOnly = false, trackFileInputs = false } = options;

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [previewUrls, setPreviewUrls] = useState({
    idPhoto: null,
    disabilityCertFront: null,
    disabilityCertBack: null,
  });
  const [fileInputs, setFileInputs] = useState({
    idPhoto: null,
    disabilityCertFront: null,
    disabilityCertBack: null,
  });

  const fieldRefs = useRef({});

  const getFieldRef = useCallback((fieldName) => {
    if (!fieldRefs.current[fieldName]) {
      fieldRefs.current[fieldName] = React.createRef();
    }
    return fieldRefs.current[fieldName];
  }, []);

  const handleChange = useCallback((e) => {
    if (readOnly) return;

    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      if (name === 'agreedToTerms' || name === 'addressConfirmed') {
        setFormData((prev) => ({ ...prev, [name]: checked }));
      } else {
        setFormData((prev) => {
          const currentArray = prev[name] || [];
          if (checked) {
            return { ...prev, [name]: [...currentArray, value] };
          }
          return { ...prev, [name]: currentArray.filter((item) => item !== value) };
        });
      }
    } else if (name === 'postalCode') {
      setFormData((prev) => {
        const newData = { ...prev, [name]: value };
        if (value && value.length === 3) {
          const location = getCityDistrictByPostalCode(value);
          if (location) {
            newData.city = location.city;
            newData.district = location.district;
            setErrors((prevErrors) => {
              const newErrors = { ...prevErrors };
              delete newErrors.city;
              delete newErrors.district;
              return newErrors;
            });
          }
        }
        return newData;
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    setErrors((prev) => {
      if (!prev[name]) return prev;
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }, [readOnly]);

  const handleFileChange = useCallback((e) => {
    if (readOnly) return;

    const { name } = e.target;
    const file = e.target.files[0];
    if (!file) return;

    setFormData((prev) => ({ ...prev, [name]: file }));
    if (trackFileInputs) {
      setFileInputs((prev) => ({ ...prev, [name]: file }));
    }

    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setPreviewUrls((prev) => {
        if (prev[name]) {
          URL.revokeObjectURL(prev[name]);
        }
        return { ...prev, [name]: previewUrl };
      });
    } else {
      setPreviewUrls((prev) => {
        if (prev[name]) {
          URL.revokeObjectURL(prev[name]);
        }
        return { ...prev, [name]: null };
      });
    }
  }, [readOnly, trackFileInputs]);

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [previewUrls]);

  const result = {
    formData,
    setFormData,
    errors,
    setErrors,
    previewUrls,
    handleChange,
    handleFileChange,
    fieldRefs,
    getFieldRef,
  };

  if (trackFileInputs) {
    result.fileInputs = fileInputs;
    result.setFileInputs = setFileInputs;
  }

  return result;
}
