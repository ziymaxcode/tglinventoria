export interface Product {
    _rowIndex: number;
    product_id: string; // SKU or internal ID
    item_code: string;
    item_name: string;
    description: string;
    specs: string;
    category: string;
    subcategory: string;
    purchase_price: string;
    selling_price: string;
    tax: string;
    stock: string;
    location: string;
    supplier: string;
    image: string;
    [key: string]: any; // Allow dynamic fields
}

export interface InventoryStats {
    totalProducts: number;
    totalStockValue: number;
    lowStockItems: number;
    outOfStockItems: number;
}
