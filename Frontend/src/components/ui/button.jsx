import React from 'react'

export function Button({ variant = 'default', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'
  const styles = {
    default: 'bg-[#A5D6A7] hover:opacity-90 text-black shadow',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-800'
  }
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />
}
