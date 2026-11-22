/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { useDashboard } from '@/hooks/use-dashboard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Store, MapPin, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

export const Settings: React.FC = () => {
  const { outlets, addNewOutlet } = useDashboard();
  const [isAdding, setIsAdding] = React.useState(false);
  const [name, setName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [isIntegrating, setIsIntegrating] = React.useState(false);

  const handleAddOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !city) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsIntegrating(true);
    // Simulate "Live Integration" delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    addNewOutlet(name, city);
    setIsIntegrating(false);
    setIsAdding(false);
    setName("");
    setCity("");
    toast.success(`${name} integrated and added successfully!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Settings</h2>
        <Button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2 shadow-lg shadow-orange-200"
        >
          <Plus className="w-4 h-4" />
          Add New Outlet
        </Button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-orange-200 bg-orange-50/30">
              <form onSubmit={handleAddOutlet}>
                <CardHeader>
                  <CardTitle>Add New Outlet</CardTitle>
                  <CardDescription>Configure and integrate a new outlet with live data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Outlet Name</Label>
                      <Input 
                        id="name" 
                        placeholder="e.g. Urban Tarka" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-white"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input 
                        id="city" 
                        placeholder="e.g. Pune" 
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="bg-white"
                        required
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-slate-100 flex items-start gap-3">
                    <div className="mt-1 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <RefreshCw className={cn("w-5 h-5 text-blue-500", isIntegrating && "animate-spin")} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">Integration Mode</p>
                      <p className="text-xs text-slate-500">Live data integration with POS and delivery platforms (Swiggy, Zomato) will be initialized.</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                  <Button 
                    type="submit" 
                    disabled={isIntegrating}
                    className="bg-orange-500 hover:bg-orange-600 text-white min-w-[140px]"
                  >
                    {isIntegrating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        Integrating...
                      </>
                    ) : "Start Integration"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {outlets.map((outlet) => (
          <Card key={outlet.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{outlet.name}</CardTitle>
                  <div className="flex items-center gap-1 text-slate-500 text-sm">
                    <MapPin className="w-3 h-3" />
                    {outlet.city}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Live
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">ID</span>
                  <span className="font-mono text-slate-700">{outlet.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Currency</span>
                  <span className="text-slate-700">{outlet.currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status</span>
                  <span className="text-emerald-600 font-medium italic">Active Integration</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t border-slate-50">
              <Button variant="outline" className="w-full text-xs h-8">Manage Integration</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

