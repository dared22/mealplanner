import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Users, DollarSign } from 'lucide-react';

export default function PreferencesStep({ data, onChange }) {
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
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-primary/20 text-primary"
        >
          <Clock className="w-8 h-8" />
        </Motion.div>
        <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-100">
          How do you like to cook?
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Time, meal cadence, and budget preferences.
        </p>
      </div>

      <div className="space-y-6">
        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            <Clock className="w-4 h-4" />
            Cooking time preference
          </Label>
          <Select 
            value={data.cooking_time_preference || ''} 
            onValueChange={(value) => onChange({ cooking_time_preference: value })}
          >
            <SelectTrigger className="border-gray-200 focus:border-[#A5D6A7] focus:ring-2 focus:ring-[#A5D6A7]/40">
              <SelectValue placeholder="Select typical cooking time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="under_15_min">Ready in under 15 minutes</SelectItem>
              <SelectItem value="15_30_min">Ready in 15–30 minutes</SelectItem>
              <SelectItem value="30_60_min">Ready in 30–60 minutes</SelectItem>
              <SelectItem value="over_60_min">Takes over 60 minutes</SelectItem>
            </SelectContent>
          </Select>
        </Motion.div>

        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            <Users className="w-4 h-4" />
            Daily meal count
          </Label>
          <Select 
            value={data.meals_per_day?.toString() || ''} 
            onValueChange={(value) => onChange({ meals_per_day: parseInt(value) })}
          >
            <SelectTrigger className="border-gray-200 focus:border-[#A5D6A7] focus:ring-2 focus:ring-[#A5D6A7]/40">
              <SelectValue placeholder="Select meals per day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meals (breakfast, lunch, dinner)</SelectItem>
              <SelectItem value="4">4 meals (3 meals plus 1 snack)</SelectItem>
              <SelectItem value="5">5 meals (3 meals plus 2 snacks)</SelectItem>
              <SelectItem value="6">6 smaller, frequent meals</SelectItem>
            </SelectContent>
          </Select>
        </Motion.div>

        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            <DollarSign className="w-4 h-4" />
            Budget focus
          </Label>
          <Select 
            value={data.budget_range || ''} 
            onValueChange={(value) => onChange({ budget_range: value })}
          >
            <SelectTrigger className="border-gray-200 focus:border-[#A5D6A7] focus:ring-2 focus:ring-[#A5D6A7]/40">
              <SelectValue placeholder="Select your budget focus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="budget friendly">Cost-efficient options</SelectItem>
              <SelectItem value="moderate">Balanced budget</SelectItem>
              <SelectItem value="premium">Premium ingredients</SelectItem>
              <SelectItem value="no_limit">No defined budget</SelectItem>
            </SelectContent>
          </Select>
        </Motion.div>
      </div>
    </Motion.div>
  );
}
