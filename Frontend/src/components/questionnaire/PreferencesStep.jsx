import React from 'react';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Users, DollarSign } from 'lucide-react';

export default function PreferencesStep({ data, onChange }) {
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
          <Clock className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#2E3A59' }}>
          Final preferences
        </h2>
        <p className="text-gray-600">
          Let's customize your meal planning experience
        </p>
      </div>

      <div className="space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#2E3A59' }}>
            <Clock className="w-4 h-4" />
            Preferred cooking time
          </Label>
          <Select 
            value={data.cooking_time_preference || ''} 
            onValueChange={(value) => onChange({ cooking_time_preference: value })}
          >
            <SelectTrigger className="border-gray-200 focus:border-[#A5D6A7]">
              <SelectValue placeholder="How much time do you like to spend cooking?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_15_min">Under 15 minutes</SelectItem>
              <SelectItem value="15_30_min">15-30 minutes</SelectItem>
              <SelectItem value="30_60_min">30-60 minutes</SelectItem>
              <SelectItem value="over_60_min">Over 60 minutes</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#2E3A59' }}>
            <Users className="w-4 h-4" />
            Meals per day
          </Label>
          <Select 
            value={data.meals_per_day?.toString() || ''} 
            onValueChange={(value) => onChange({ meals_per_day: parseInt(value) })}
          >
            <SelectTrigger className="border-gray-200 focus:border-[#A5D6A7]">
              <SelectValue placeholder="How many meals do you prefer per day?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meals (Breakfast, Lunch, Dinner)</SelectItem>
              <SelectItem value="4">4 meals (3 meals + 1 snack)</SelectItem>
              <SelectItem value="5">5 meals (3 meals + 2 snacks)</SelectItem>
              <SelectItem value="6">6 meals (Small frequent meals)</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#2E3A59' }}>
            <DollarSign className="w-4 h-4" />
            Budget preference
          </Label>
          <Select 
            value={data.budget_range || ''} 
            onValueChange={(value) => onChange({ budget_range: value })}
          >
            <SelectTrigger className="border-gray-200 focus:border-[#A5D6A7]">
              <SelectValue placeholder="What's your preferred budget range?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="budget_friendly">Budget-friendly ($5-10 per meal)</SelectItem>
              <SelectItem value="moderate">Moderate ($10-20 per meal)</SelectItem>
              <SelectItem value="premium">Premium ($20+ per meal)</SelectItem>
              <SelectItem value="no_limit">No budget limit</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>
      </div>
    </motion.div>
  );
}