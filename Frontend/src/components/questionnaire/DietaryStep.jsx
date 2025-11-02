import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Leaf } from 'lucide-react';

export default function DietaryStep({ data, onChange }) {
  const dietaryOptions = [
    { value: 'none', title: 'No Restrictions', icon: '🍽️' },
    { value: 'vegetarian', title: 'Vegetarian', icon: '🥬' },
    { value: 'vegan', title: 'Vegan', icon: '🌱' },
    { value: 'gluten_free', title: 'Gluten-Free', icon: '🌾' },
    { value: 'dairy_free', title: 'Dairy-Free', icon: '🥛' },
    { value: 'nut_free', title: 'Nut-Free', icon: '🥜' },
    { value: 'keto', title: 'Keto', icon: '🥑' },
    { value: 'paleo', title: 'Paleo', icon: '🦴' }
  ];

  const currentRestrictions = data.dietary_restrictions || [];

  const toggleRestriction = (value) => {
    if (value === 'none') {
      onChange({ dietary_restrictions: ['none'] });
    } else {
      let newRestrictions;
      if (currentRestrictions.includes('none')) {
        newRestrictions = [value];
      } else if (currentRestrictions.includes(value)) {
        newRestrictions = currentRestrictions.filter(r => r !== value);
        if (newRestrictions.length === 0) {
          newRestrictions = ['none'];
        }
      } else {
        newRestrictions = [...currentRestrictions, value];
      }
      onChange({ dietary_restrictions: newRestrictions });
    }
  };

  return (
    <Motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <Motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#A5D6A7' }}
        >
          <Leaf className="w-8 h-8 text-white" />
        </Motion.div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#2E3A59' }}>
          Any dietary preferences?
        </h2>
        <p className="text-gray-600">
          Select all that apply (you can choose multiple)
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {dietaryOptions.map((option, index) => (
          <Motion.div
            key={option.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              currentRestrictions.includes(option.value)
                ? 'border-[#A5D6A7] bg-[#A5D6A7] bg-opacity-10'
                : 'border-gray-200 hover:border-[#A5D6A7] hover:bg-gray-50'
            }`}
            onClick={() => toggleRestriction(option.value)}
          >
            <div className="flex items-center space-x-4">
              <div className="text-2xl">{option.icon}</div>
              <div className="flex-1">
                <h3 className="font-semibold" style={{ color: '#2E3A59' }}>
                  {option.title}
                </h3>
              </div>
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  currentRestrictions.includes(option.value)
                    ? 'border-[#A5D6A7] bg-[#A5D6A7]'
                    : 'border-gray-300'
                }`}
              >
                {currentRestrictions.includes(option.value) && (
                  <div className="w-2 h-2 bg-white rounded-sm" />
                )}
              </div>
            </div>
          </Motion.div>
        ))}
      </div>
    </Motion.div>
  );
}
