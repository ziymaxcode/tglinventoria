import { useState, useEffect } from "react";
import { Product } from "../types";
import { fetchSheetData, appendRow, updateRow, fetchConfig, deleteRow } from "../lib/api";
import { toast } from "sonner";
import { Plus, Search, Filter, RefreshCw, PenSquare, Trash2, Columns, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function InventoryView({ spreadsheetId, sheetName }: { spreadsheetId: string, sheetName: string }) {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [globalConfig, setGlobalConfig] = useState<any>({ categories: [], subcategories: [], locations: [] });

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState("general"); // "general" | "inventory"
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [locationsStock, setLocationsStock] = useState<Array<{location: string, qty: string, idealQty: string, warnQty: string}>>([]);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    if (!spreadsheetId) return;
    try {
      setLoading(true);
      const rows = await fetchSheetData(spreadsheetId, sheetName);
      
      // Load global config settings for dropdowns
      try {
        const config = await fetchConfig(spreadsheetId);
        setGlobalConfig(config);
      } catch (err: any) {
        console.warn("Could not load config", err);
      }

      // Auto-detect headers from first item (or standard set)
      if (rows.length > 0) {
        const itemHeaders = Object.keys(rows[0]).filter(k => k !== '_rowIndex');
        
        let finalItemHeaders = [...itemHeaders];
        let needsHeaderUpdate = false;
        
        // Add requested new headers if they don't exist yet but user is asking for them
        const defaultExtras = ['ideal_qty', 'warn_qty', 'locations_stock'];
        defaultExtras.forEach(ext => {
           if (!itemHeaders.includes(ext)) {
              needsHeaderUpdate = true;
              finalItemHeaders.push(ext);
           }
        });
        
        setHeaders(finalItemHeaders.length > 0 ? finalItemHeaders : ['product_id', 'item_code', 'item_name', 'description', 'stock', 'selling_price', 'category']);
        
        if (needsHeaderUpdate) {
           console.log("Updating headers dynamically", finalItemHeaders);
           updateRow(spreadsheetId, sheetName, 1, finalItemHeaders).catch(err => console.warn("Could not patch headers", err));
        }

      } else {
        // Fallback for empty sheet
        const defaultSet = ['product_id', 'item_code', 'item_name', 'description', 'stock', 'selling_price', 'category', 'supplier', 'image', 'specs', 'subcategory', 'purchase_price', 'tax', 'location', 'ideal_qty', 'warn_qty', 'locations_stock'];
        setHeaders(defaultSet);
        updateRow(spreadsheetId, sheetName, 1, defaultSet).catch(console.warn);
      }

      setData(rows);
    } catch (err: any) {
      toast.error(`Failed to load ${sheetName}: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [spreadsheetId, sheetName]);

  const filteredData = data.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (item.item_name && item.item_name.toLowerCase().includes(searchLower)) ||
      (item.item_code && item.item_code.toLowerCase().includes(searchLower)) ||
      (item.product_id && item.product_id.toLowerCase().includes(searchLower))
    );
  });

  const handleOpenDialog = (product?: Product) => {
    setDialogTab("general");
    if (product) {
      setEditingProduct(product);
      setFormData({ ...product });
      try {
         setLocationsStock(JSON.parse(product.locations_stock || '[]'));
      } catch(e) {
         setLocationsStock([]);
      }
    } else {
      setEditingProduct(null);
      const emptyForm: any = {};
      headers.forEach(h => emptyForm[h] = "");
      emptyForm.product_id = `PRD-${Date.now().toString().slice(-6)}`;
      setFormData(emptyForm);
      setLocationsStock([]);
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      let finalStock = formData.stock;
      let finalLocation = formData.location;

      if (locationsStock.length > 0) {
        // Formatted cleanly with line breaks so in Google Sheets it appears on separate lines
        finalLocation = locationsStock.map(ls => `${ls.location}: ${ls.qty}`).filter(Boolean).join("\n");
        finalStock = locationsStock.reduce((acc, ls) => acc + (parseInt(ls.qty) || 0), 0).toString();
      } else if (finalLocation && finalLocation.includes(": ")) {
        // Reset if user removed all row-level locations but the old formatted cell data persisted
        finalLocation = "";
      }

      const updatedFormData = { 
        ...formData, 
        stock: finalStock,
        location: finalLocation,
        locations_stock: JSON.stringify(locationsStock) 
      };
      // Construct row array based on headers
      const rowArr = headers.map(h => updatedFormData[h] || "");

      if (editingProduct) {
        await updateRow(spreadsheetId, sheetName, editingProduct._rowIndex, rowArr);
        toast.success("Product updated successfully");
      } else {
        await appendRow(spreadsheetId, sheetName, rowArr);
        toast.success("Product added successfully");
      }

      setIsDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      setLoading(true);
      await deleteRow(spreadsheetId, sheetName, productToDelete._rowIndex);
      toast.success("Product deleted successfully");
      setProductToDelete(null);
      loadData();
    } catch (err: any) {
      toast.error("Failed to delete product: " + err.message);
      setLoading(false);
    }
  };

  const visibleHeaders = headers.filter(h => !['description', 'image', 'specs'].includes(h)).slice(0, 7);

  return (
    <div className="flex flex-col flex-1 h-full animate-in fade-in duration-300 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-none">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{sheetName.replace(/([A-Z])/g, ' $1').trim()}</h2>
          <p className="text-sm text-muted-foreground">Manage products, stock levels, and pricing.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 shadow flex items-center px-3 py-1.5 text-[11px] font-semibold rounded-md h-auto" />}>
             <Plus className="mr-1.5 w-3 h-3" />
             Add Item
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
             <DialogHeader>
               <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
             </DialogHeader>
             
             <div className="flex space-x-4 border-b border-slate-200 mt-2">
                <button
                   className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${dialogTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                   onClick={() => setDialogTab('general')}
                >
                   General Details
                </button>
                <button
                   className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${dialogTab === 'inventory' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                   onClick={() => setDialogTab('inventory')}
                >
                   Inventory Details
                </button>
             </div>

             <div className="grid grid-cols-2 gap-4 py-4 min-h-[300px] content-start">
                {headers.filter(header => {
                   const inventoryKeys = ['stock', 'selling_price', 'purchase_price', 'supplier', 'tax', 'location', 'ideal_qty', 'warn_qty', 'locations_stock'];
                   const isInventoryTab = dialogTab === 'inventory';
                   const isMatch = isInventoryTab ? inventoryKeys.includes(header) : !inventoryKeys.includes(header);
                   if (!isMatch) return false;
                   
                   // Hide single location & stock inputs if multi-location is active
                   if (locationsStock.length > 0 && (header === 'location' || header === 'stock')) {
                      return false;
                   }
                   return true;
                }).map(header => {
                  if (header === 'locations_stock') {
                     return (
                        <div key={header} className="col-span-2 space-y-3 mt-4 border rounded-md p-4 bg-slate-50">
                           <div className="flex items-center justify-between">
                             <Label className="text-base font-semibold">Location-wise Quantities</Label>
                             <Button type="button" variant="outline" size="sm" onClick={() => setLocationsStock([...locationsStock, {location: '', qty: '', idealQty: '', warnQty: ''}])}>
                               <Plus className="w-3 h-3 mr-1" /> Add Location
                             </Button>
                           </div>
                           <p className="text-xs text-slate-500">Track stock quantities, ideal levels, and warnings across different physical locations or bins.</p>
                           
                           {locationsStock.length > 0 ? (
                              <table className="w-full mt-2 text-sm">
                                 <thead>
                                   <tr className="text-left text-slate-500 font-medium">
                                      <th className="pb-2">Location</th>
                                      <th className="pb-2 w-24">Quantity</th>
                                      <th className="pb-2 w-24">Ideal Qty</th>
                                      <th className="pb-2 w-24">Warn Qty</th>
                                      <th className="pb-2 w-10"></th>
                                   </tr>
                                 </thead>
                                 <tbody>
                                    {locationsStock.map((ls, i) => (
                                       <tr key={i} className="border-t border-slate-200">
                                          <td className="py-2 pr-2">
                                             <select
                                               value={ls.location}
                                               onChange={e => {
                                                  const newLs = [...locationsStock];
                                                  newLs[i].location = e.target.value;
                                                  setLocationsStock(newLs);
                                               }}
                                               className="flex h-8 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm ring-offset-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                             >
                                                <option value="" disabled>Select location...</option>
                                                {globalConfig.locations?.map((loc: string, idx: number) => (
                                                  <option key={idx} value={loc}>{loc}</option>
                                                ))}
                                             </select>
                                          </td>
                                          <td className="py-2 pr-2">
                                             <Input type="number" value={ls.qty} onChange={e => { const newLs = [...locationsStock]; newLs[i].qty = e.target.value; setLocationsStock(newLs); }} className="h-8 text-sm" />
                                          </td>
                                          <td className="py-2 pr-2">
                                             <Input type="number" value={ls.idealQty} onChange={e => { const newLs = [...locationsStock]; newLs[i].idealQty = e.target.value; setLocationsStock(newLs); }} className="h-8 text-sm" />
                                          </td>
                                          <td className="py-2 pr-2">
                                             <Input type="number" value={ls.warnQty} onChange={e => { const newLs = [...locationsStock]; newLs[i].warnQty = e.target.value; setLocationsStock(newLs); }} className="h-8 text-sm" />
                                          </td>
                                          <td className="py-2">
                                             <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => {
                                                setLocationsStock(locationsStock.filter((_, idx) => idx !== i));
                                             }}>
                                                <X className="w-4 h-4" />
                                             </Button>
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           ) : (
                              <div className="text-center py-6 text-sm text-slate-400 bg-white border border-dashed rounded-md">
                                 No specific locations added. Click "Add Location" to start.
                              </div>
                           )}
                        </div>
                     );
                  }

                  const isDropdownSelect = ['category', 'subcategory', 'location'].includes(header);
                  
                  if (isDropdownSelect) {
                    const sheetOptions = Array.from(new Set(data.map(d => d[header]).filter(Boolean)));
                    // Map column header to config key
                    const configOptions = header === 'category' ? globalConfig.categories :
                                       header === 'subcategory' ? globalConfig.subcategories :
                                       globalConfig.locations;

                    const combinedOptions = Array.from(new Set([...sheetOptions, ...(configOptions || [])])) as string[];
                    
                    return (
                      <div key={header} className="space-y-2">
                        <Label htmlFor={header} className="capitalize">{header.replace(/_/g, ' ')}</Label>
                        <Select value={formData[header] || ""} onValueChange={(val) => setFormData({...formData, [header]: val})}>
                          <SelectTrigger id={header} className="w-full">
                            <SelectValue placeholder={`Select ${header}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {combinedOptions.map(opt => (
                               <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                            {combinedOptions.length === 0 && (
                               <div className="py-3 px-2 text-xs text-slate-500 text-center">
                                 No options available.<br/>Add them in Configuration.
                               </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }

                  return (
                    <div key={header} className={`space-y-2 ${['description', 'specs'].includes(header) ? 'col-span-2' : ''}`}>
                      <Label htmlFor={header} className="capitalize">{header.replace(/_/g, ' ')}</Label>
                      <Input 
                        id={header}
                        value={formData[header] || ""}
                        onChange={(e) => setFormData({...formData, [header]: e.target.value})}
                        placeholder={`Enter ${header.replace(/_/g, ' ')}`}
                        className={['description', 'specs'].includes(header) ? "h-20" : ""}
                        type={['stock', 'selling_price', 'purchase_price', 'tax', 'ideal_qty', 'warn_qty'].includes(header) ? "number" : "text"}
                      />
                    </div>
                  );
                })}
             </div>
             <div className="flex justify-end space-x-2 pt-4 border-t">
               <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
               <Button onClick={handleSave} disabled={isSaving}>
                 {isSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2"/> : null}
                 {editingProduct ? "Update" : "Save"} Product
               </Button>
             </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex-1 shadow-sm border-slate-200 flex flex-col min-h-0 overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50 rounded-t-xl">
          <div className="relative w-full sm:w-1/3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search items by name or code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Button variant="outline" className="hidden sm:flex text-slate-700 bg-white border border-slate-200 text-[11px] font-semibold px-3 py-1.5 h-auto rounded-md hover:bg-slate-50 shadow-sm">
               <Filter className="mr-1.5 w-3 h-3" />
               Filters
            </Button>
            <Button variant="outline" className="hidden sm:flex text-slate-700 bg-white border border-slate-200 text-[11px] font-semibold px-3 py-1.5 h-auto rounded-md hover:bg-slate-50 shadow-sm">
               <Columns className="mr-1.5 w-3 h-3" />
               Columns
            </Button>
            <Button variant="outline" onClick={loadData} disabled={loading} className="ml-auto sm:ml-0 text-slate-700 bg-white border border-slate-200 text-[11px] font-semibold px-3 py-1.5 h-auto rounded-md hover:bg-slate-50 shadow-sm">
               <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''} sm:mr-1.5`} />
               <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <Table className="w-full text-left border-collapse table-fixed">
            <TableHeader className="sticky top-0 bg-slate-100 z-10 shadow-[0_1px_0_0_#e2e8f0]">
              <TableRow className="border-b border-slate-200">
                {visibleHeaders.map(header => (
                  <TableHead key={header} className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {header.replace(/_/g, ' ')}
                  </TableHead>
                ))}
                <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500 tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-[11px] divide-y divide-slate-100">
              {loading && data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleHeaders.length + 1} className="h-48 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                      Loading inventory records...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleHeaders.length + 1} className="h-48 text-center text-slate-500">
                    No items found matching your criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item, idx) => (
                  <TableRow key={idx} className={`${
                    (parseInt(item.stock || "0", 10) === 0) ? 'bg-red-50/30' : 
                    (parseInt(item.stock || "0", 10) > 0 && parseInt(item.stock || "0", 10) < 10) ? 'bg-amber-50/40' : ''
                  } hover:bg-slate-50/80 transition-colors`}>
                    {visibleHeaders.map(header => {
                      const val = item[header];
                      
                      // Formatting logic based on column name
                      if (header === 'stock') {
                        const sVal = parseInt(val, 10);
                        return (
                          <TableCell key={header} className={`font-bold ${sVal <= 0 ? 'text-red-600' : sVal < 10 ? 'text-amber-600' : 'text-slate-700'} text-center`}>
                            {isNaN(sVal) ? val : sVal}
                          </TableCell>
                        );
                      }
                      if (header.includes('price')) {
                        return (
                          <TableCell key={header} className="text-right font-semibold">
                            {val ? `$${parseFloat(val).toFixed(2)}` : '-'}
                          </TableCell>
                        );
                      }
                      if (header === 'item_name') {
                        return <TableCell key={header} className="font-medium text-slate-900">{val}</TableCell>
                      }

                      return (
                        <TableCell key={header} className="text-slate-600 max-w-[200px] truncate">
                           {val || '-'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(item)} className="text-slate-500 hover:text-blue-600">
                          <PenSquare className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="sm" onClick={() => setProductToDelete(item)} className="text-slate-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[11px] font-medium text-slate-500">
           Showing <span className="text-slate-900 font-bold">{filteredData.length}</span> records
        </div>
      </Card>

      <Dialog open={productToDelete !== null} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-600">
            Are you sure you want to delete <span className="font-semibold text-slate-900">{productToDelete?.item_name || productToDelete?.item_code}</span>? This action cannot be undone.
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setProductToDelete(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={loading}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
