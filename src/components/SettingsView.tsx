import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Database, MapPin, Tags, RefreshCw, Save } from "lucide-react";
import { fetchConfig, saveConfig } from "../lib/api";
import { toast } from "sonner";

export default function SettingsView({ 
  spreadsheetId, 
  setSpreadsheetId, 
  handleSaveConfig,
  onConfigSaved
}: {
  spreadsheetId: string,
  setSpreadsheetId: (id: string) => void,
  handleSaveConfig: () => void,
  onConfigSaved?: () => void
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [productTabs, setProductTabs] = useState<string[]>([]);
  
  const [newCat, setNewCat] = useState("");
  const [newSubcat, setNewSubcat] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [newProductTab, setNewProductTab] = useState("");
  
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      if (!spreadsheetId) return;
      try {
        setLoadingConfig(true);
        const config = await fetchConfig(spreadsheetId);
        setCategories(config.categories || []);
        setSubcategories(config.subcategories || []);
        setLocations(config.locations || []);
        
        const DEFAULT_PRODUCT_TABS = ["Sensors", "DevelopmentBoards", "Modules", "Components"];
        const loadedTabs = config.productTabs || [];
        const mergedTabs = Array.from(new Set([...DEFAULT_PRODUCT_TABS, ...loadedTabs]));
        setProductTabs(mergedTabs);
      } catch (err: any) {
        toast.error("Failed to load configuration from sheet: " + err.message);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, [spreadsheetId]);

  const addOption = (val: string, setVal: any, stateList: string[], setStateList: any) => {
     if (!val.trim()) return;
     const updated = [...new Set([...stateList, val.trim()])];
     setStateList(updated);
     setVal("");
  };

  const removeOption = (val: string, stateList: string[], setStateList: any) => {
     const updated = stateList.filter(item => item !== val);
     setStateList(updated);
  };

  const handleSaveToSheet = async () => {
    if (!spreadsheetId) {
      toast.error("Please configure Spreadsheet ID first.");
      return;
    }
    try {
      setSavingConfig(true);
      await saveConfig(spreadsheetId, { categories, subcategories, locations, productTabs });
      toast.success("Options saved to Google Sheet 'AppConfig' tab.");
      if (onConfigSaved) onConfigSaved();
    } catch (err: any) {
      toast.error("Failed to save to sheet: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 mt-2 pb-10 w-full animate-in fade-in duration-300">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex items-center gap-2">
             <Database className="w-5 h-5 text-blue-600" />
             <CardTitle className="text-lg">Database Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">Google Spreadsheet ID</label>
            <p className="text-xs text-slate-500">
              Enter the ID of the Google Sheet acting as your database. Found in the URL: <br/>
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">https://docs.google.com/spreadsheets/d/[ENTER_THIS_PART]/edit</code>
            </p>
            <div className="flex space-x-2">
               <Input 
                 value={spreadsheetId}
                 onChange={(e) => {
                   let val = e.target.value;
                   const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
                   if (match && match[1]) {
                     val = match[1];
                   }
                   setSpreadsheetId(val);
                 }}
                 placeholder="e.g. 1BxiMVs0XRYFgwnTE..." 
                 className="max-w-md"
               />
               <Button onClick={handleSaveConfig} className="bg-blue-600 hover:bg-blue-700">Connect</Button>
            </div>
            {!spreadsheetId ? (
              <div className="p-3 bg-amber-50 text-amber-800 rounded-md border border-amber-200 text-xs mt-4">
                 <strong>Action Required:</strong> Configure a Spreadsheet ID before the system can load inventory data.
              </div>
            ) : (
              <div className="p-3 bg-green-50 text-green-800 rounded-md border border-green-200 text-xs mt-4">
                 <strong>Active Connection:</strong> System is securely connected to an active Spreadsheet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
           <div className="flex items-center gap-2">
             <Database className="w-5 h-5 text-blue-600" />
             <CardTitle className="text-lg">Product Tabs (Inventory Sheets)</CardTitle>
           </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4 max-w-md">
            <div>
               <p className="text-xs text-slate-500 mb-2">These are the actual sheets where your products are stored. Adding a new tab here creates a new section on the sidebar.</p>
               <div className="flex space-x-2">
                 <Input 
                    value={newProductTab}
                    onChange={e => setNewProductTab(e.target.value)}
                    placeholder="e.g. Sensors, Tools, Motors..." 
                    onKeyDown={e => e.key === 'Enter' && addOption(newProductTab, setNewProductTab, productTabs, setProductTabs)}
                 />
                 <Button variant="secondary" onClick={() => addOption(newProductTab, setNewProductTab, productTabs, setProductTabs)}>
                   <Plus className="w-4 h-4" />
                 </Button>
               </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
               {productTabs.length === 0 && <span className="text-xs text-slate-400">No product tabs added.</span>}
               {productTabs.map(tab => (
                 <Badge key={tab} variant="outline" className="px-2 py-1 bg-emerald-50 border-emerald-200 flex items-center gap-1.5 text-emerald-800 hover:bg-emerald-100 transition-colors text-xs font-semibold">
                    {tab}
                    <button onClick={() => removeOption(tab, productTabs, setProductTabs)} className="hover:bg-emerald-200 p-0.5 rounded-full text-emerald-500 hover:text-emerald-700 transition-colors">
                       <X className="w-3 h-3" />
                    </button>
                 </Badge>
               ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <Tags className="w-5 h-5 text-blue-600" />
               <CardTitle className="text-lg">Master Data: Categories & Subcategories</CardTitle>
            </div>
            {loadingConfig && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
          </div>
        </CardHeader>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Categories */}
          <div className="space-y-4">
            <div>
               <label className="text-sm font-medium text-slate-700">Global Categories</label>
               <p className="text-xs text-slate-500 mb-2">Available in the Add/Edit dropdown.</p>
               <div className="flex space-x-2">
                 <Input 
                    value={newCat}
                    onChange={e => setNewCat(e.target.value)}
                    placeholder="New category..." 
                    onKeyDown={e => e.key === 'Enter' && addOption(newCat, setNewCat, categories, setCategories)}
                 />
                 <Button variant="secondary" onClick={() => addOption(newCat, setNewCat, categories, setCategories)}>
                   <Plus className="w-4 h-4" />
                 </Button>
               </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
               {categories.length === 0 && <span className="text-xs text-slate-400">No categories added.</span>}
               {categories.map(cat => (
                 <Badge key={cat} variant="outline" className="px-2 py-1 bg-white flex items-center gap-1.5 text-slate-700 shadow-sm border-slate-200 text-xs font-semibold">
                    {cat}
                    <button onClick={() => removeOption(cat, categories, setCategories)} className="hover:bg-red-50 p-0.5 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                       <X className="w-3 h-3" />
                    </button>
                 </Badge>
               ))}
            </div>
          </div>

          {/* Subcategories */}
          <div className="space-y-4">
            <div>
               <label className="text-sm font-medium text-slate-700">Global Subcategories</label>
               <p className="text-xs text-slate-500 mb-2">Available in the Add/Edit dropdown.</p>
               <div className="flex space-x-2">
                 <Input 
                    value={newSubcat}
                    onChange={e => setNewSubcat(e.target.value)}
                    placeholder="New subcategory..." 
                    onKeyDown={e => e.key === 'Enter' && addOption(newSubcat, setNewSubcat, subcategories, setSubcategories)}
                 />
                 <Button variant="secondary" onClick={() => addOption(newSubcat, setNewSubcat, subcategories, setSubcategories)}>
                   <Plus className="w-4 h-4" />
                 </Button>
               </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
               {subcategories.length === 0 && <span className="text-xs text-slate-400">No subcategories added.</span>}
               {subcategories.map(subcat => (
                 <Badge key={subcat} variant="outline" className="px-2 py-1 bg-white flex items-center gap-1.5 text-slate-700 shadow-sm border-slate-200 text-xs font-semibold">
                    {subcat}
                    <button onClick={() => removeOption(subcat, subcategories, setSubcategories)} className="hover:bg-red-50 p-0.5 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                       <X className="w-3 h-3" />
                    </button>
                 </Badge>
               ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
           <div className="flex items-center gap-2">
             <MapPin className="w-5 h-5 text-blue-600" />
             <CardTitle className="text-lg">Master Data: Storage Locations</CardTitle>
           </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4 max-w-md">
            <div>
               <p className="text-xs text-slate-500 mb-2">Pre-define warehouse or shelf locations.</p>
               <div className="flex space-x-2">
                 <Input 
                    value={newLoc}
                    onChange={e => setNewLoc(e.target.value)}
                    placeholder="e.g. Warehouse 1, Shelf B2..." 
                    onKeyDown={e => e.key === 'Enter' && addOption(newLoc, setNewLoc, locations, setLocations)}
                 />
                 <Button variant="secondary" onClick={() => addOption(newLoc, setNewLoc, locations, setLocations)}>
                   <Plus className="w-4 h-4" />
                 </Button>
               </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
               {locations.length === 0 && <span className="text-xs text-slate-400">No locations added.</span>}
               {locations.map(loc => (
                 <Badge key={loc} variant="outline" className="px-2 py-1 bg-blue-50 border-blue-200 flex items-center gap-1.5 text-blue-800 hover:bg-blue-100 transition-colors text-xs font-semibold">
                    {loc}
                    <button onClick={() => removeOption(loc, locations, setLocations)} className="hover:bg-blue-200 p-0.5 rounded-full text-blue-500 hover:text-blue-700 transition-colors">
                       <X className="w-3 h-3" />
                    </button>
                 </Badge>
               ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end pt-4">
          <Button onClick={handleSaveToSheet} disabled={savingConfig || !spreadsheetId} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm font-semibold">
             {savingConfig ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
             Save Settings to Sheet
          </Button>
      </div>
    </div>
  );
}
