import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Ruler, Weight, Calendar } from 'lucide-react';

export default function PersonalInfoStep({ data, onChange }) {
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
          <User className="w-8 h-8 text-white" />
        </Motion.div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#2E3A59' }}>
          Tell us about yourself
        </h2>
        <p className="text-gray-600">
          This helps us create the perfect meal plan just for you
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#2E3A59' }}>
            <Calendar className="w-4 h-4" />
            Age
          </Label>
          <Input
            type="number"
            placeholder="Enter your age"
            value={data.age || ''}
            onChange={(e) => onChange({ age: parseInt(e.target.value) || '' })}
            className="border-gray-200 focus:border-[#A5D6A7] transition-colors"
          />
        </Motion.div>

        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#2E3A59' }}>
            <User className="w-4 h-4" />
            Gender
          </Label>
          <Select value={data.gender || ''} onValueChange={(value) => onChange({ gender: value })}>
            <SelectTrigger className="border-gray-200 focus:border-[#A5D6A7]">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Motion.div>

        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#2E3A59' }}>
            <Ruler className="w-4 h-4" />
            Height (cm)
          </Label>
          <Input
            type="number"
            placeholder="Enter your height"
            value={data.height || ''}
            onChange={(e) => onChange({ height: parseInt(e.target.value) || '' })}
            className="border-gray-200 focus:border-[#A5D6A7] transition-colors"
          />
        </Motion.div>

        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#2E3A59' }}>
            <Weight className="w-4 h-4" />
            Weight (kg)
          </Label>
          <Input
            type="number"
            placeholder="Enter your weight"
            value={data.weight || ''}
            onChange={(e) => onChange({ weight: parseInt(e.target.value) || '' })}
            className="border-gray-200 focus:border-[#A5D6A7] transition-colors"
          />
        </Motion.div>
      </div>
    </Motion.div>
  );
}
