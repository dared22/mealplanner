import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <ShieldAlert className="w-20 h-20 text-muted-foreground" />
        </div>

        {/* Error Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            403 - Access Denied
          </h1>
          <p className="text-muted-foreground">
            You do not have permission to access the admin panel.
          </p>
        </div>

        {/* Return to Home Button */}
        <div className="pt-4">
          <Link to="/planner">
            <Button variant="default">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
