import React from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

export default function CuisineStep({ data, onChange }) {
  const cuisines = [
    { value: 'mediterranean', title: 'Mediterranean', icon: '🫒', flag: '🇬🇷' },
    { value: 'asian', title: 'Asian', icon: '🍜', flag: '🌏' },
    { value: 'mexican', title: 'Mexican', icon: '🌮', flag: '🇲🇽' },
    { value: 'italian', title: 'Italian', icon: '🍝', flag: '🇮🇹' },
    { value: 'indian', title: 'Indian', icon: '🍛', flag: '🇮🇳' },
    { value: 'american', title: 'American', icon: '🍔', flag: '🇺🇸' },
    { value: 'french', title: 'French', icon: '🥖', flag: '🇫🇷' },
    { value: 'thai', title: 'Thai', icon: '🍤', flag: '🇹🇭' },
    { value: 'japanese', title: 'Japanese', icon: '🍣', flag: '🇯🇵' },
    { value: 'middle_eastern', title: 'Middle Eastern', icon: '🥙', flag: '🏛️' }
  ];

  const currentCuisines = data.preferred_cuisines || [];

  const toggleCuisine = (value) => {
    const newCuisines = currentCuisines.includes(value)
      ? currentCuisines.filter(c => c !== value)
      : [...currentCuisines, value];
    onChange({ preferred_cuisines: newCuisines });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#A5D6A7' }}
        >
          <Globe className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#2E3A59' }}>
          What cuisines do you enjoy?
        </h2>
        <p className="text-gray-600">
          Select your favorite cuisines (choose multiple)
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cuisines.map((cuisine, index) => (
          <motion.div
            key={cuisine.value}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * index }}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              currentCuisines.includes(cuisine.value)
                ? 'border-[#A5D6A7] bg-[#A5D6A7] bg-opacity-10 transform scale-105'
                : 'border-gray-200 hover:border-[#A5D6A7] hover:bg-gray-50'
            }`}
            onClick={() => toggleCuisine(cuisine.value)}
          >
            <div className="text-center">
              <div className="flex justify-center items-center gap-1 mb-2">
                <span className="text-2xl">{cuisine.icon}</span>
                <span className="text-lg">{cuisine.flag}</span>
              </div>
              <h3 className="font-semibold" style={{ color: '#2E3A59' }}>
                {cuisine.title}
              </h3>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}