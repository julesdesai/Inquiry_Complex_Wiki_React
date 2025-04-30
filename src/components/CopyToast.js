// src/components/CopyToast.js
import React, { useEffect } from 'react';
import { Check } from 'lucide-react';

const Toast = ({ show, onClose, message = "Copied to clipboard!", icon = <Check /> }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);
  
  if (!show) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-stone-800 text-white px-4 py-3 rounded-md shadow-lg flex items-center gap-3 z-50">
      <span className="flex-shrink-0 text-green-400">
        {icon}
      </span>
      <span>{message}</span>
    </div>
  );
};

export default Toast;