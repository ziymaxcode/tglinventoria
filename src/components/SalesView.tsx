import { useState, useEffect } from "react";
import { Product } from "../types";
import { fetchSheetData, updateRow, fetchConfig, appendRow } from "../lib/api";
import { toast } from "sonner";
import { Search, ShoppingCart, CheckCircle, PackageMinus, RefreshCw, Printer, FileText, History } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function SalesView({ spreadsheetId }: { spreadsheetId: string }) {
  const [data, setData] = useState<(Product & { _sheetName: string; _headers: string[] })[]>([]);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [customerDescription, setCustomerDescription] = useState("");
  
  const [activeTab, setActiveTab] = useState<"sale" | "history">("sale");
  
  const [cart, setCart] = useState<{ product: Product & { _sheetName: string; _headers: string[] }, qty: number, selectedLocation?: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null); // To show print dialog
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  useEffect(() => {
    if (activeTab === "sale") {
      loadAllInventory();
    } else {
      loadHistory();
    }
  }, [spreadsheetId, activeTab]);

  const loadAllInventory = async () => {
    if (!spreadsheetId) return;
    try {
      setLoading(true);
      let tabs = ["Sensors", "DevelopmentBoards", "Modules", "Components"];
      try {
         const config = await fetchConfig(spreadsheetId);
         if (config && config.productTabs) {
           tabs = Array.from(new Set([...tabs, ...config.productTabs]));
         }
      } catch (e) {}

      let allProducts: (Product & { _sheetName: string; _headers: string[] })[] = [];

      for (const tab of tabs) {
         try {
           const rows = await fetchSheetData(spreadsheetId, tab);
           if (rows.length > 0) {
             const h = Object.keys(rows[0]).filter(k => k !== '_rowIndex');
             const mapped = rows.map((r: Product) => ({ ...r, _sheetName: tab, _headers: h }));
             allProducts = [...allProducts, ...mapped];
           }
         } catch (e) {
           console.warn(`Skipped tab ${tab}`);
         }
      }
      
      setData(allProducts);
    } catch (err: any) {
      toast.error("Failed to load inventory for sales: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!spreadsheetId) return;
    try {
      setLoadingHistory(true);
      const rows = await fetchSheetData(spreadsheetId, "SalesHistory");
      // Sort history descending by receipt id (which can be timeline) or date
      setHistoryData(rows.reverse());
    } catch (e: any) {
      // It's possible SalesHistory doesn't exist yet, which is fine
      setHistoryData([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredData = data.filter(item => {
    if (!item.item_name && !item.item_code) return false;
    const term = searchTerm.toLowerCase();
    return (
      (item.item_name || "").toLowerCase().includes(term) ||
      (item.item_code || "").toLowerCase().includes(term) ||
      (item.product_id || "").toLowerCase().includes(term)
    );
  }).slice(0, 50);

  const getMaxStock = (product: any, selectedLocation: string | undefined): number => {
    if (selectedLocation && product.locations_stock) {
      try {
        const locs = JSON.parse(product.locations_stock);
        const loc = locs.find((l: any) => l.location === selectedLocation);
        if (loc) return parseInt(loc.qty || "0", 10) || 0;
      } catch (e) {}
    }
    return parseInt(product.stock || "0", 10) || 0;
  };

  const addToCart = (product: Product & { _sheetName: string; _headers: string[] }) => {
     let defaultLocation = undefined;
     try {
       if (product.locations_stock) {
         const locs = JSON.parse(product.locations_stock);
         if (locs.length === 1) {
           defaultLocation = locs[0].location;
         } else if (locs.length > 1) {
           defaultLocation = locs[0].location; // default to first, user can change it
         }
       }
     } catch(e) {}

     const existing = cart.find(c => c.product._rowIndex === product._rowIndex && c.product._sheetName === product._sheetName && c.selectedLocation === defaultLocation);
     const maxStock = getMaxStock(product, defaultLocation);

     if (existing) {
        if (existing.qty >= maxStock) {
          toast.error(`Cannot add more than available stock (${maxStock})`);
          return;
        }
        setCart(cart.map(c => c === existing ? { ...c, qty: c.qty + 1 } : c));
     } else {
        if (maxStock <= 0) {
          toast.error("Item is out of stock in this location");
          return;
        }
        setCart([...cart, { product, qty: 1, selectedLocation: defaultLocation }]);
     }
  };

  const updateCartQty = (idx: number, delta: number) => {
     const newCart = [...cart];
     const item = newCart[idx];
     
     if (delta > 0) {
       const maxStock = getMaxStock(item.product, item.selectedLocation);
       if (item.qty >= maxStock) {
         toast.error(`Cannot exceed available stock (${maxStock})`);
         return;
       }
     }
     
     item.qty += delta;
     if (item.qty <= 0) {
       newCart.splice(idx, 1);
     }
     setCart(newCart);
  };

  const updateCartLocation = (idx: number, location: string) => {
     const newCart = [...cart];
     const item = newCart[idx];
     const maxStock = getMaxStock(item.product, location);
     
     item.selectedLocation = location;
     if (item.qty > maxStock) {
       item.qty = maxStock;
       if (maxStock > 0) {
         toast.error(`Quantity reduced to max available (${maxStock}) for ${location}`);
       }
     }
     
     if (item.qty <= 0) {
       newCart.splice(idx, 1);
       toast.error(`Removed from cart as ${location} has no stock`);
     }
     
     setCart(newCart);
  };

  const totalAmount = cart.reduce((acc, item) => acc + (parseFloat(item.product.selling_price || "0") * item.qty), 0);

  const handleCheckout = async () => {
     if (cart.length === 0) return;
     
     setIsProcessing(true);
     try {
       // Update stock levels
       for (const item of cart) {
          const { product, qty } = item;
          const currentStock = parseInt(product.stock || "0", 10) || 0;
          let newStock = Math.max(0, currentStock - qty);
          
          let finalLocationsStockStr = product.locations_stock || "";
          let finalLocationStr = product.location || "";

          if (product.locations_stock) {
            try {
              let locs = JSON.parse(product.locations_stock);
              if (item.selectedLocation) {
                const locIdx = locs.findIndex((l: any) => l.location === item.selectedLocation);
                if (locIdx >= 0) {
                  const locCurrentStock = parseInt(locs[locIdx].qty || "0", 10) || 0;
                  locs[locIdx].qty = Math.max(0, locCurrentStock - qty).toString();
                }
              } else if (locs.length === 1) {
                const locCurrentStock = parseInt(locs[0].qty || "0", 10) || 0;
                locs[0].qty = Math.max(0, locCurrentStock - qty).toString();
              }

              finalLocationsStockStr = JSON.stringify(locs);
              finalLocationStr = locs.map((ls: any) => `${ls.location}: ${ls.qty}`).filter(Boolean).join("\n");
              newStock = locs.reduce((acc: number, ls: any) => acc + (parseInt(ls.qty) || 0), 0);
            } catch(e) {}
          }
          
          const rowData = product._headers.map(h => {
             if (h === 'stock') return String(newStock);
             if (h === 'locations_stock') return finalLocationsStockStr;
             if (h === 'location') return finalLocationStr;
             return product[h] || "";
          });
          
          await updateRow(spreadsheetId, product._sheetName, product._rowIndex, rowData);
       }

       // Append to SalesHistory
       const receiptId = `RCPT-${Date.now()}`;
       const dateStr = new Date().toLocaleString();
       // Simplify items list for logging
       const itemsStr = cart.map(c => `${c.qty}x ${c.product.item_name || c.product.item_code}`).join(", ");
       
       await appendRow(spreadsheetId, "SalesHistory", [
          dateStr,
          receiptId,
          itemsStr,
          totalAmount.toFixed(2),
          "Cash",
          "System",
          customerDescription || "Walk-in"
       ]);

       const saleInfo = { receiptId, date: dateStr, cart, totalAmount, customerDescription: customerDescription || "Walk-in" };
       setReceiptData(saleInfo);
       
       toast.success("Sale completed successfully!");
       setCart([]);
       setCustomerDescription("");
       loadAllInventory(); // Refresh stock
       setIsReceiptOpen(true);
     } catch (err: any) {
       toast.error("Checkout failed: " + err.message);
     } finally {
       setIsProcessing(false);
     }
  };

   const handlePrintHistory = (row: any) => {
     const saleInfo = {
       receiptId: row['Receipt ID'],
       date: row.Date,
       customerDescription: row.Customer,
       totalAmount: parseFloat(row.Total || "0"),
       itemsStr: row.Items,
       cart: null
     };
     setReceiptData(saleInfo);
     setIsReceiptOpen(true);
   };

  const filteredHistory = historyData.filter((row) => {
    if (!historySearchTerm) return true;
    const s = historySearchTerm.toLowerCase();
    const rId = (row['Receipt ID'] || "").toLowerCase();
    const customer = (row.Customer || "").toLowerCase();
    return rId.includes(s) || customer.includes(s);
  });

  return (
    <div className="flex flex-col gap-4 h-full w-full animate-in fade-in duration-300 relative print:bg-white">
      
      {/* Navigation for Sales / History - hide on print */}
      <div className="flex gap-2 print:hidden pb-2 border-b border-slate-100">
         <Button variant={activeTab === "sale" ? "default" : "outline"} onClick={() => setActiveTab("sale")} className="h-9">
            <PackageMinus className="w-4 h-4 mr-2" /> New Sale
         </Button>
         <Button variant={activeTab === "history" ? "default" : "outline"} onClick={() => setActiveTab("history")} className="h-9">
            <History className="w-4 h-4 mr-2" /> Sales History
         </Button>
      </div>

      {activeTab === "sale" && (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0 print:hidden overflow-y-auto lg:overflow-hidden">
          {/* Left side: Products List */}
          <Card className="flex-1 flex flex-col min-h-[400px] lg:min-h-0 lg:h-full overflow-hidden shadow-sm border-slate-200">
            <CardHeader className="pb-4 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
              <CardTitle className="text-lg flex items-center">
                Point of Sale
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products to sell..." 
                  className="pl-10 h-10 w-full"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10">
                      <TableRow>
                        <TableHead className="hidden sm:table-cell">Item Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="w-[80px] sm:w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item, idx) => (
                        <TableRow key={`${item._sheetName}-${item._rowIndex}`}>
                          <TableCell className="font-mono text-xs text-slate-500 hidden sm:table-cell">{item.item_code || item.product_id}</TableCell>
                          <TableCell className="font-medium max-w-[120px] sm:max-w-none truncate" title={item.item_name}>{item.item_name}</TableCell>
                          <TableCell>${parseFloat(item.selling_price || "0").toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${parseInt(item.stock || "0", 10) > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                              {item.stock || '0'}
                            </span>
                          </TableCell>
                          <TableCell>
                             <Button size="sm" variant="outline" className="h-7 text-xs bg-white hover:bg-slate-50" onClick={() => addToCart(item)} disabled={parseInt(item.stock || "0", 10) <= 0}>
                                Add
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                            No products found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Right side: Cart */}
          <Card className="w-full lg:w-[350px] min-h-[400px] lg:min-h-0 lg:h-full flex flex-col shrink-0 shadow-sm border-slate-200">
             <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
               <CardTitle className="text-lg flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-blue-600" />
                  Current Sale
               </CardTitle>
             </CardHeader>
             <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 p-4">
                   {cart.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                        <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">Cart is empty</p>
                     </div>
                   ) : (
                     <div className="space-y-4">
                        {cart.map((item, idx) => (
                          <div key={idx} className="flex flex-col bg-white border border-slate-100 p-3 rounded-lg shadow-sm">
                             <div className="flex justify-between items-center">
                                <div className="flex-1 overflow-hidden pr-2">
                                   <p className="font-semibold text-sm truncate">{item.product.item_name}</p>
                                   <p className="text-xs text-slate-500">${parseFloat(item.product.selling_price || "0").toFixed(2)}</p>
                                </div>
                                <div className="flex items-center space-x-2 bg-slate-50 rounded-md border border-slate-200 px-1 py-0.5">
                                   <button onClick={() => updateCartQty(idx, -1)} className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded text-lg font-medium leading-none">-</button>
                                   <span className="w-6 text-center text-sm font-semibold">{item.qty}</span>
                                   <button onClick={() => updateCartQty(idx, 1)} className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-200 rounded text-lg font-medium leading-none">+</button>
                                </div>
                             </div>
                             {item.product.locations_stock && (
                               <div className="mt-2 text-xs flex items-center justify-between text-slate-500 bg-slate-50 rounded p-1.5 border border-slate-100">
                                  <span className="font-medium">Location:</span>
                                  <select 
                                    value={item.selectedLocation || ""} 
                                    onChange={(e) => updateCartLocation(idx, e.target.value)}
                                    className="bg-transparent outline-none font-medium text-slate-700 cursor-pointer max-w-[150px] truncate"
                                  >
                                    <option value="" disabled>Select Location</option>
                                    {(() => {
                                       try {
                                         return JSON.parse(item.product.locations_stock).map((loc: any, i: number) => (
                                           <option key={i} value={loc.location}>
                                             {loc.location} ({loc.qty} available)
                                           </option>
                                         ));
                                       } catch (e) {
                                         return null;
                                       }
                                    })()}
                                  </select>
                               </div>
                             )}
                          </div>
                        ))}
                     </div>
                   )}
                </ScrollArea>
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-4">
                   <div className="space-y-2">
                     <label className="text-xs font-semibold text-slate-500">Customer Description</label>
                     <Input 
                       value={customerDescription}
                       onChange={(e) => setCustomerDescription(e.target.value)}
                       placeholder="e.g. John Doe / Walk-in" 
                       className="h-8 text-sm"
                     />
                   </div>
                   <div className="flex justify-between items-center text-lg font-bold text-slate-800 pt-2 border-t border-slate-200">
                      <span>Total</span>
                      <span>${totalAmount.toFixed(2)}</span>
                   </div>
                   <Button 
                     className="w-full bg-blue-600 hover:bg-blue-700 h-10" 
                     disabled={cart.length === 0 || isProcessing}
                     onClick={handleCheckout}
                   >
                     {isProcessing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                     {isProcessing ? "Processing..." : "Complete Sale"}
                   </Button>
                </div>
             </CardContent>
          </Card>
        </div>
      )}

      {/* History View */}
      {activeTab === "history" && (
         <Card className="flex-1 flex flex-col overflow-hidden print:hidden border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex-shrink-0">
               <CardTitle className="text-lg flex items-center">Sales History</CardTitle>
               <div className="relative mt-2">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <Input 
                   value={historySearchTerm}
                   onChange={(e) => setHistorySearchTerm(e.target.value)}
                   placeholder="Search by receipt id or customer..." 
                   className="pl-10 h-10 w-full"
                 />
               </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
               {loadingHistory ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
               ) : (
                  <ScrollArea className="h-full">
                     <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10">
                           <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead className="hidden md:table-cell">Receipt ID</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead className="hidden md:table-cell">Items</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead className="w-[100px]"></TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {filteredHistory.map((row) => (
                              <TableRow key={row._rowIndex}>
                                 <TableCell className="text-sm">{row.Date}</TableCell>
                                 <TableCell className="font-mono text-xs hidden md:table-cell">{row['Receipt ID']}</TableCell>
                                 <TableCell className="text-sm font-medium">{row.Customer}</TableCell>
                                 <TableCell className="max-w-[400px] truncate hidden md:table-cell" title={row.Items}>{row.Items}</TableCell>
                                 <TableCell className="font-semibold">${parseFloat(row.Total || "0").toFixed(2)}</TableCell>
                                 <TableCell>
                                    <Button size="sm" variant="outline" className="h-7 text-xs bg-white hover:bg-slate-50" onClick={() => handlePrintHistory(row)}>
                                       <Printer className="w-3 h-3 mr-1" /> PDF
                                    </Button>
                                 </TableCell>
                              </TableRow>
                           ))}
                           {filteredHistory.length === 0 && (
                              <TableRow>
                                 <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                                    No sales history found.
                                 </TableCell>
                              </TableRow>
                           )}
                        </TableBody>
                     </Table>
                  </ScrollArea>
               )}
            </CardContent>
         </Card>
      )}

      {/* Receipt Print Overlay */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
         <DialogContent className="sm:max-w-md print:hidden">
            <DialogHeader>
               <DialogTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" /> Sale Successful
               </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
               <p className="text-sm text-slate-600">Transaction has been recorded. You can now print the receipt or start a new sale.</p>
               {receiptData && (
                 <div className="bg-slate-50 p-4 border border-slate-100 rounded-md font-mono text-xs space-y-2">
                    <div className="flex justify-between border-b border-dashed border-slate-300 pb-2">
                       <span>{receiptData.receiptId}</span>
                       <span>{receiptData.date}</span>
                    </div>
                    {receiptData.customerDescription && (
                       <div className="py-2 border-b border-dashed border-slate-300 text-slate-500">
                          <span className="font-semibold text-slate-700">Customer:</span> {receiptData.customerDescription}
                       </div>
                    )}
                    {receiptData.cart ? receiptData.cart.map((item: any, i: number) => (
                       <div key={i} className="flex justify-between">
                          <span>{item.qty}x {item.product.item_name}</span>
                          <span>${(parseFloat(item.product.selling_price || "0") * item.qty).toFixed(2)}</span>
                       </div>
                    )) : (
                       <div className="flex justify-between text-sm py-2">
                          <span className="whitespace-pre-wrap">{receiptData.itemsStr}</span>
                       </div>
                    )}
                    <div className="flex justify-between border-t border-dashed border-slate-300 pt-2 font-bold text-sm">
                       <span>TOTAL</span>
                       <span>${receiptData.totalAmount.toFixed(2)}</span>
                    </div>
                 </div>
               )}
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsReceiptOpen(false)}>Close</Button>
               <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => window.print()}>
                 <Printer className="w-4 h-4 mr-2" /> Print PDF Receipt
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
      
      {/* Hidden Print Wrapper */}
      {receiptData && (
         <div className="hidden print:block text-black font-mono aspect-[0.5] max-w-xs mx-auto p-4 bg-white">
            <h1 className="text-center font-bold text-xl mb-4">INVOICE/RECEIPT</h1>
            <p className="text-sm mb-1 text-center">Store Name / Company</p>
            <div className="border-b border-black border-dashed mb-4 pb-2 text-sm text-center">
              <div>Receipt: {receiptData.receiptId}</div>
              <div>Date: {receiptData.date}</div>
              {receiptData.customerDescription && (
                 <div className="mt-1 font-semibold">Customer: {receiptData.customerDescription}</div>
              )}
            </div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left py-1">Qty</th>
                  <th className="text-left py-1">Item</th>
                  <th className="text-right py-1">Amt</th>
                </tr>
              </thead>
              <tbody>
                {receiptData.cart ? receiptData.cart.map((item: any, i: number) => (
                   <tr key={i} className="align-top border-b border-gray-200 border-dashed">
                      <td className="py-2 pr-2">{item.qty}</td>
                      <td className="py-2 pr-2">{item.product.item_name}</td>
                      <td className="py-2 text-right">
                         ${(parseFloat(item.product.selling_price || "0") * item.qty).toFixed(2)}
                      </td>
                   </tr>
                )) : (
                   <tr className="align-top border-b border-gray-200 border-dashed">
                      <td colSpan={2} className="py-2 pr-2 whitespace-pre-wrap">{receiptData.itemsStr}</td>
                      <td className="py-2 text-right">
                         ${receiptData.totalAmount.toFixed(2)}
                      </td>
                   </tr>
                )}
              </tbody>
            </table>
            <div className="flex justify-between items-center text-lg font-bold border-t border-black pt-2">
               <span>TOTAL:</span>
               <span>${receiptData.totalAmount.toFixed(2)}</span>
            </div>
            <div className="text-center text-xs mt-10">
               <div>Thank you for your purchase!</div>
            </div>
         </div>
      )}
    </div>
  );
}
