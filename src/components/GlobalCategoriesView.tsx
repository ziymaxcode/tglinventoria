import React, { useEffect, useState } from "react";
import { fetchSheetData } from "../lib/api";
import { Product } from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Package, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function GlobalCategoriesView({ spreadsheetId, dynamicTabs }: { spreadsheetId: string, dynamicTabs: string[] }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Record<string, Product[]>>({});
  const [search, setSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadAllInventory() {
      if (!spreadsheetId) return;
      setLoading(true);
      let allProducts: Product[] = [];
      
      for (const tab of dynamicTabs) {
        try {
          const data: Product[] = await fetchSheetData(spreadsheetId, tab);
          for (const item of data) {
            if (item.product_id || item.item_code) {
              allProducts.push({ ...item, _sourceTab: tab }); // append source tab if we ever need it
            }
          }
        } catch (e) {
          console.warn(`Could not load tab ${tab}:`, e);
        }
      }
      
      setProducts(allProducts);
      setLoading(false);
    }
    loadAllInventory();
  }, [spreadsheetId, dynamicTabs]);

  useEffect(() => {
    // Group products by category
    const grouped: Record<string, Product[]> = {};
    for (const p of products) {
      // Filter by search
      const term = search.toLowerCase();
      const match = !term || 
        (p.item_name && p.item_name.toLowerCase().includes(term)) ||
        (p.item_code && p.item_code.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term));
      
      if (!match) continue;

      const cat = p.category || "Uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }
    
    // Sort keys alphabetically
    const sortedGrouped: Record<string, Product[]> = {};
    Object.keys(grouped).sort().forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

    setCategories(sortedGrouped);
  }, [products, search]);

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-500">Loading all inventory data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Global Categories</h2>
          <p className="text-sm text-slate-500 mt-1">Browse all inventory items grouped by their category across all product sheets.</p>
        </div>
        <div className="w-full md:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
             placeholder="Search items or categories..." 
             className="pl-10 h-10 w-full"
             value={search}
             onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {Object.keys(categories).length === 0 ? (
           <div className="p-8 text-center bg-white rounded-lg border border-slate-200 border-dashed text-slate-500">
             No categories or items found matching your search.
           </div>
        ) : (
          Object.keys(categories).map(cat => {
            const items = categories[cat];
            const isExpanded = expandedCats[cat];
            return (
              <Card key={cat} className="overflow-hidden border-slate-200 shadow-sm">
                <div 
                  className="px-6 py-4 bg-slate-50/80 cursor-pointer hover:bg-slate-100/80 transition-colors flex items-center justify-between border-b border-transparent"
                  onClick={() => toggleCat(cat)}
                  style={{ borderBottomColor: isExpanded ? '#e2e8f0' : 'transparent' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                      {cat.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 text-lg">{cat}</h3>
                      <p className="text-xs text-slate-500 font-medium">{items.length} {items.length === 1 ? 'product' : 'products'}</p>
                    </div>
                  </div>
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
                
                {isExpanded && (
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-slate-600">
                        <thead className="bg-white border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <tr>
                            <th className="px-6 py-3">Item Code</th>
                            <th className="px-6 py-3">Product Name</th>
                            <th className="px-6 py-3">Category</th>
                            <th className="px-6 py-3">Location</th>
                            <th className="px-6 py-3">Storage Sheet</th>
                            <th className="px-6 py-3 text-right">Stock</th>
                            <th className="px-6 py-3 text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-3 font-medium text-blue-600">{item.item_code || item.product_id}</td>
                              <td className="px-6 py-3 text-slate-800 font-medium">
                                <div className="flex items-center gap-2">
                                  {item.image ? (
                                    <img src={item.image} alt={item.item_name} className="w-8 h-8 rounded object-cover border border-slate-200" />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center border border-slate-200">
                                      <Package className="w-4 h-4 text-slate-400" />
                                    </div>
                                  )}
                                  {item.item_name || 'Unnamed Product'}
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                  {item.category || "Uncategorized"}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-slate-600">{item.location || "Not set"}</td>
                              <td className="px-6 py-3 text-slate-500">
                                <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                                  {item._sourceTab}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-right">
                                {parseInt(item.stock || "0") === 0 ? (
                                  <span className="text-red-500 font-medium">Out of stock</span>
                                ) : (
                                  <span className="font-semibold text-slate-700">{item.stock}</span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right font-medium text-emerald-600">
                                ${parseFloat(item.selling_price || "0").toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  );
}
