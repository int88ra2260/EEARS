import { useEffect, useRef, useState } from 'react';

const INITIAL_POSITION = {
  left: 0,
  right: 'auto',
  top: '100%',
  bottom: 'auto',
};

export function useDetailModalStatusDropdown() {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef(null);
  const statusDropdownButtonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState(INITIAL_POSITION);

  useEffect(() => {
    if (!showStatusDropdown || !statusDropdownButtonRef.current || !statusDropdownRef.current) {
      setDropdownPosition(INITIAL_POSITION);
      return undefined;
    }

    const calculatePosition = () => {
      const button = statusDropdownButtonRef.current;
      if (!button) return;

      const buttonRect = button.getBoundingClientRect();
      const estimatedDropdownWidth = 200;
      const estimatedDropdownHeight = 250;
      let left = 0;
      let right = 'auto';
      let top = '100%';
      let bottom = 'auto';
      let maxHeight = 'auto';

      if (buttonRect.left + estimatedDropdownWidth > window.innerWidth - 10) {
        right = 0;
        left = 'auto';
      }

      if (buttonRect.bottom + estimatedDropdownHeight > window.innerHeight - 10) {
        bottom = '100%';
        top = 'auto';
        maxHeight = `${Math.max(100, buttonRect.top - 20)}px`;
      }

      setDropdownPosition({ left, right, top, bottom, maxHeight });

      setTimeout(() => {
        const dropdown = statusDropdownRef.current?.querySelector('.dropdown-menu');
        if (!dropdown) return;

        const updatedButtonRect = button.getBoundingClientRect();
        const dropdownRect = dropdown.getBoundingClientRect();
        const overRight = updatedButtonRect.left + dropdownRect.width > window.innerWidth - 10;
        const overBottom = updatedButtonRect.bottom + dropdownRect.height > window.innerHeight - 10;

        setDropdownPosition({
          left: overRight ? 'auto' : left,
          right: overRight ? 0 : right,
          top: overBottom ? 'auto' : top,
          bottom: overBottom ? '100%' : bottom,
          maxHeight: overBottom ? `${Math.max(100, updatedButtonRect.top - 20)}px` : maxHeight,
        });
      }, 10);
    };

    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition, true);

    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition, true);
    };
  }, [showStatusDropdown]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
    };

    if (showStatusDropdown) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusDropdown]);

  return {
    showStatusDropdown,
    setShowStatusDropdown,
    statusDropdownRef,
    statusDropdownButtonRef,
    dropdownPosition,
  };
}
